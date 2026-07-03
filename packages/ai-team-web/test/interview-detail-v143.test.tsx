// V143: Interview detail — resume viewing + multi-round grouping tests
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import type { Candidate, Interview } from '@ai-team/core';
import {
  groupInterviewsByCandidate,
  extractResumeSections,
  formatRoundTimeline,
  interviewTypeLabel,
  ResumeCard,
  ResumeSection,
  ResumeSummary,
  roundRecommendation,
  RoundTabs,
  shouldCollapseResume,
  sortRoundsByTime,
  summarizeResume,
} from '../src/components/interview/index.js';
import { Interviews } from '../src/pages/Interviews.js';
import {
  buildRoundLabel,
  CandidateInterviewPanel,
} from '../src/components/interview/index.js';

vi.mock('../src/lib/hooks.js', () => ({
  useTeamData: vi.fn(),
}));

const { useTeamData } = await import('../src/lib/hooks.js');

// ---------------- fixtures ----------------

const sampleResume = [
  '## 基本信息',
  '张三 · 5 年前端开发 · 北京',
  '',
  '## 工作经历',
  '- 字节跳动 · 高级前端工程师 · 2022 - 至今',
  '- 美团 · 前端工程师 · 2020 - 2022',
  '',
  '## 项目亮点',
  '- 负责抖音创作者平台重构，组件复用率提升 40%',
  '- 主导美团外卖商家端性能优化，首屏从 2.4s 降至 1.1s',
  '',
  '## 技能清单',
  '- React / TypeScript / Vite / Vitest',
  '- Node.js / Express / MySQL',
].join('\n');

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: overrides.id ?? 'ct_a',
    name: overrides.name ?? '张三',
    position: overrides.position ?? '前端工程师',
    source: overrides.source ?? 'linkedin',
    status: overrides.status ?? 'interviewing',
    createdAt: overrides.createdAt ?? '2026-06-21T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-06-21T00:00:00Z',
    email: overrides.email ?? 'zhangsan@example.com',
    phone: overrides.phone ?? '+86-138-0000-0001',
    tags: overrides.tags ?? ['React', 'TypeScript'],
    skills: overrides.skills ?? [
      { skillId: 'sk_react', score: 90, assessedAt: '2026-06-21T00:00:00Z' },
      { skillId: 'sk_node', score: 75, assessedAt: '2026-06-21T00:00:00Z' },
    ],
    resume: overrides.resume ?? sampleResume,
    notes: overrides.notes,
  };
}

function makeInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: overrides.id ?? 'iv_1',
    candidateId: overrides.candidateId ?? 'ct_a',
    position: overrides.position ?? '前端工程师',
    type: overrides.type ?? 'phone',
    status: overrides.status ?? 'completed',
    turns: overrides.turns ?? [],
    aiConducted: overrides.aiConducted ?? true,
    interviewerName: overrides.interviewerName ?? 'AI',
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    scheduledAt: overrides.scheduledAt,
    evaluation: overrides.evaluation,
  };
}

const evalA = {
  overall: 82,
  breakdown: { technical: 85, communication: 78, problemSolving: 80, culture: 86 },
  strengths: ['React 熟练', '系统设计清晰'],
  concerns: ['算法基础一般'],
  recommendation: 'hire' as const,
  summary: '总体推荐',
  evaluatedAt: '2026-06-21T01:00:00Z',
};

const evalB = {
  overall: 74,
  breakdown: { technical: 70, communication: 80, problemSolving: 76, culture: 70 },
  strengths: ['沟通好'],
  concerns: ['深度欠缺'],
  recommendation: 'hire' as const,
  summary: '建议进入下一轮',
  evaluatedAt: '2026-06-21T03:00:00Z',
};

const evalC = {
  overall: 88,
  breakdown: { technical: 90, communication: 86, problemSolving: 88, culture: 88 },
  strengths: ['架构能力突出'],
  concerns: [],
  recommendation: 'strong_hire' as const,
  summary: '强烈推荐',
  evaluatedAt: '2026-06-21T05:00:00Z',
};

