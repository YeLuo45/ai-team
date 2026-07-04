// V143: Interview detail — resume viewing + multi-round grouping helpers
//
// Pure functions used by CandidateInterviewPanel / ResumeCard / RoundTabs to
// (a) group interviews by candidate, (b) assign round labels, (c) slice a
// resume string into sections, (d) summarize resume content, (e) format the
// round timeline. All helpers are deterministic and side-effect-free so they
// can be unit-tested in isolation and reused by the static data fallback.
//
// Lives under packages/ai-team-web/src/lib/ so vitest coverage tracks it
// (the components/ tree is excluded from coverage in vitest.config.ts).

import type { Candidate, Interview } from '@ai-team/core';

export interface InterviewGroup {
  candidate: Candidate | null;
  candidateId: string;
  candidateName: string;
  candidatePosition: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateResume?: string;
  candidateSkills: Array<{ skillId: string; score: number }>;
  candidateTags: string[];
  rounds: Array<Interview & { round: number }>;
}

export interface ResumeSection {
  heading: string;
  body: string;
}

export interface ResumeSummary {
  totalChars: number;
  bulletCount: number;
  lineCount: number;
  preview: string;
  sections: ResumeSection[];
}

/**
 * Group interviews by candidateId. Candidates that have no interview are
 * dropped — Interviews page is scoped to "people we have interviewed".
 * Within each group, rounds are sorted chronologically by startedAt (or
 * completedAt, then createdAt fallback) and assigned round = 1..N.
 */
export function groupInterviewsByCandidate(
  interviews: ReadonlyArray<Interview>,
  candidates: ReadonlyArray<Candidate> = [],
): InterviewGroup[] {
  const candidateById = new Map<string, Candidate>();
  for (const c of candidates) candidateById.set(c.id, c);

  // Group while preserving first-seen candidate order
  const grouped = new Map<string, Interview[]>();
  for (const iv of interviews) {
    const list = grouped.get(iv.candidateId) ?? [];
    list.push(iv);
    grouped.set(iv.candidateId, list);
  }

  const out: InterviewGroup[] = [];
  for (const [candidateId, list] of grouped) {
    const sorted = sortRoundsByTime(list);
    const rounds = sorted.map((iv, i) => Object.assign({}, iv, { round: i + 1 }));
    const candidate = candidateById.get(candidateId) ?? null;
    out.push({
      candidate,
      candidateId,
      candidateName: candidate?.name ?? candidateId,
      candidatePosition: candidate?.position ?? '',
      candidateEmail: candidate?.email,
      candidatePhone: candidate?.phone,
      candidateResume: candidate?.resume,
      candidateSkills: (candidate?.skills ?? []).map((s) => ({ skillId: s.skillId, score: s.score })),
      candidateTags: candidate?.tags ?? [],
      rounds,
    });
  }

  // Sort groups by the latest round's timestamp desc (most recent first)
  out.sort((a, b) => {
    const aTs = latestTimestamp(a.rounds);
    const bTs = latestTimestamp(b.rounds);
    return bTs.localeCompare(aTs);
  });
  return out;
}

/** Sort interviews by startedAt, falling back to completedAt, then id for stability. */
export function sortRoundsByTime(interviews: ReadonlyArray<Interview>): Interview[] {
  return [...interviews].sort((a, b) => {
    const aTs = a.startedAt ?? a.completedAt ?? '';
    const bTs = b.startedAt ?? b.completedAt ?? '';
    if (aTs !== bTs) return aTs.localeCompare(bTs);
    return a.id.localeCompare(b.id);
  });
}

/** Build a Chinese round label such as "一面" / "二面" / "三面" / "四面" ... up to "十面", then "第N面". */
export function buildRoundLabel(round: number): string {
  if (!Number.isFinite(round) || round < 1) return '第 ? 面';
  const single = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (round >= 1 && round <= 10) return `${single[round - 1]}面`;
  return `第 ${round} 面`;
}

/** Type label mapping — phone 初筛, technical 技术面, behavioral 行为面, etc. */
export function interviewTypeLabel(type: string | undefined): string {
  const map: Record<string, string> = {
    phone: '电话初筛',
    technical: '技术面',
    behavioral: '行为面',
    system_design: '系统设计',
    final: '终面',
    culture: '文化面',
  };
  if (type && map[type]) return map[type];
  if (type) return type;
  return '面试';
}

/**
 * Split a resume string into sections by `## heading` markers. If no markers
 * exist, return a single "全部" section. Empty / whitespace-only resumes
 * yield an empty list so callers can render a fallback state.
 */
export function extractResumeSections(resume: string | undefined | null): ResumeSection[] {
  if (!resume) return [];
  const text = resume.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const sections: ResumeSection[] = [];
  let currentHeading = '概况';
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (body) sections.push({ heading: currentHeading, body });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const headingMatch = line.match(/^#{1,3}\s+(.+?)\s*$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0) {
    sections.push({ heading: '简历', body: text });
  }
  return sections;
}

