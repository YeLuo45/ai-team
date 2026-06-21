export type SiblingConflictCategory = 'resource' | 'role' | 'access' | 'communication';
export type SiblingConflictSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SiblingActionPriority = 'normal' | 'soon' | 'urgent' | 'immediate';

export interface SiblingConflictPattern {
  id: string;
  description: string;
  keywords: string[];
  category: SiblingConflictCategory;
  weight: number;
}

export interface SiblingConflictMatch {
  patternId: string;
  category: SiblingConflictCategory;
  weight: number;
}

export interface SiblingConflictAssessment {
  severity: SiblingConflictSeverity;
  score: number;
  matches: SiblingConflictMatch[];
}

export interface SiblingConflictInput {
  incidentId: string;
  summary: string;
  context?: string;
}

export interface SiblingAction {
  label: string;
  priority: SiblingActionPriority;
}

export interface SiblingConflictReport {
  incidentId: string;
  summary: string;
  conflict: SiblingConflictAssessment;
  actions: SiblingAction[];
  generatedAt: string;
}

export const SIBLING_ORG_CONFLICT_PATTERNS: Record<SiblingConflictCategory, SiblingConflictPattern[]> = {
  resource: [
    {
      id: 'talent-competition',
      description: '两个团队抢同一名候选人或员工',
      keywords: ['抢同一', '同一候选人', '抢候选人', '同一员工', '多人面试'],
      category: 'resource',
      weight: 35,
    },
    {
      id: 'budget-overlap',
      description: '同一预算或费用被两个团队重复认领',
      keywords: ['预算重叠', '费用重复', '同一预算', '重复认领'],
      category: 'resource',
      weight: 25,
    },
  ],
  role: [
    {
      id: 'role-overlap',
      description: '岗位职责重叠或边界不清',
      keywords: ['岗位重叠', '职责重叠', '边界不清', '角色冲突'],
      category: 'role',
      weight: 30,
    },
    {
      id: 'reporting-ambiguity',
      description: '汇报关系或 PnR 关系模糊',
      keywords: ['汇报关系模糊', '汇报不清', 'pnr 模糊', '汇报关系'],
      category: 'role',
      weight: 25,
    },
  ],
  access: [
    {
      id: 'deploy-block',
      description: '一方封禁另一方部署或运维权限',
      keywords: ['封禁部署', '封禁对方部署', '封禁权限', '禁用对方', '运维权限', '封禁'],
      category: 'access',
      weight: 55,
    },
    {
      id: 'doc-tampering',
      description: '共享文档/资产被恶意修改或删除',
      keywords: ['删除共享文档', '删除对方文档', '删除 b 团队', '删除 a 团队', '篡改文档', '互删', '删除团队文档'],
      category: 'access',
      weight: 65,
    },
  ],
  communication: [
    {
      id: 'incident-fabrication',
      description: '伪造事故报告甩锅',
      keywords: ['伪造事故', '伪造事故报告', '甩锅', '伪造报告', '篡改事故'],
      category: 'communication',
      weight: 65,
    },
    {
      id: 'cross-team-hostility',
      description: '公开羞辱或人身攻击',
      keywords: ['公开羞辱', '人身攻击', '公开指责'],
      category: 'communication',
      weight: 35,
    },
  ],
};

export function detectSiblingConflict(text: string): SiblingConflictAssessment {
  const normalized = text.toLocaleLowerCase('zh-CN');
  const matches: SiblingConflictMatch[] = [];
  for (const [category, patterns] of Object.entries(SIBLING_ORG_CONFLICT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.keywords.some((kw) => normalized.includes(kw.toLocaleLowerCase('zh-CN')))) {
        matches.push({
          patternId: pattern.id,
          category: category as SiblingConflictCategory,
          weight: pattern.weight,
        });
      }
    }
  }
  const score = Math.min(100, matches.reduce((sum, match) => sum + match.weight, 0));
  return { severity: classifySiblingSeverity(score), score, matches };
}

export function buildSiblingConflictReport(input: SiblingConflictInput): SiblingConflictReport {
  const conflict = detectSiblingConflict([input.summary, input.context ?? ''].join('\n'));
  return {
    incidentId: input.incidentId,
    summary: input.summary,
    conflict,
    actions: recommendedSiblingActions(conflict),
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeSiblingConflict(report: SiblingConflictReport): string {
  return `${report.incidentId} · ${report.conflict.severity} · ${report.summary} · ${report.actions.length} actions`;
}

function classifySiblingSeverity(score: number): SiblingConflictSeverity {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function recommendedSiblingActions(conflict: SiblingConflictAssessment): SiblingAction[] {
  if (conflict.severity === 'critical') {
    return [
      { label: '冻结双方受影响系统权限', priority: 'immediate' },
      { label: '启动跨团队 HR + 高管升级流程', priority: 'immediate' },
      { label: '保全沟通证据并启动调查', priority: 'urgent' },
    ];
  }
  if (conflict.severity === 'high') {
    return [
      { label: '邀请双方负责人与 HRBP 联席会议', priority: 'urgent' },
      { label: '复查共享资产与权限并临时隔离变更', priority: 'urgent' },
      { label: '记录事件至团队协作审计台', priority: 'soon' },
    ];
  }
  if (conflict.severity === 'medium') {
    return [
      { label: '邀请双方负责人与 HRBP 联席会议', priority: 'urgent' },
      { label: '梳理 RACI 与预算边界', priority: 'soon' },
    ];
  }
  return [{ label: '记录为低优先级协作事项', priority: 'normal' }];
}