// ---------------- helpers ----------------

describe('interview-helpers: buildRoundLabel', () => {
  it('returns Chinese labels for rounds 1-10', () => {
    expect(buildRoundLabel(1)).toBe('一面');
    expect(buildRoundLabel(2)).toBe('二面');
    expect(buildRoundLabel(3)).toBe('三面');
    expect(buildRoundLabel(4)).toBe('四面');
    expect(buildRoundLabel(5)).toBe('五面');
    expect(buildRoundLabel(10)).toBe('十面');
  });
  it('falls back to "第 N 面" for rounds beyond 10', () => {
    expect(buildRoundLabel(11)).toBe('第 11 面');
    expect(buildRoundLabel(99)).toBe('第 99 面');
  });
  it('handles invalid input safely', () => {
    expect(buildRoundLabel(0)).toBe('第 ? 面');
    expect(buildRoundLabel(-1)).toBe('第 ? 面');
    expect(buildRoundLabel(Number.NaN)).toBe('第 ? 面');
  });
});

describe('interview-helpers: interviewTypeLabel', () => {
  it('maps known interview types to Chinese labels', () => {
    expect(interviewTypeLabel('phone')).toBe('电话初筛');
    expect(interviewTypeLabel('technical')).toBe('技术面');
    expect(interviewTypeLabel('behavioral')).toBe('行为面');
    expect(interviewTypeLabel('system_design')).toBe('系统设计');
    expect(interviewTypeLabel('final')).toBe('终面');
    expect(interviewTypeLabel('culture')).toBe('文化面');
  });
  it('falls back to raw type or "面试"', () => {
    expect(interviewTypeLabel('mystery')).toBe('mystery');
    expect(interviewTypeLabel(undefined)).toBe('面试');
    expect(interviewTypeLabel('')).toBe('面试');
  });
});

describe('interview-helpers: sortRoundsByTime', () => {
  it('sorts by startedAt ascending', () => {
    const rounds = [
      makeInterview({ id: 'iv_3', startedAt: '2026-06-21T03:00:00Z' }),
      makeInterview({ id: 'iv_1', startedAt: '2026-06-21T01:00:00Z' }),
      makeInterview({ id: 'iv_2', startedAt: '2026-06-21T02:00:00Z' }),
    ];
    const out = sortRoundsByTime(rounds);
    expect(out.map((r) => r.id)).toEqual(['iv_1', 'iv_2', 'iv_3']);
  });
  it('falls back to completedAt when startedAt missing', () => {
    const rounds = [
      makeInterview({ id: 'iv_no_start', completedAt: '2026-06-21T05:00:00Z' }),
      makeInterview({ id: 'iv_start', startedAt: '2026-06-21T01:00:00Z' }),
    ];
    const out = sortRoundsByTime(rounds);
    expect(out[0].id).toBe('iv_start');
    expect(out[1].id).toBe('iv_no_start');
  });
  it('uses id as tie-breaker', () => {
    const rounds = [
      makeInterview({ id: 'iv_b', startedAt: '2026-06-21T01:00:00Z' }),
      makeInterview({ id: 'iv_a', startedAt: '2026-06-21T01:00:00Z' }),
    ];
    expect(sortRoundsByTime(rounds).map((r) => r.id)).toEqual(['iv_a', 'iv_b']);
  });
  it('handles interviews with no startedAt and no completedAt', () => {
    const rounds = [
      makeInterview({ id: 'iv_empty', startedAt: undefined, completedAt: undefined }),
      makeInterview({ id: 'iv_with', startedAt: '2026-06-21T01:00:00Z' }),
    ];
    const out = sortRoundsByTime(rounds);
    // Empty timestamps sort before populated ones ('' < '2026-...')
    expect(out[0].id).toBe('iv_empty');
    expect(out[1].id).toBe('iv_with');
    // An all-empty-timestamp list sorts stably by id
    const bothEmpty = [
      makeInterview({ id: 'iv_b', startedAt: undefined, completedAt: undefined }),
      makeInterview({ id: 'iv_a', startedAt: undefined, completedAt: undefined }),
    ];
    expect(sortRoundsByTime(bothEmpty).map((r) => r.id)).toEqual(['iv_a', 'iv_b']);
  });
});

