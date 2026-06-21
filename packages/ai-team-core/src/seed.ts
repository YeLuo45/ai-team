// V24: Demo 数据工厂 — 一键生成不同规模团队/候选人/面试/技能/培训数据

import type { Candidate } from './types/candidate.js';
import type { Member } from './types/member.js';
import type { Skill, SkillScore } from './types/skill.js';
import type { Training } from './types/training.js';
import type { Review } from './types/review.js';
import type { Interview } from './types/interview.js';

export type SeedSize = 'small' | 'medium' | 'large';

export interface SeedSizeSpec {
  candidates: number;
  members: number;
  skills: number;
  interviews: number;
  trainings: number;
  reviews: number;
}

export const SEED_SIZE_SPECS: Record<SeedSize, SeedSizeSpec> = {
  small:  { candidates: 4,  members: 2, skills: 4, interviews: 2, trainings: 2, reviews: 2 },
  medium: { candidates: 12, members: 6, skills: 6, interviews: 6, trainings: 4, reviews: 4 },
  large:  { candidates: 30, members: 15, skills: 8, interviews: 12, trainings: 8, reviews: 8 },
};

export interface SeededDataset {
  candidates: Candidate[];
  members: Member[];
  skills: Skill[];
  interviews: Interview[];
  trainings: Training[];
  reviews: Review[];
}

const SKILL_TEMPLATES: Array<{ name: string; category: Skill['category'] }> = [
  { name: 'TypeScript', category: 'technical' },
  { name: 'React', category: 'technical' },
  { name: 'Node.js', category: 'technical' },
  { name: 'Python', category: 'technical' },
  { name: 'A11y', category: 'domain' },
  { name: 'System Design', category: 'domain' },
  { name: 'Mentoring', category: 'soft' },
  { name: 'Git', category: 'tool' },
];

const TEAMS = ['Platform', 'Web', 'Mobile', 'Data', 'DevOps'];
const ROLES = ['Engineer', 'Senior Engineer', 'Tech Lead', 'Manager'];
const LEVELS: Array<Member['level']> = ['P4', 'P5', 'P6', 'P7', 'P8'];
const POSITIONS = ['Frontend Engineer', 'Backend Engineer', 'Full-stack Engineer', 'SRE', 'Data Engineer'];
const SOURCES: Candidate['source'][] = ['linkedin', 'referral', 'website', 'recruiter', 'job_board', 'other'];
const CANDIDATE_STATUSES: Candidate['status'][] = ['new', 'screening', 'interviewing', 'offer', 'hired', 'rejected'];

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

function randInt(seed: number, min: number, max: number): number {
  const span = max - min + 1;
  return ((seed * 9301 + 49297) % 233280) % span + min;
}

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function makeId(prefix: string, i: number): string {
  return `${prefix}_${Date.now().toString(36)}_${i.toString(36)}`;
}

/** 生成候选人名单 */
export function generateCandidates(n: number, seed = 1): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < n; i++) {
    const position = pick(POSITIONS, i);
    const source = pick(SOURCES, i + seed);
    const status = pick(CANDIDATE_STATUSES, i + seed + 2);
    out.push({
      id: makeId('ct', i),
      name: `Candidate ${i + 1}`,
      position,
      source,
      status,
      email: `c${i + 1}@example.com`,
      createdAt: isoNow(-randInt(seed + i, 1, 30) * 86_400_000),
      updatedAt: isoNow(),
      tags: [position.toLowerCase().replace(/\W+/g, '-'), source],
      ...(i % 2 === 0 ? { phone: `+1-555-${String(100 + i).padStart(4, '0')}` } : {}),
    });
  }
  return out;
}

/** 生成技能清单 */
export function generateSkills(n: number): Skill[] {
  const out: Skill[] = [];
  for (let i = 0; i < Math.min(n, SKILL_TEMPLATES.length); i++) {
    out.push({
      id: makeId('sk', i),
      name: SKILL_TEMPLATES[i].name,
      category: SKILL_TEMPLATES[i].category,
      description: `${SKILL_TEMPLATES[i].name} 能力评估`,
    });
  }
  return out;
}

