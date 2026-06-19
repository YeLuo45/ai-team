// Express server entry — REST API + LLM proxy
// Reuses @ai-team/core for storage, @ai-team/agent for interview orchestration

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import {
  CandidateStore,
  MemberStore,
  InterviewStore,
  TrainingStore,
  JsonStore,
  generateId,
  nowIso,
  type Candidate,
  type Member,
  type Interview,
  type Training,
  type Skill,
} from '@ai-team/core';
import { createFromEnv } from '@ai-team/ai';
import { InterviewAgent, TrainingAgent, OneOnOneAgent, ReviewAgent, ResumeAgent } from '@ai-team/agent';
import type { Review } from '@ai-team/core';
import { PluginManager, HOOK_EVENTS, type PluginConfig } from './plugins.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const DATA_DIR = process.env.AI_TEAM_DATA_DIR ?? path.resolve(process.cwd(), 'data');
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Stores (singleton)
const candidateStore = CandidateStore.create(DATA_DIR);
const memberStore = MemberStore.create(DATA_DIR);
const interviewStore = InterviewStore.create(DATA_DIR);
const trainingStore = TrainingStore.create(DATA_DIR);
const skillStore = new JsonStore<Skill>({ baseDir: DATA_DIR, fileName: 'skills.json' });
const reviewStore = new JsonStore<Review>({ baseDir: DATA_DIR, fileName: 'reviews.json' });
const notificationStore = new JsonStore<Notification>({ baseDir: DATA_DIR, fileName: 'notifications.json' });

// Notification model
interface Notification {
  id: string;
  type: 'candidate.created' | 'interview.completed' | 'review.saved' | 'training.created' | 'plugin' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

// Helper: create a notification
function notify(partial: Omit<Notification, 'id' | 'read' | 'createdAt'>) {
  const n: Notification = {
    id: generateId('nt'),
    read: false,
    createdAt: nowIso(),
    ...partial,
  };
  notificationStore.add(n).catch(() => {});
  return n;
}

// LLM client
const llm = createFromEnv();

// Plugin manager
const pluginManager = new PluginManager(path.join(DATA_DIR, 'plugins'));
await pluginManager.loadAll();
console.log(`[server] Loaded ${pluginManager.list().length} plugin(s)`);

// ============== Health ==============
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', dataDir: DATA_DIR, llmProvider: process.env.AI_TEAM_LLM_API_KEY ? 'configured' : 'mock' });
});

// ============== Team bulk ==============
app.get('/api/team', async (_req, res) => {
  const [candidates, members, interviews, trainings, skills, reviews] = await Promise.all([
    candidateStore.list(),
    memberStore.list(),
    interviewStore.list(),
    trainingStore.list(),
    skillStore.list().catch(() => []),
    reviewStore.list().catch(() => []),
  ]);
  res.json({ candidates, members, interviews, trainings, skills, reviews, generatedAt: nowIso() });
});

app.get('/api/stats', async (_req, res) => {
  const [candidates, members, interviews] = await Promise.all([
    candidateStore.list(),
    memberStore.list(),
    interviewStore.list(),
  ]);
  const active = members.filter((m) => m.status === 'active');
  const completed = interviews.filter((i) => i.status === 'completed');
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, i) => s + (i.evaluation?.overall ?? 0), 0) / completed.length)
    : 0;
  const teamCounts = new Map<string, number>();
  for (const m of active) teamCounts.set(m.team, (teamCounts.get(m.team) ?? 0) + 1);
  res.json({
    activeMembers: active.length,
    totalMembers: members.length,
    candidates: candidates.length,
    totalInterviews: interviews.length,
    completedInterviews: completed.length,
    avgScore,
    teamCounts: Object.fromEntries(teamCounts),
  });
});

// ============== Candidates ==============
app.get('/api/candidates', async (_req, res) => res.json(await candidateStore.list()));

app.get('/api/candidates/:id', async (req, res) => {
  const c = await candidateStore.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Candidate not found' });
  res.json(c);
});