describe('interview-helpers: extractResumeSections', () => {
  it('parses ## headings into sections', () => {
    const sections = extractResumeSections(sampleResume);
    expect(sections.map((s: ResumeSection) => s.heading)).toEqual([
      '基本信息',
      '工作经历',
      '项目亮点',
      '技能清单',
    ]);
    expect(sections[0].body).toContain('5 年前端开发');
    expect(sections[2].body).toContain('组件复用率');
  });
  it('returns a single section when no headings present', () => {
    const sections = extractResumeSections('hello\nworld');
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toContain('hello');
  });
  it('handles empty / undefined / whitespace input', () => {
    expect(extractResumeSections(undefined)).toEqual([]);
    expect(extractResumeSections(null)).toEqual([]);
    expect(extractResumeSections('')).toEqual([]);
    expect(extractResumeSections('   \n  ')).toEqual([]);
  });
  it('normalizes \\r\\n line endings', () => {
    const sections = extractResumeSections('## A\r\nline1\r\nline2\r\n## B\r\nb1');
    expect(sections).toHaveLength(2);
    expect(sections[0].body).toBe('line1\nline2');
    expect(sections[1].body).toBe('b1');
  });
  it('falls back to a single "简历" section when only headings appear (no body lines)', () => {
    const sections = extractResumeSections('## A\n## B\n');
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('简历');
    expect(sections[0].body).toContain('## A');
    expect(sections[0].body).toContain('## B');
  });
});

describe('interview-helpers: summarizeResume', () => {
  it('reports char count, bullet count, line count, preview', () => {
    const summary = summarizeResume(sampleResume);
    expect(summary.totalChars).toBe(sampleResume.trim().length);
    expect(summary.bulletCount).toBeGreaterThanOrEqual(5);
    expect(summary.lineCount).toBeGreaterThan(10);
    expect(summary.preview).toContain('基本信息');
    expect(summary.sections).toHaveLength(4);
  });
  it('truncates preview at previewLimit', () => {
    const long = 'x'.repeat(500);
    const summary = summarizeResume(long, 50);
    expect(summary.preview.length).toBeLessThanOrEqual(51); // 50 + ellipsis
    expect(summary.preview.endsWith('…')).toBe(true);
  });
  it('handles empty resume', () => {
    const summary = summarizeResume('');
    expect(summary.totalChars).toBe(0);
    expect(summary.bulletCount).toBe(0);
    expect(summary.lineCount).toBe(0);
    expect(summary.preview).toBe('');
    expect(summary.sections).toEqual([]);
  });
  it('counts bullet markers across dashes / asterisks / middots', () => {
    const summary = summarizeResume('- a\n* b\n• c\n· d');
    expect(summary.bulletCount).toBe(4);
  });
});

describe('interview-helpers: formatRoundTimeline', () => {
  it('renders completed round with date and score', () => {
    const r = makeInterview({ id: 'iv_1', completedAt: '2026-06-21T01:00:00Z', evaluation: evalA });
    const timeline = formatRoundTimeline(r as Interview & { round: number });
    expect(timeline).toContain('2026-06-21');
    expect(timeline).toContain('完成');
    expect(timeline).toContain('评分 82');
  });
  it('handles in_progress / scheduled / cancelled / no-evaluation', () => {
    expect(formatRoundTimeline({ ...makeInterview({ status: 'in_progress', startedAt: '2026-06-21T01:00:00Z' }), round: 1 })).toContain('进行中');
    expect(formatRoundTimeline({ ...makeInterview({ status: 'scheduled', scheduledAt: '2026-06-21T01:00:00Z' }), round: 1 })).toContain('已安排');
    expect(formatRoundTimeline({ ...makeInterview({ status: 'cancelled' }), round: 1 })).toContain('已取消');
    expect(formatRoundTimeline({ ...makeInterview({ status: 'completed' }), round: 1 })).not.toContain('评分');
  });
  it('uses em-dash when no timestamps available', () => {
    const r = { ...makeInterview({ id: 'iv_x' }), round: 1 };
    expect(formatRoundTimeline(r)).toContain('—');
  });
  it('handles an unknown status with the default em-dash label', () => {
    const r = { ...makeInterview({ id: 'iv_unknown', status: 'something_else' as unknown as Interview['status'], startedAt: '2026-06-21T01:00:00Z' }), round: 1 };
    expect(formatRoundTimeline(r)).toContain('—');
  });
});