/**
 * Build a small summary of a resume: char count, bullet count, line count,
 * a truncated preview (≤ 160 chars), and the parsed sections. Used to render
 * a compact header in the resume card before the full text.
 */
export function summarizeResume(resume: string | undefined | null, previewLimit = 160): ResumeSummary {
  const text = (resume ?? '').replace(/\r\n/g, '\n');
  const trimmed = text.trim();
  const sections = extractResumeSections(resume);
  const bulletCount = trimmed ? (trimmed.match(/^\s*[-*•·]/gm) ?? []).length : 0;
  const lineCount = trimmed ? trimmed.split('\n').length : 0;
  const preview = trimmed.length <= previewLimit
    ? trimmed
    : trimmed.slice(0, previewLimit).trimEnd() + '…';
  return {
    totalChars: trimmed.length,
    bulletCount,
    lineCount,
    preview,
    sections,
  };
}

/** Format a round timeline line, e.g. "2026-06-21 · 完成 · 评分 86". */
export function formatRoundTimeline(round: Interview & { round: number }): string {
  const ts = round.completedAt ?? round.startedAt ?? '';
  const date = ts ? ts.slice(0, 10) : '—';
  const status = round.status === 'completed'
    ? '完成'
    : round.status === 'in_progress'
      ? '进行中'
      : round.status === 'scheduled'
        ? '已安排'
        : round.status === 'cancelled'
          ? '已取消'
          : '—';
  const score = round.evaluation?.overall != null ? ` · 评分 ${round.evaluation.overall}` : '';
  return `${date} · ${status}${score}`;
}

/** Round recommendation label — same wording as recommendationLabel but isolated for tests. */
export function roundRecommendation(recommendation: string | undefined): string {
  const map: Record<string, string> = {
    strong_hire: '强烈推荐',
    hire: '推荐',
    no_hire: '不推荐',
    strong_no_hire: '强烈不推荐',
  };
  return (recommendation && map[recommendation]) ?? '—';
}

export interface RoundsSparklinePoint {
  round: number;
  overall: number | null;
  technical: number | null;
  communication: number | null;
  problemSolving: number | null;
  culture: number | null;
}

/**
 * Build a series of per-round numeric points for the multi-round sparkline.
 * Rounds without an evaluation get null for every metric (rendered as a gap).
 */
export function buildRoundsSparkline(
  rounds: ReadonlyArray<Interview & { round: number }>,
): RoundsSparklinePoint[] {
  return rounds.map((r) => ({
    round: r.round,
    overall: r.evaluation?.overall ?? null,
    technical: r.evaluation?.breakdown.technical ?? null,
    communication: r.evaluation?.breakdown.communication ?? null,
    problemSolving: r.evaluation?.breakdown.problemSolving ?? null,
    culture: r.evaluation?.breakdown.culture ?? null,
  }));
}

export type SparklineMetric = 'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture';

export const SPARKLINE_METRICS: ReadonlyArray<{
  key: SparklineMetric;
  label: string;
  tone: string;
}> = [
  { key: 'overall',       label: '总评分',  tone: 'stroke-brand-500' },
  { key: 'technical',     label: '技术',    tone: 'stroke-emerald-500' },
  { key: 'communication', label: '沟通',    tone: 'stroke-violet-500' },
  { key: 'problemSolving',label: '解决问题',tone: 'stroke-amber-500' },
  { key: 'culture',       label: '文化契合',tone: 'stroke-sky-500' },
];

/**
 * Map a score (0-100) to an SVG y coordinate inside a chart with the given
 * height (default 60px). Higher scores appear higher (smaller y). NaN /
 * negative / >100 inputs are clamped.
 */
export function scoreToY(score: number | null | undefined, height = 60): number {
  if (score == null || Number.isNaN(score)) return height / 2; // mid-line for missing
  const clamped = Math.max(0, Math.min(100, score));
  return height - (clamped / 100) * height;
}

/** Build SVG path "d" attribute for a series of points. Returns empty string when fewer than 2 points. */
export function buildSparklinePath(
  points: ReadonlyArray<{ x: number; y: number }>,
): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

/** Compute evenly-spaced x coordinates for N points across a chart of given width. */
export function buildSparklineX(width: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [width / 2];
  const step = width / (count - 1);
  return Array.from({ length: count }, (_, i) => i * step);
}

/** Compute the latest timestamp string across a list of rounds. */
function latestTimestamp(rounds: ReadonlyArray<Interview>): string {
  let latest = '';
  for (const r of rounds) {
    const ts = r.completedAt ?? r.startedAt ?? '';
    if (ts && ts.localeCompare(latest) > 0) latest = ts;
  }
  return latest;
}

/** Whether a resume is rich enough to show a "view full" toggle (vs. inline). */
export function shouldCollapseResume(summary: ResumeSummary): boolean {
  return summary.totalChars > 280 || summary.sections.length > 1;
}

