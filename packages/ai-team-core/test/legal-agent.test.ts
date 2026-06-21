import { describe, expect, it } from 'vitest';
import {
  LEGAL_RISK_KEYWORDS,
  assessLegalRisk,
  buildLegalReview,
  summarizeLegalReview,
} from '../src/legal-agent.js';

describe('V30 LegalAgent', () => {
  it('classifies low, medium, high, and critical legal risk from issue text', () => {
    expect(assessLegalRisk('普通劳动合同续签提醒').level).toBe('low');
    expect(assessLegalRisk('候选人要求查看 offer 薪资条款和试用期约定').level).toBe('medium');
    expect(assessLegalRisk('员工投诉歧视并准备劳动仲裁').level).toBe('high');
    expect(assessLegalRisk('严重数据泄露，涉及隐私合规和监管处罚').level).toBe('critical');
  });

  it('returns matched keyword evidence by category', () => {
    const result = assessLegalRisk('简历筛选存在歧视风险，候选人要求劳动仲裁');
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: '歧视', category: 'employment' }),
        expect.objectContaining({ keyword: '劳动仲裁', category: 'dispute' }),
      ])
    );
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('builds recommended actions ordered by urgency', () => {
    const review = buildLegalReview({
      issueId: 'issue-1',
      title: '候选人投诉隐私泄露',
      description: '招聘系统疑似泄露候选人身份证和手机号，存在隐私合规风险',
      owner: 'hrbp',
    });
    expect(review.issueId).toBe('issue-1');
    expect(review.risk.level).toBe('critical');
    expect(review.actions[0].priority).toBe('immediate');
    expect(review.actions.map(action => action.label)).toContain('冻结相关数据处理流程');
    expect(review.actions.map(action => action.label)).toContain('同步法务与信息安全负责人');
  });

  it('builds urgent high-risk actions for dispute-heavy issues', () => {
    const review = buildLegalReview({
      issueId: 'issue-high',
      title: '合规争议',
      description: '候选人指出招聘流程存在歧视，并准备劳动仲裁',
    });
    expect(review.risk.level).toBe('high');
    expect(review.actions[0]).toEqual({ label: '安排法务复核事实材料', priority: 'urgent' });
  });

  it('builds normal action for low-risk documentation issues', () => {
    const review = buildLegalReview({
      issueId: 'issue-low',
      title: '候选人资料归档',
      description: '普通入职材料归档提醒',
    });
    expect(review.risk.level).toBe('low');
    expect(review.actions).toEqual([{ label: '记录为低风险合规事项', priority: 'normal' }]);
  });

  it('summarizes review in a concise audit-friendly sentence', () => {
    const review = buildLegalReview({
      issueId: 'issue-2',
      title: 'offer 条款争议',
      description: '候选人对 offer 竞业限制条款提出异议',
    });
    expect(summarizeLegalReview(review)).toContain('issue-2');
    expect(summarizeLegalReview(review)).toContain('medium');
    expect(summarizeLegalReview(review)).toContain('offer 条款争议');
  });

  it('keeps keyword catalog grouped and non-empty', () => {
    expect(LEGAL_RISK_KEYWORDS.employment.length).toBeGreaterThan(0);
    expect(LEGAL_RISK_KEYWORDS.privacy.length).toBeGreaterThan(0);
    expect(LEGAL_RISK_KEYWORDS.dispute.length).toBeGreaterThan(0);
    expect(LEGAL_RISK_KEYWORDS.contract.length).toBeGreaterThan(0);
  });
});