app.post('/api/candidates', async (req, res) => {
  const body = req.body as Partial<Candidate>;
  if (!body.name || !body.position) {
    return res.status(400).json({ error: 'name and position are required' });
  }
  const candidate: Candidate = {
    id: generateId('ct'),
    name: body.name,
    position: body.position,
    source: body.source ?? 'other',
    status: body.status ?? 'new',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...(body.email && { email: body.email }),
    ...(body.phone && { phone: body.phone }),
    ...(body.resume && { resume: body.resume }),
    ...(body.tags && { tags: body.tags }),
    ...(body.notes && { notes: body.notes }),
  };
  const saved = await candidateStore.add(candidate);
  // Auto-generate notification
  notify({
    type: 'candidate.created',
    title: '👤 新候选人',
    message: `${saved.name} (${saved.position})`,
    link: '#/candidates',
  });
  pluginManager.fireHook('candidate.created', saved);
  res.status(201).json(saved);
});

app.put('/api/candidates/:id', async (req, res) => {
  const patch = { ...(req.body as Partial<Candidate>), updatedAt: nowIso() };
  const updated = await candidateStore.update(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: 'Candidate not found' });
  res.json(updated);
});

app.delete('/api/candidates/:id', async (req, res) => {
  const ok = await candidateStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Candidate not found' });
  res.status(204).end();
});

// ============== Members ==============
app.get('/api/members', async (_req, res) => res.json(await memberStore.list()));

app.get('/api/members/:id', async (req, res) => {
  const m = await memberStore.get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Member not found' });
  res.json(m);
});

app.post('/api/members', async (req, res) => {
  const body = req.body as Partial<Member>;
  if (!body.name || !body.role || !body.team) {
    return res.status(400).json({ error: 'name, role, team are required' });
  }
  const member: Member = {
    id: generateId('mb'),
    name: body.name,
    role: body.role,
    team: body.team,
    joinedAt: nowIso(),
    skills: body.skills ?? [],
    trainings: body.trainings ?? [],
    reviews: body.reviews ?? [],
    status: body.status ?? 'active',
    ...(body.candidateId && { candidateId: body.candidateId }),
    ...(body.manager && { manager: body.manager }),
    ...(body.level && { level: body.level }),
    ...(body.bio && { bio: body.bio }),
  };
  const saved = await memberStore.add(member);
  res.status(201).json(saved);
});

app.put('/api/members/:id', async (req, res) => {
  const updated = await memberStore.update(req.params.id, req.body as Partial<Member>);
  if (!updated) return res.status(404).json({ error: 'Member not found' });
  res.json(updated);
});

app.delete('/api/members/:id', async (req, res) => {
  const ok = await memberStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Member not found' });
  res.status(204).end();
});

// ============== Interviews ==============
// Sessions kept in-memory (per-server-lifetime)
const sessions = new Map<string, { session: ReturnType<InterviewAgent['start']>; candidate: Candidate }>();

app.get('/api/interviews', async (_req, res) => res.json(await interviewStore.list()));

app.get('/api/interviews/:id', async (req, res) => {
  const i = await interviewStore.get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Interview not found' });
  res.json(i);
});