describe('interview-helpers: roundRecommendation', () => {
  it('maps known recommendations to Chinese', () => {
    expect(roundRecommendation('strong_hire')).toBe('强烈推荐');
    expect(roundRecommendation('hire')).toBe('推荐');
    expect(roundRecommendation('no_hire')).toBe('不推荐');
    expect(roundRecommendation('strong_no_hire')).toBe('强烈不推荐');
  });
  it('returns em-dash for unknown / undefined', () => {
    expect(roundRecommendation(undefined)).toBe('—');
    expect(roundRecommendation('unknown')).toBe('—');
  });
});

describe('interview-helpers: shouldCollapseResume', () => {
  it('collapses long resumes or multi-section resumes', () => {
    const longSummary: ResumeSummary = {
      totalChars: 500,
      bulletCount: 0,
      lineCount: 10,
      preview: '',
      sections: [],
    };
    expect(shouldCollapseResume(longSummary)).toBe(true);

    const multiSection: ResumeSummary = {
      totalChars: 100,
      bulletCount: 0,
      lineCount: 5,
      preview: '',
      sections: [
        { heading: 'A', body: 'x' },
        { heading: 'B', body: 'y' },
      ],
    };
    expect(shouldCollapseResume(multiSection)).toBe(true);
  });
  it('does not collapse short single-section resumes', () => {
    const summary: ResumeSummary = {
      totalChars: 100,
      bulletCount: 0,
      lineCount: 3,
      preview: '',
      sections: [{ heading: 'A', body: 'x' }],
    };
    expect(shouldCollapseResume(summary)).toBe(false);
  });
});

describe('interview-helpers: groupInterviewsByCandidate', () => {
  it('groups by candidateId and assigns round numbers chronologically', () => {
    const candidate = makeCandidate();
    const interviews = [
      makeInterview({ id: 'iv_b', candidateId: candidate.id, type: 'technical', startedAt: '2026-06-21T03:00:00Z', completedAt: '2026-06-21T04:00:00Z', evaluation: evalB }),
      makeInterview({ id: 'iv_a', candidateId: candidate.id, type: 'phone', startedAt: '2026-06-21T01:00:00Z', completedAt: '2026-06-21T02:00:00Z', evaluation: evalA }),
      makeInterview({ id: 'iv_c', candidateId: candidate.id, type: 'final', startedAt: '2026-06-21T05:00:00Z', completedAt: '2026-06-21T06:00:00Z', evaluation: evalC }),
    ];
    const groups = groupInterviewsByCandidate(interviews, [candidate]);
    expect(groups).toHaveLength(1);
    expect(groups[0].candidateId).toBe(candidate.id);
    expect(groups[0].candidateName).toBe('张三');
    expect(groups[0].candidateResume).toBe(sampleResume);
    expect(groups[0].candidateTags).toEqual(['React', 'TypeScript']);
    expect(groups[0].candidateSkills).toEqual([
      { skillId: 'sk_react', score: 90 },
      { skillId: 'sk_node', score: 75 },
    ]);
    expect(groups[0].rounds.map((r) => r.round)).toEqual([1, 2, 3]);
    expect(groups[0].rounds.map((r) => r.id)).toEqual(['iv_a', 'iv_b', 'iv_c']);
  });

  it('returns placeholder candidate info when candidate not found', () => {
    const interviews = [makeInterview({ id: 'iv_orphan', candidateId: 'ct_missing' })];
    const groups = groupInterviewsByCandidate(interviews, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].candidate).toBeNull();
    expect(groups[0].candidateName).toBe('ct_missing');
    expect(groups[0].candidateResume).toBeUndefined();
  });

  it('sorts groups by latest round timestamp desc', () => {
    const ca = makeCandidate({ id: 'ct_a', name: 'A' });
    const cb = makeCandidate({ id: 'ct_b', name: 'B' });
    const interviews = [
      makeInterview({ id: 'iv_a', candidateId: ca.id, completedAt: '2026-06-21T01:00:00Z' }),
      makeInterview({ id: 'iv_b', candidateId: cb.id, completedAt: '2026-06-21T05:00:00Z' }),
    ];
    const groups = groupInterviewsByCandidate(interviews, [ca, cb]);
    expect(groups[0].candidateId).toBe('ct_b');
    expect(groups[1].candidateId).toBe('ct_a');
  });

  it('returns empty array when no interviews', () => {
    expect(groupInterviewsByCandidate([], [])).toEqual([]);
  });
});