/** 生成成员 */
export function generateMembers(n: number, skills: Skill[], seed = 1): Member[] {
  const out: Member[] = [];
  for (let i = 0; i < n; i++) {
    const team = pick(TEAMS, i + seed);
    const role = pick(ROLES, i + seed + 1);
    const memberSkills: SkillScore[] = skills
      .filter((_, idx) => (idx + i) % 2 === 0 || idx % 3 === 0)
      .map((s) => ({
        skillId: s.id,
        score: randInt(seed + i + s.name.length, 30, 95),
        assessedAt: isoNow(-randInt(seed + i, 30, 365) * 86_400_000),
      }));
    out.push({
      id: makeId('mb', i),
      name: `Member ${i + 1}`,
      team,
      role,
      level: pick(LEVELS, i + seed),
      joinedAt: isoNow(-randInt(seed + i, 30, 720) * 86_400_000),
      skills: memberSkills,
      trainings: [],
      reviews: [],
      status: i % 7 === 6 ? 'on_leave' : 'active',
      ...(i % 2 === 0 ? { bio: `${team} ${role}` } : {}),
    });
  }
  return out;
}

/** 生成面试 */
export function generateInterviews(n: number, candidates: Candidate[], seed = 1): Interview[] {
  const out: Interview[] = [];
  const subset = candidates.slice(0, Math.min(n, candidates.length));
  for (let i = 0; i < subset.length; i++) {
    const status = i % 4 === 0 ? 'in_progress' : i % 3 === 0 ? 'completed' : 'scheduled';
    const turns = i % 3 === 0 ? [
      { role: 'interviewer' as const, content: '请自我介绍', timestamp: isoNow(-86_400_000) },
      { role: 'candidate' as const, content: '3 年 React 经验', timestamp: isoNow() },
    ] : [];
    out.push({
      id: makeId('iv', i),
      candidateId: subset[i].id,
      position: subset[i].position,
      type: pick(['phone', 'technical', 'behavioral', 'final'] as const, i + seed),
      status,
      turns,
      aiConducted: true,
      interviewerName: 'AI',
      startedAt: isoNow(-randInt(seed + i, 1, 30) * 86_400_000),
      ...(i % 3 === 0 ? { completedAt: isoNow(-randInt(seed + i, 0, 5) * 86_400_000) } : {}),
    });
  }
  return out;
}

/** 生成培训 */
export function generateTrainings(n: number, members: Member[], seed = 1): Training[] {
  const out: Training[] = [];
  for (let i = 0; i < Math.min(n, members.length); i++) {
    const progress = randInt(seed + i, 0, 100);
    out.push({
      id: makeId('tr', i),
      memberId: members[i].id,
      skillId: `sk_seed_${i % 4}`,
      type: pick(['course', 'mentoring', 'project', 'certification'] as const, i + seed),
      title: pick(['System Design 进阶', 'React 性能优化', 'TypeScript 高级类型', '团队管理'], i + seed),
      description: `培训 #${i + 1}`,
      startDate: isoNow(-randInt(seed + i, 7, 90) * 86_400_000),
      progress,
      status: progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'planned',
      milestones: [],
    });
  }
  return out;
}

/** 生成 Review */
export function generateReviews(n: number, members: Member[], seed = 1): Review[] {
  const out: Review[] = [];
  for (let i = 0; i < Math.min(n, members.length); i++) {
    const rating = (Math.max(1, Math.min(5, randInt(seed + i, 3, 5))) as 1 | 2 | 3 | 4 | 5);
    out.push({
      id: makeId('rv', i),
      memberId: members[i].id,
      period: `2026-Q${(i % 4) + 1}`,
      rating,
      summary: pick(['表现出色', '稳步成长', '超出预期'], i + seed),
      achievements: [`达成目标 ${i + 1}`],
      growthAreas: ['需要提升 X'],
      nextGoals: [`继续 Y`],
      reviewedAt: isoNow(-randInt(seed + i, 7, 365) * 86_400_000),
    });
  }
  return out;
}

/**
 * 一站式生成完整 demo 数据集。
 */
export function generateSeed(size: SeedSize = 'medium', seed = 1): SeededDataset {
  const spec = SEED_SIZE_SPECS[size];
  const skills = generateSkills(spec.skills);
  const candidates = generateCandidates(spec.candidates, seed);
  const members = generateMembers(spec.members, skills, seed);
  const interviews = generateInterviews(spec.interviews, candidates, seed);
  const trainings = generateTrainings(spec.trainings, members, seed);
  const reviews = generateReviews(spec.reviews, members, seed);
  return { candidates, members, skills, interviews, trainings, reviews };
}