app.post('/api/interviews/start', async (req, res) => {
  const { candidateId, type } = req.body as { candidateId?: string; type?: Interview['type'] };
  if (!candidateId) return res.status(400).json({ error: 'candidateId is required' });
  const candidate = await candidateStore.get(candidateId);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  const agent = new InterviewAgent(llm);
  const session = agent.start(candidate, { ...(type && { type }) });
  sessions.set(session.interview.id, { session, candidate });

  // First question
  try {
    const q = await session.nextQuestion();
    res.status(201).json({ interview: session.interview, nextQuestion: q });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/interviews/:id/answer', async (req, res) => {
  const { content } = req.body as { content?: string };
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  const ctx = sessions.get(req.params.id);
  if (!ctx) return res.status(404).json({ error: 'Active interview session not found (it may have been finalized or the server restarted)' });

  try {
    const nextQuestion = await ctx.session.submitAnswer(content);
    if (nextQuestion === null) {
      res.json({ interview: ctx.session.interview, nextQuestion: null, done: false });
    } else {
      res.json({ interview: ctx.session.interview, nextQuestion, done: false });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/interviews/:id/finalize', async (req, res) => {
  const ctx = sessions.get(req.params.id);
  if (!ctx) return res.status(404).json({ error: 'Active interview session not found' });

  try {
    const evaluation = await ctx.session.finalize();
    const completedAt = nowIso();
    const finalInterview: Interview = {
      ...ctx.session.interview,
      status: 'completed',
      completedAt,
      evaluation,
    };
    await interviewStore.add(finalInterview);
    sessions.delete(req.params.id);
    // Update candidate status
    await candidateStore.update(ctx.candidate.id, { status: 'interviewing', updatedAt: completedAt });
    // Auto-generate notification
    if (finalInterview.evaluation) {
      notify({
        type: 'interview.completed',
        title: '✅ 面试完成',
        message: `${ctx.candidate.name} · ${finalInterview.position} · 评分 ${finalInterview.evaluation.overall} · ${finalInterview.evaluation.recommendation}`,
        link: '#/interviews',
      });
    }
    pluginManager.fireHook('interview.completed', finalInterview);
    res.json(finalInterview);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/interviews/:id', async (req, res) => {
  sessions.delete(req.params.id);
  const ok = await interviewStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Interview not found' });
  res.status(204).end();
});

// ============== Trainings ==============
app.get('/api/trainings', async (_req, res) => res.json(await trainingStore.list()));

app.post('/api/trainings', async (req, res) => {
  const body = req.body as Partial<Training>;
  if (!body.memberId || !body.skillId || !body.title) {
    return res.status(400).json({ error: 'memberId, skillId, title are required' });
  }
  const training: Training = {
    id: generateId('tr'),
    memberId: body.memberId,
    skillId: body.skillId,
    type: body.type ?? 'course',
    title: body.title,
    description: body.description ?? '',
    startDate: body.startDate ?? nowIso(),
    progress: body.progress ?? 0,
    status: body.status ?? 'planned',
    milestones: body.milestones ?? [],
    ...(body.endDate && { endDate: body.endDate }),
    ...(body.aiRecommended !== undefined && { aiRecommended: body.aiRecommended }),
  };
  const saved = await trainingStore.add(training);
  res.status(201).json(saved);
});

app.put('/api/trainings/:id', async (req, res) => {
  const updated = await trainingStore.update(req.params.id, req.body as Partial<Training>);
  if (!updated) return res.status(404).json({ error: 'Training not found' });
  res.json(updated);
});

// ============== Resume (PDF parse + LLM extract) ==============

app.post('/api/resume/parse', upload.single('file'), async (req, res) => {
  try {
    let text = '';
    if (req.file) {
      // PDF upload
      const buffer = req.file.buffer;
      // pdf-parse is CommonJS, use dynamic require
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (req.body.text) {
      text = String(req.body.text);
    } else {
      return res.status(400).json({ error: 'Either file or text is required' });
    }
    const agent = new ResumeAgent(llm);
    const extracted = await agent.extract(text);
    res.json({ rawTextLength: text.length, rawTextPreview: text.slice(0, 500), extracted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/resume/score', async (req, res) => {
  const { extracted, position, jobDescription } = req.body as {
    extracted?: any;
    position?: string;
    jobDescription?: string;
  };
  if (!extracted || !position) {
    return res.status(400).json({ error: 'extracted and position are required' });
  }
  try {
    const agent = new ResumeAgent(llm);
    const score = await agent.scoreMatch(extracted, jobDescription ?? position, position);
    res.json(score);
  } catch (err) {
    console.error('[score error]', err);
    res.status(500).json({ error: (err as Error).message, stack: (err as Error).stack });
  }
});

app.post('/api/resume/import', async (req, res) => {
  const { extracted, source } = req.body as { extracted?: any; source?: 'pdf' | 'pasted' };
  if (!extracted?.name || !extracted?.position) {
    return res.status(400).json({ error: 'extracted must have name and position' });
  }
  try {
    const agent = new ResumeAgent(llm);
    const candidate = agent.toCandidate(extracted, source ?? 'pasted');
    const saved = await candidateStore.add(candidate);
    pluginManager.fireHook('candidate.created', saved);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============== Plugins ==============
app.get('/api/plugins', (_req, res) => {
  res.json(pluginManager.list());
});

app.get('/api/plugins/hooks/events', (_req, res) => {
  res.json(HOOK_EVENTS);
});

app.get('/api/plugins/:id', (req, res) => {
  const cfg = pluginManager.get(req.params.id);
  if (!cfg) return res.status(404).json({ error: 'Plugin not found' });
  res.json(cfg);
});

app.post('/api/plugins', async (req, res) => {
  const body = req.body as Partial<PluginConfig>;
  if (!body.id || !body.manifest) {
    return res.status(400).json({ error: 'id and manifest are required' });
  }
  const cfg: PluginConfig = {
    id: body.id,
    manifest: body.manifest,
    enabled: body.enabled ?? true,
    config: body.config ?? {},
    installedAt: nowIso(),
  };
  await pluginManager.save(cfg);
  res.status(201).json(cfg);
});

app.put('/api/plugins/:id', async (req, res) => {
  const existing = pluginManager.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plugin not found' });
  const body = req.body as Partial<PluginConfig>;
  const updated: PluginConfig = {
    ...existing,
    manifest: body.manifest ?? existing.manifest,
    enabled: body.enabled ?? existing.enabled,
    config: body.config ?? existing.config,
  };
  await pluginManager.save(updated);
  res.json(updated);
});

app.post('/api/plugins/:id/toggle', async (req, res) => {
  const updated = await pluginManager.toggle(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Plugin not found' });
  res.json(updated);
});

app.post('/api/plugins/:id/config', async (req, res) => {
  const body = req.body as { config: Record<string, unknown> };
  const updated = await pluginManager.updateConfig(req.params.id, body.config ?? {});
  if (!updated) return res.status(404).json({ error: 'Plugin not found' });
  res.json(updated);
});

app.delete('/api/plugins/:id', async (req, res) => {
  const ok = await pluginManager.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Plugin not found' });
  res.status(204).end();
});

// ============== Notifications ==============
app.get('/api/notifications', async (_req, res) => {
  const list = await notificationStore.list().catch(() => []);
  res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.get('/api/notifications/unread/count', async (_req, res) => {
  const list = await notificationStore.list().catch(() => []);
  res.json({ count: list.filter((n) => !n.read).length });
});

app.post('/api/notifications/:id/read', async (req, res) => {
  const updated = await notificationStore.update(req.params.id, { read: true });
  if (!updated) return res.status(404).json({ error: 'Notification not found' });
  res.json(updated);
});

app.post('/api/notifications/read-all', async (_req, res) => {
  const list = await notificationStore.list().catch(() => []);
  for (const n of list.filter((x) => !x.read)) {
    await notificationStore.update(n.id, { read: true });
  }
  res.json({ ok: true });
});

app.delete('/api/notifications/:id', async (req, res) => {
  const ok = await notificationStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Notification not found' });
  res.status(204).end();
});

// ============== Export / Import ==============
function toCsv(rows: any[], columns: string[]): string {
  const escape = (v: any) => {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => escape(r[c])).join(','))].join('\n');
}

app.get('/api/export', async (req, res) => {
  const format = (req.query.format as string) ?? 'json';
  const [candidates, members, interviews, trainings, skills, reviews] = await Promise.all([
    candidateStore.list(),
    memberStore.list(),
    interviewStore.list(),
    trainingStore.list(),
    skillStore.list().catch(() => []),
    reviewStore.list().catch(() => []),
  ]);
  const generatedAt = nowIso();
  const data = { candidates, members, interviews, trainings, skills, reviews, generatedAt };

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="ai-team-export-${generatedAt.slice(0, 10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(data, null, 2));
  }

  if (format === 'csv') {
    const parts: string[] = [];
    if (candidates.length) parts.push(`# candidates\n${toCsv(candidates, ['id', 'name', 'position', 'source', 'status', 'email', 'createdAt'])}`);
    if (members.length) parts.push(`# members\n${toCsv(members, ['id', 'name', 'role', 'team', 'level', 'status', 'joinedAt'])}`);
    if (interviews.length) {
      const flat = interviews.map((i: any) => ({
        id: i.id,
        candidateId: i.candidateId,
        position: i.position,
        type: i.type,
        status: i.status,
        score: i.evaluation?.overall,
      }));
      parts.push(`# interviews\n${toCsv(flat, ['id', 'candidateId', 'position', 'type', 'status', 'score'])}`);
    }
    if (trainings.length) parts.push(`# trainings\n${toCsv(trainings, ['id', 'memberId', 'title', 'type', 'status', 'progress', 'startDate'])}`);
    if (reviews.length) parts.push(`# reviews\n${toCsv(reviews, ['id', 'memberId', 'period', 'rating', 'summary', 'reviewer', 'reviewedAt'])}`);
    res.setHeader('Content-Disposition', `attachment; filename="ai-team-export-${generatedAt.slice(0, 10)}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(parts.join('\n\n'));
  }

  if (format === 'md') {
    let md = `# ai-team 报告\n\n生成于: ${generatedAt}\n\n## 团队概览\n\n`;
    md += `- 成员数: ${members.length}\n- 候选人数: ${candidates.length}\n- 面试数: ${interviews.length}\n- 平均面试分: ${interviews.length ? Math.round(interviews.filter((i) => i.evaluation).reduce((s, i) => s + (i.evaluation?.overall ?? 0), 0) / Math.max(1, interviews.filter((i) => i.evaluation).length)) : 0}\n\n`;
    md += `## 最近面试\n\n| ID | 候选人 | 岗位 | 评分 | 推荐 |\n|---|---|---|---|---|\n`;
    md += interviews.slice(-10).map((i) => `| ${i.id} | ${i.candidateId.slice(-6)} | ${i.position} | ${i.evaluation?.overall ?? '-'} | ${i.evaluation?.recommendation ?? '-'} |`).join('\n');
    md += '\n\n## 成员\n\n';
    md += members.map((m) => `- **${m.name}** (${m.role}${m.level ? ` · ${m.level}` : ''}) - ${m.team} - ${m.status}`).join('\n');
    res.setHeader('Content-Disposition', `attachment; filename="ai-team-report-${generatedAt.slice(0, 10)}.md"`);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.send(md);
  }

  res.status(400).json({ error: 'format must be json, csv, or md' });
});

app.post('/api/import', upload.single('file'), async (req, res) => {
  const mode = (req.query.mode as string) ?? 'merge';
  if (mode !== 'merge' && mode !== 'replace') {
    return res.status(400).json({ error: 'mode must be merge or replace' });
  }
  let parsed: any;
  try {
    let text = '';
    if (req.file) {
      text = req.file.buffer.toString('utf-8');
    } else if (req.body.data) {
      text = String(req.body.data);
    } else {
      return res.status(400).json({ error: 'Either file or data is required' });
    }
    parsed = JSON.parse(text);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON: ' + (err as Error).message });
  }

  const imported = { candidates: 0, members: 0, interviews: 0, trainings: 0, skills: 0, reviews: 0 };
  try {
    if (mode === 'replace') {
      // Wipe existing
      for (const c of await candidateStore.list()) await candidateStore.remove(c.id);
      for (const m of await memberStore.list()) await memberStore.remove(m.id);
      for (const i of await interviewStore.list()) await interviewStore.remove(i.id);
      for (const t of await trainingStore.list()) await trainingStore.remove(t.id);
      for (const s of await skillStore.list()) await skillStore.remove(s.id);
      for (const r of await reviewStore.list()) await reviewStore.remove(r.id);
    }
    if (Array.isArray(parsed.candidates)) {
      for (const c of parsed.candidates) { await candidateStore.add(c); imported.candidates++; }
    }
    if (Array.isArray(parsed.members)) {
      for (const m of parsed.members) { await memberStore.add(m); imported.members++; }
    }
    if (Array.isArray(parsed.interviews)) {
      for (const i of parsed.interviews) { await interviewStore.add(i); imported.interviews++; }
    }
    if (Array.isArray(parsed.trainings)) {
      for (const t of parsed.trainings) { await trainingStore.add(t); imported.trainings++; }
    }
    if (Array.isArray(parsed.skills)) {
      for (const s of parsed.skills) { await skillStore.add(s); imported.skills++; }
    }
    if (Array.isArray(parsed.reviews)) {
      for (const r of parsed.reviews) { await reviewStore.add(r); imported.reviews++; }
    }
    res.json({ ok: true, mode, imported });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============== Reviews ==============
app.get('/api/reviews', async (_req, res) => res.json(await reviewStore.list().catch(() => [])));

app.get('/api/reviews/member/:memberId', async (req, res) => {
  const all = await reviewStore.list();
  res.json(all.filter((r) => r.memberId === req.params.memberId));
});

app.post('/api/reviews', async (req, res) => {
  const body = req.body as Partial<Review>;
  if (!body.memberId || !body.period || !body.rating) {
    return res.status(400).json({ error: 'memberId, period, rating are required' });
  }
  const review: Review = {
    id: generateId('rv'),
    memberId: body.memberId,
    period: body.period,
    rating: Math.max(1, Math.min(5, body.rating)) as Review['rating'],
    summary: body.summary ?? '',
    achievements: body.achievements ?? [],
    growthAreas: body.growthAreas ?? [],
    nextGoals: body.nextGoals ?? [],
    reviewedAt: nowIso(),
    ...(body.reviewer && { reviewer: body.reviewer }),
  };
  const saved = await reviewStore.add(review);
  res.status(201).json(saved);
});

app.put('/api/reviews/:id', async (req, res) => {
  const updated = await reviewStore.update(req.params.id, req.body as Partial<Review>);
  if (!updated) return res.status(404).json({ error: 'Review not found' });
  res.json(updated);
});

app.delete('/api/reviews/:id', async (req, res) => {
  const ok = await reviewStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Review not found' });
  res.status(204).end();
});

// ============== Review AI assist (draft generation) ==============
app.post('/api/performance-reviews/generate', async (req, res) => {
  const { memberId, period, reviewer } = req.body as { memberId?: string; period?: string; reviewer?: string };
  if (!memberId || !period) return res.status(400).json({ error: 'memberId and period are required' });
  const member = await memberStore.get(memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  try {
    const [allTrainings, allInterviews, allReviews] = await Promise.all([
      trainingStore.list(),
      interviewStore.list(),
      reviewStore.list(),
    ]);
    const agent = new ReviewAgent(llm);
    const draft = await agent.generateDraft({
      member,
      period,
      trainings: allTrainings,
      interviews: allInterviews,
      recentReviews: allReviews.filter((r) => r.memberId === memberId),
      ...(reviewer && { reviewer }),
    });
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============== 1:1 Conversation ==============
const oneOnOneSessions = new Map<string, { session: any; member: any }>();

app.post('/api/one-on-one/start', async (req, res) => {
  const { memberId, scenario, managerName } = req.body as { memberId?: string; scenario?: string; managerName?: string };
  if (!memberId) return res.status(400).json({ error: 'memberId is required' });
  const member = await memberStore.get(memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  try {
    const agent = new OneOnOneAgent(llm);
    const session = agent.start(member, { scenario: (scenario as any) ?? 'general', managerName: managerName ?? 'Manager' });
    const opening = await agent.openingMessage(session, member);
    oneOnOneSessions.set(session.id, { session, member });
    res.status(201).json({ session, openingMessage: opening });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/one-on-one/:id/respond', async (req, res) => {
  const { content } = req.body as { content?: string };
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  const ctx = oneOnOneSessions.get(req.params.id);
  if (!ctx) return res.status(404).json({ error: 'Session not found' });
  try {
    const agent = new OneOnOneAgent(llm);
    const response = await agent.respond(ctx.session, ctx.member, content);
    if (response === null) {
      res.json({ session: ctx.session, memberResponse: null, done: true });
    } else {
      res.json({ session: ctx.session, memberResponse: response, done: false });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/one-on-one/:id/finalize', async (req, res) => {
  const ctx = oneOnOneSessions.get(req.params.id);
  if (!ctx) return res.status(404).json({ error: 'Session not found' });
  try {
    const agent = new OneOnOneAgent(llm);
    const summary = await agent.generateSummary(ctx.session, ctx.member);
    ctx.session.summary = summary;
    oneOnOneSessions.delete(req.params.id);
    res.json({ session: ctx.session, summary });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============== Skills ==============
app.get('/api/skills', async (_req, res) => res.json(await skillStore.list().catch(() => [])));

// IMPORTANT: /graph must be before /:id route
app.get('/api/skills/graph', async (_req, res) => {
  const [members, skills] = await Promise.all([
    memberStore.list(),
    skillStore.list().catch(() => []),
  ]);
  const skillStats = new Map<string, { total: number; count: number; memberIds: string[] }>();
  for (const m of members) {
    for (const s of m.skills) {
      const cur = skillStats.get(s.skillId) ?? { total: 0, count: 0, memberIds: [] };
      cur.total += s.score;
      cur.count += 1;
      cur.memberIds.push(m.id);
      skillStats.set(s.skillId, cur);
    }
  }
  const skillNodes = skills.map((s) => {
    const stat = skillStats.get(s.id);
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      avgScore: stat ? Math.round(stat.total / stat.count) : 0,
      memberCount: stat?.count ?? 0,
    };
  });
  const memberNodes = members.map((m) => ({
    id: m.id,
    name: m.name,
    team: m.team,
    role: m.role,
    level: m.level ?? '',
    skillCount: m.skills.length,
  }));
  const links: Array<{ source: string; target: string; score: number }> = [];
  for (const m of members) {
    for (const s of m.skills) {
      links.push({ source: m.id, target: s.skillId, score: s.score });
    }
  }
  res.json({ skills: skillNodes, members: memberNodes, links });
});

app.get('/api/skills/:id', async (req, res) => {
  const s = await skillStore.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Skill not found' });
  res.json(s);
});

app.post('/api/skills', async (req, res) => {
  const body = req.body as Partial<Skill>;
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const skill: Skill = {
    id: body.id ?? generateId('sk'),
    name: body.name,
    category: body.category ?? 'technical',
    ...(body.description && { description: body.description }),
  };
  const saved = await skillStore.add(skill);
  res.status(201).json(saved);
});

// ============== Training Plan (AI generated) ==============
app.post('/api/training-plans/generate', async (req, res) => {
  const { memberId, targetRole, skills, weaknessAreas } = req.body as {
    memberId?: string;
    targetRole?: string;
    skills?: Array<{ name: string; score: number }>;
    weaknessAreas?: string[];
  };
  if (!memberId) return res.status(400).json({ error: 'memberId is required' });
  const member = await memberStore.get(memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  try {
    const agent = new TrainingAgent(llm);
    const trainings = await agent.generateTrainingRecords({
      member,
      targetRole: targetRole ?? member.role,
      skills: skills ?? [],
      weaknessAreas: weaknessAreas ?? [],
    });
    res.json({ trainings });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============== Error handling ==============
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

if (process.env.AI_TEAM_TEST !== '1') {
  app.listen(PORT, () => {
    console.log(`[ai-team-server] listening on http://localhost:${PORT}`);
    console.log(`[ai-team-server] data dir: ${DATA_DIR}`);
    console.log(`[ai-team-server] LLM: ${process.env.AI_TEAM_LLM_API_KEY ? 'configured' : 'mock (no API key set)'}`);
  });
}

export { app };
