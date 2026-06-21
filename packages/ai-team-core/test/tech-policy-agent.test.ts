import { describe, expect, it } from 'vitest';
import {
  TECH_POLICY_RULES,
  classifyTechPolicy,
  buildTechPolicyReport,
  summarizeTechPolicyReport,
} from '../src/tech-policy-agent.js';

describe('V31 TechPolicyAgent', () => {
  it('classifies tech policy severity by rule categories', () => {
    expect(classifyTechPolicy('使用开源依赖 GPL').severity).toBe('medium');
    expect(classifyTechPolicy('员工绕过 IAM 直接连生产数据库').severity).toBe('high');
    expect(classifyTechPolicy('生产密钥硬编码并已提交到公开仓库').severity).toBe('critical');
    expect(classifyTechPolicy('内部 wiki 过期页归档').severity).toBe('low');
  });

  it('returns matched rule evidence grouped by category', () => {
    const result = classifyTechPolicy('生产密钥硬编码并提交到公开仓库');
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'secret-leak', category: 'security' }),
        expect.objectContaining({ ruleId: 'commit-to-public', category: 'compliance' }),
      ])
    );
  });

  it('builds report with prioritized remediation steps', () => {
    const report = buildTechPolicyReport({
      incidentId: 'tpr-1',
      summary: '员工绕过 IAM 直接连生产数据库',
      context: '临时调试后未关闭入口，仍可访问',
    });
    expect(report.incidentId).toBe('tpr-1');
    expect(report.policy.severity).toBe('high');
    expect(report.remediations[0].priority).toBe('urgent');
    expect(report.remediations.map(r => r.action)).toContain('回滚异常入口并强制重新鉴权');
    expect(report.remediations.map(r => r.action)).toContain('登记事件至安全审计台');
  });

  it('summarizes report in a concise audit sentence', () => {
    const report = buildTechPolicyReport({
      incidentId: 'tpr-2',
      summary: '过期内部 wiki 页面',
      context: '已归档无访问量',
    });
    expect(summarizeTechPolicyReport(report)).toContain('tpr-2');
    expect(summarizeTechPolicyReport(report)).toContain('low');
    expect(summarizeTechPolicyReport(report)).toContain('过期内部 wiki 页面');
  });

  it('returns urgent remediations for critical severity', () => {
    const report = buildTechPolicyReport({
      incidentId: 'tpr-critical',
      summary: '生产密钥硬编码并已提交到公开仓库',
      context: '内部凭证进入公网',
    });
    expect(report.policy.severity).toBe('critical');
    expect(report.remediations.every(r => ['immediate', 'urgent'].includes(r.priority))).toBe(true);
    expect(report.remediations.map(r => r.action)).toContain('立即撤销暴露的凭证并轮换密钥');
  });

  it('returns medium-priority remediations for medium severity', () => {
    const report = buildTechPolicyReport({
      incidentId: 'tpr-medium',
      summary: '使用开源依赖 GPL',
    });
    expect(report.policy.severity).toBe('medium');
    expect(report.remediations.every(r => r.priority === 'soon' || r.priority === 'normal')).toBe(true);
  });

  it('keeps rule catalog grouped and non-empty', () => {
    expect(TECH_POLICY_RULES.security.length).toBeGreaterThan(0);
    expect(TECH_POLICY_RULES.compliance.length).toBeGreaterThan(0);
    expect(TECH_POLICY_RULES.operations.length).toBeGreaterThan(0);
    expect(TECH_POLICY_RULES.governance.length).toBeGreaterThan(0);
  });
});