// ---------------- UI: ResumeCard ----------------

describe('ResumeCard UI', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it('renders resume preview + skills + tags', () => {
    const candidate = makeCandidate();
    render(
      <ResumeCard
        candidateName={candidate.name}
        candidatePosition={candidate.position}
        candidateEmail={candidate.email}
        candidatePhone={candidate.phone}
        candidateTags={candidate.tags!}
        candidateSkills={candidate.skills!.map((s) => ({ skillId: s.skillId, score: s.score }))}
        resume={candidate.resume}
      />,
    );

    expect(screen.getByTestId('resume-card')).toBeTruthy();
    expect(screen.getByText('候选人简历')).toBeTruthy();
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('sk_react · 90')).toBeTruthy();
    expect(screen.getByText('TypeScript')).toBeTruthy();
    expect(screen.getByTestId('resume-preview').textContent).toContain('基本信息');
    expect(screen.getByTestId('resume-stats').textContent).toMatch(/字 · .* 项 · .* 行/);
  });

  it('shows empty state when resume missing', () => {
    render(
      <ResumeCard
        candidateName="李四"
        candidatePosition="DevOps"
        candidateEmail={undefined}
        candidatePhone={undefined}
        candidateTags={[]}
        candidateSkills={[]}
        resume={undefined}
      />,
    );
    expect(screen.getByTestId('resume-empty')).toBeTruthy();
    expect(screen.getByTestId('resume-empty').textContent).toContain('暂未上传');
  });

  it('toggles expanded full-text sections', () => {
    render(
      <ResumeCard
        candidateName="张三"
        candidatePosition="前端"
        candidateTags={[]}
        candidateSkills={[]}
        resume={sampleResume}
      />,
    );
    expect(screen.queryByTestId('resume-full')).toBeNull();
    fireEvent.click(screen.getByTestId('resume-toggle'));
    const full = screen.getByTestId('resume-full');
    expect(full).toBeTruthy();
    expect(within(full).getByText('基本信息')).toBeTruthy();
    expect(within(full).getByText('项目亮点')).toBeTruthy();
    fireEvent.click(screen.getByTestId('resume-toggle'));
    expect(screen.queryByTestId('resume-full')).toBeNull();
  });
});

// ---------------- UI: RoundTabs ----------------

