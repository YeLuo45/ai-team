export type LegalRiskCategory = 'employment' | 'privacy' | 'dispute' | 'contract';
export type LegalRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type LegalActionPriority = 'normal' | 'soon' | 'urgent' | 'immediate';

export interface LegalRiskMatch {
  keyword: string;
  category: LegalRiskCategory;
  weight: number;
}

export interface LegalRiskAssessment {
  level: LegalRiskLevel;
  score: number;
  matches: LegalRiskMatch[];
}

export interface LegalReviewInput {
  issueId: string;
  title: string;
  description: string;
  owner?: string;
}

export interface LegalAction {
  label: string;
  priority: LegalActionPriority;
}

export interface LegalReview {
  issueId: string;
  title: string;
  owner?: string;
  risk: LegalRiskAssessment;
  actions: LegalAction[];
  generatedAt: string;
}

export const LEGAL_RISK_KEYWORDS: Record<LegalRiskCategory, Array<{ keyword: string; weight: number }>> = {
  employment: [
    { keyword: '歧视', weight: 30 },
    { keyword: '不当解雇', weight: 35 },
    { keyword: '工伤', weight: 30 },
    { keyword: '试用期', weight: 15 },
  ],
  privacy: [
    { keyword: '隐私', weight: 35 },
    { keyword: '数据泄露', weight: 55 },
    { keyword: '身份证', weight: 25 },
    { keyword: '手机号', weight: 20 },
    { keyword: '监管处罚', weight: 45 },
  ],
  dispute: [
    { keyword: '劳动仲裁', weight: 30 },
    { keyword: '投诉', weight: 15 },
    { keyword: '诉讼', weight: 45 },
    { keyword: '举报', weight: 30 },
  ],
  contract: [
    { keyword: '合同', weight: 15 },
    { keyword: 'offer', weight: 20 },
    { keyword: '竞业限制', weight: 30 },
    { keyword: '薪资条款', weight: 15 },
  ],
};

export function assessLegalRisk(text: string): LegalRiskAssessment {
  const normalized = text.toLocaleLowerCase('zh-CN');
  const matches = Object.entries(LEGAL_RISK_KEYWORDS).flatMap(([category, keywords]) =>
    keywords
      .filter(({ keyword }) => normalized.includes(keyword.toLocaleLowerCase('zh-CN')))
      .map(({ keyword, weight }) => ({ keyword, weight, category: category as LegalRiskCategory }))
  );
  const score = Math.min(100, matches.reduce((sum, match) => sum + match.weight, 0));
  return { level: classifyLegalRisk(score), score, matches };
}

export function buildLegalReview(input: LegalReviewInput): LegalReview {
  const risk = assessLegalRisk(`${input.title}\n${input.description}`);
  return {
    issueId: input.issueId,
    title: input.title,
    owner: input.owner,
    risk,
    actions: recommendedLegalActions(risk),
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeLegalReview(review: LegalReview): string {
  return `${review.issueId} · ${review.risk.level} · ${review.title} · ${review.actions.length} actions`;
}

function classifyLegalRisk(score: number): LegalRiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function recommendedLegalActions(risk: LegalRiskAssessment): LegalAction[] {
  if (risk.level === 'critical') {
    return [
      { label: '冻结相关数据处理流程', priority: 'immediate' },
      { label: '同步法务与信息安全负责人', priority: 'immediate' },
      { label: '保全审计日志与沟通证据', priority: 'urgent' },
    ];
  }
  if (risk.level === 'high') {
    return [
      { label: '安排法务复核事实材料', priority: 'urgent' },
      { label: '准备对外沟通口径', priority: 'soon' },
    ];
  }
  if (risk.level === 'medium') {
    return [
      { label: '补齐条款说明和候选人确认记录', priority: 'soon' },
      { label: '标记为法务抽检样本', priority: 'normal' },
    ];
  }
  return [{ label: '记录为低风险合规事项', priority: 'normal' }];
}