// ============================================================================
// V147: Comparison matrix helpers — group candidates by position and find
// the top-scorer per position for side-by-side evaluation comparison.
// ============================================================================

export type ComparisonMetricKey = 'overall' | 'technical' | 'communication' | 'problemSolving' | 'culture';

export interface CandidateComparisonRow {
  candidateId: string;
  candidateName: string;
  candidatePosition: string;
  rounds: ReadonlyArray<Interview & { round: number }>;
  /** Highest overall score across the candidate's rounds (null when no evaluations). */
  bestOverall: number | null;
  /** Average overall score across the candidate's rounds. */
  avgOverall: number | null;
  /** Number of rounds with completed evaluation. */
  evaluatedRounds: number;
  /** Per-metric best scores across rounds. Used by V149 metric switcher. */
  bestByMetric: Record<ComparisonMetricKey, number | null>;
  /** Per-metric average scores across rounds. */
  avgByMetric: Record<ComparisonMetricKey, number | null>;
}

export interface PositionComparisonGroup {
  position: string;
  rows: CandidateComparisonRow[];
  /** Top scorer (highest bestOverall) within the position. null when nobody has been evaluated. */
  topScorerId: string | null;
}

/**
 * Group comparison rows by position and pick the top scorer for each. Rows
 * within a group are sorted by bestOverall desc, then by candidateName asc
 * for stable order.
 */
export function groupComparisonByPosition(
  rows: ReadonlyArray<CandidateComparisonRow>,
): PositionComparisonGroup[] {
  const byPos = new Map<string, CandidateComparisonRow[]>();
  for (const row of rows) {
    const list = byPos.get(row.candidatePosition) ?? [];
    list.push(row);
    byPos.set(row.candidatePosition, list);
  }

  const groups: PositionComparisonGroup[] = [];
  for (const [position, list] of byPos) {
    const sorted = [...list].sort((a, b) => {
      const av = a.bestOverall ?? -Infinity;
      const bv = b.bestOverall ?? -Infinity;
      if (bv !== av) return bv - av;
      return a.candidateName.localeCompare(b.candidateName);
    });
    const topScorer = sorted.find((r) => r.bestOverall != null);
    groups.push({
      position,
      rows: sorted,
      topScorerId: topScorer?.candidateId ?? null,
    });
  }

  // Sort groups by number of evaluated rounds desc, then by position asc
  groups.sort((a, b) => {
    const ae = a.rows.reduce((acc, r) => acc + r.evaluatedRounds, 0);
    const be = b.rows.reduce((acc, r) => acc + r.evaluatedRounds, 0);
    if (be !== ae) return be - ae;
    return a.position.localeCompare(b.position);
  });
  return groups;
}

/** Compute a CandidateComparisonRow from InterviewGroup-shaped data. */
export function buildCandidateComparisonRow(
  candidateId: string,
  candidateName: string,
  candidatePosition: string,
  rounds: ReadonlyArray<Interview & { round: number }>,
): CandidateComparisonRow {
  const evaluated = rounds.filter((r) => r.evaluation != null);
  const overalls = evaluated
    .map((r) => r.evaluation?.overall ?? null)
    .filter((v): v is number => v != null);
  const bestOverall = overalls.length > 0 ? Math.max(...overalls) : null;
  const avgOverall =
    overalls.length > 0
      ? Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10
      : null;

  // V149: per-metric stats
  const bestByMetric: Record<ComparisonMetricKey, number | null> = {
    overall: bestOverall,
    technical: null,
    communication: null,
    problemSolving: null,
    culture: null,
  };
  const avgByMetric: Record<ComparisonMetricKey, number | null> = {
    overall: avgOverall,
    technical: null,
    communication: null,
    problemSolving: null,
    culture: null,
  };

  const metricKeys: ComparisonMetricKey[] = ['overall', 'technical', 'communication', 'problemSolving', 'culture'];
  for (const key of metricKeys) {
    const values = evaluated
      .map((r) => (key === 'overall' ? r.evaluation?.overall : r.evaluation?.breakdown[key]) ?? null)
      .filter((v): v is number => v != null);
    bestByMetric[key] = values.length > 0 ? Math.max(...values) : null;
    avgByMetric[key] =
      values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : null;
  }

  return {
    candidateId,
    candidateName,
    candidatePosition,
    rounds,
    bestOverall,
    avgOverall,
    evaluatedRounds: evaluated.length,
    bestByMetric,
    avgByMetric,
  };
}

/** Extract just the numeric series for a given metric across rounds (null for missing). */
export function metricSeries(
  rounds: ReadonlyArray<Interview & { round: number }>,
  metric: ComparisonMetricKey,
): Array<number | null> {
  return rounds.map((r) => {
    if (r.evaluation == null) return null;
    return metric === 'overall' ? r.evaluation.overall : r.evaluation.breakdown[metric];
  });
}