describe('RoundTabs UI', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it('renders round labels in Chinese and highlights active round', () => {
    const rounds = [
      { ...makeInterview({ id: 'iv_a', evaluation: evalA }), round: 1 },
      { ...makeInterview({ id: 'iv_b', evaluation: evalB }), round: 2 },
      { ...makeInterview({ id: 'iv_c', evaluation: evalC }), round: 3 },
    ];
    render(<RoundTabs rounds={rounds} activeRound={2} onChange={() => {}} />);
    expect(screen.getByTestId('round-tab-iv_a').textContent).toContain('一面');
    expect(screen.getByTestId('round-tab-iv_b').textContent).toContain('二面');
    expect(screen.getByTestId('round-tab-iv_c').textContent).toContain('三面');
    const active = screen.getByTestId('round-tab-iv_b');
    expect(active.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('round-tab-iv_a').getAttribute('aria-selected')).toBe('false');
  });

  it('invokes onChange when a tab is clicked', () => {
    const onChange = vi.fn();
    const rounds = [
      { ...makeInterview({ id: 'iv_a' }), round: 1 },
      { ...makeInterview({ id: 'iv_b' }), round: 2 },
    ];
    render(<RoundTabs rounds={rounds} activeRound={1} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('round-tab-iv_b'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('renders empty placeholder when no rounds', () => {
    render(<RoundTabs rounds={[]} activeRound={1} onChange={() => {}} />);
    expect(screen.getByTestId('round-tabs-empty')).toBeTruthy();
  });
});

// ---------------- UI: CandidateInterviewPanel ----------------

describe('CandidateInterviewPanel UI', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it('shows resume + tabs + first round detail by default', () => {
    const candidate = makeCandidate();
    const rounds = [
      { ...makeInterview({ id: 'iv_a', evaluation: evalA }), round: 1 },
      { ...makeInterview({ id: 'iv_b', evaluation: evalB }), round: 2 },
    ];
    render(
      <CandidateInterviewPanel candidate={candidate} candidateId={candidate.id} rounds={rounds} />,
    );

    expect(screen.getByTestId('candidate-panel')).toBeTruthy();
    expect(screen.getByTestId('resume-card')).toBeTruthy();
    expect(screen.getByTestId('round-tabs')).toBeTruthy();
    expect(screen.getByTestId('round-detail-iv_a')).toBeTruthy();
    expect(screen.getByTestId('round-evaluation-iv_a').textContent).toContain('82');
  });

  it('switches detail when a different tab is clicked', () => {
    const candidate = makeCandidate();
    const rounds = [
      { ...makeInterview({ id: 'iv_a', evaluation: evalA }), round: 1 },
      { ...makeInterview({ id: 'iv_b', evaluation: evalB }), round: 2 },
    ];
    render(
      <CandidateInterviewPanel candidate={candidate} candidateId={candidate.id} rounds={rounds} />,
    );
    fireEvent.click(screen.getByTestId('round-tab-iv_b'));
    expect(screen.getByTestId('round-detail-iv_b')).toBeTruthy();
    expect(screen.queryByTestId('round-detail-iv_a')).toBeNull();
  });

  it('renders empty state for candidates with no rounds', () => {
    const candidate = makeCandidate();
    render(<CandidateInterviewPanel candidate={candidate} candidateId={candidate.id} rounds={[]} />);
    expect(screen.getByTestId('candidate-panel-empty')).toBeTruthy();
    expect(screen.getByTestId('resume-card')).toBeTruthy();
  });

  it('tolerates turns / evaluation missing', () => {
    const candidate = makeCandidate();
    const rounds = [
      {
        ...makeInterview({ id: 'iv_bare', turns: [], evaluation: undefined }),
        round: 1,
      },
    ];
    render(<CandidateInterviewPanel candidate={candidate} candidateId={candidate.id} rounds={rounds} />);
    expect(screen.getByTestId('round-detail-iv_bare')).toBeTruthy();
    expect(screen.queryByTestId('round-evaluation-iv_bare')).toBeNull();
  });

  it('shows turns when present', () => {
    const candidate = makeCandidate();
    const turns = [
      { role: 'interviewer' as const, content: '请自我介绍', timestamp: '2026-06-21T00:00:00Z' },
      { role: 'candidate' as const, content: '你好，我叫张三', timestamp: '2026-06-21T00:01:00Z' },
    ];
    const rounds = [{ ...makeInterview({ id: 'iv_turns', turns, evaluation: evalA }), round: 1 }];
    render(<CandidateInterviewPanel candidate={candidate} candidateId={candidate.id} rounds={rounds} />);
    expect(screen.getByText('请自我介绍')).toBeTruthy();
    expect(screen.getByText('你好，我叫张三')).toBeTruthy();
  });
});

// ---------------- UI: Interviews page ----------------

describe('Interviews page — V143 candidate grouping', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it('groups interviews by candidate and shows round counts', async () => {
    const candidate = makeCandidate();
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [candidate],
        members: [],
        trainings: [],
        generatedAt: '2026-06-21T00:00:00Z',
        interviews: [
          makeInterview({ id: 'iv_a', candidateId: candidate.id, startedAt: '2026-06-21T01:00:00Z', completedAt: '2026-06-21T02:00:00Z', evaluation: evalA }),
          makeInterview({ id: 'iv_b', candidateId: candidate.id, startedAt: '2026-06-21T03:00:00Z', completedAt: '2026-06-21T04:00:00Z', evaluation: evalB }),
          makeInterview({ id: 'iv_c', candidateId: candidate.id, startedAt: '2026-06-21T05:00:00Z', completedAt: '2026-06-21T06:00:00Z', evaluation: evalC }),
        ],
      },
    });

    render(<Interviews />);

    await waitFor(() => screen.getByTestId(`candidate-card-${candidate.id}`));
    expect(screen.getByTestId(`candidate-round-count-${candidate.id}`).textContent).toContain('3 轮');
    expect(screen.getByTestId(`candidate-round-count-${candidate.id}`).textContent).toContain('三面');
    expect(screen.getByTestId('resume-card')).toBeTruthy();
    expect(screen.getByTestId('round-tabs')).toBeTruthy();
  });

  it('switches active candidate when sidebar card is clicked', async () => {
    const ca = makeCandidate({ id: 'ct_a', name: 'A', position: 'Dev' });
    const cb = makeCandidate({ id: 'ct_b', name: 'B', position: 'Dev', resume: '## B\nB 简历' });
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [ca, cb],
        members: [],
        trainings: [],
        generatedAt: '2026-06-21T00:00:00Z',
        interviews: [
          makeInterview({ id: 'iv_a', candidateId: ca.id, startedAt: '2026-06-21T01:00:00Z', completedAt: '2026-06-21T02:00:00Z' }),
          makeInterview({ id: 'iv_b', candidateId: cb.id, startedAt: '2026-06-21T05:00:00Z', completedAt: '2026-06-21T06:00:00Z' }),
        ],
      },
    });

    render(<Interviews />);

    await waitFor(() => screen.getByTestId('candidate-card-ct_b'));
    // Auto-selects the latest (B)
    expect(screen.getByTestId('candidate-card-ct_b').getAttribute('class') ?? '').toMatch(/border-brand-500/);
    expect(screen.getByTestId('resume-preview').textContent).toContain('B');

    // Switch to A
    fireEvent.click(screen.getByTestId('candidate-card-ct_a'));
    expect(screen.getByTestId('resume-preview').textContent).toContain('基本信息');
  });

  it('renders empty state when no interviews', () => {
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: { candidates: [], members: [], trainings: [], generatedAt: '', interviews: [] },
    });
    render(<Interviews />);
    expect(screen.getByText(/暂无面试记录/)).toBeTruthy();
  });

  it('shows relative time + ISO title for candidate cards (V144)', async () => {
    const candidate = makeCandidate();
    vi.mocked(useTeamData).mockReturnValue({
      loading: false,
      source: 'api',
      refresh: vi.fn(),
      error: null,
      data: {
        candidates: [candidate],
        members: [],
        trainings: [],
        generatedAt: '2026-06-21T00:00:00Z',
        interviews: [
          makeInterview({ id: 'iv_recent', candidateId: candidate.id, completedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
        ],
      },
    });

    render(<Interviews />);
    await waitFor(() => screen.getByTestId(`candidate-card-${candidate.id}`));
    const card = screen.getByTestId(`candidate-card-${candidate.id}`);
    // 1 小时前 relative + 完整日期 title attribute
    expect(card.textContent).toMatch(/小时前/);
    const timeSpan = card.querySelector('span[title]');
    expect(timeSpan).not.toBeNull();
    expect(timeSpan!.getAttribute('title')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});