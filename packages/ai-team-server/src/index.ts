// Express server entry — REST API + LLM proxy
// Reuses @ai-team/core for storage, @ai-team/agent for interview orchestration

import express from 'express';
import cors from 'cors';
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
import { InterviewAgent, TrainingAgent } from '@ai-team/agent';

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

// LLM client
const llm = createFromEnv();

// ============== Health ==============
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', dataDir: DATA_DIR, llmProvider: process.env.AI_TEAM_LLM_API_KEY ? 'configured' : 'mock' });
});

// ============== Team bulk ==============
app.get('/api/team', async (_req, res) => {
  const [candidates, members, interviews, trainings, skills] = await Promise.all([
    candidateStore.list(),
    memberStore.list(),
    interviewStore.list(),
    trainingStore.list(),
    skillStore.list().catch(() => []),
  ]);
  res.json({ candidates, members, interviews, trainings, skills, generatedAt: nowIso() });
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

app.listen(PORT, () => {
  console.log(`[ai-team-server] listening on http://localhost:${PORT}`);
  console.log(`[ai-team-server] data dir: ${DATA_DIR}`);
  console.log(`[ai-team-server] LLM: ${process.env.AI_TEAM_LLM_API_KEY ? 'configured' : 'mock (no API key set)'}`);
});
