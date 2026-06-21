import { describe, expect, it } from 'vitest';
import {
  SIBLING_ORG_CONFLICT_PATTERNS,
  detectSiblingConflict,
  buildSiblingConflictReport,
  summarizeSiblingConflict,
} from '../src/sibling-org-conflict-agent.js';

describe('V32 SiblingOrgConflictAgent', () => {
  it('classifies conflict severity by relationship', () => {
    expect(detectSiblingConflict('常规周会同步').severity).toBe('low');
    expect(detectSiblingConflict('两个团队抢同一名后端候选人').severity).toBe('medium');
    expect(detectSiblingConflict('A 团队负责人要求删除 B 团队共享文档').severity).toBe('high');
    expect(detectSiblingConflict('跨团队封禁对方部署权限并伪造事故报告').severity).toBe('critical');
  });

  it('returns matched patterns by category', () => {
    const result = detectSiblingConflict('两个团队抢同一名后端候选人，且岗位重叠');
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ patternId: 'talent-competition', category: 'resource' }),
        expect.objectContaining({ patternId: 'role-overlap', category: 'role' }),
      ])
    );
  });

  it('builds a report with mediation actions ordered by priority', () => {
    const report = buildSiblingConflictReport({
      incidentId: 'so-1',
      summary: '两个团队抢同一名候选人',
      context: '前端与全栈团队都标了同一候选人，且都用 P6 预算',
    });
    expect(report.incidentId).toBe('so-1');
    expect(report.conflict.severity).toBe('medium');
    expect(report.actions[0].priority).toBe('urgent');
    expect(report.actions.map(a => a.label)).toContain('邀请双方负责人与 HRBP 联席会议');
  });

  it('summarizes the report with severity and title', () => {
    const report = buildSiblingConflictReport({
      incidentId: 'so-2',
      summary: '团队文档互删',
      context: 'A 团队负责人要求删除 B 团队共享文档',
    });
    expect(summarizeSiblingConflict(report)).toContain('so-2');
    expect(summarizeSiblingConflict(report)).toContain('high');
    expect(summarizeSiblingConflict(report)).toContain('团队文档互删');
  });

  it('returns immediate escalation for critical severity', () => {
    const report = buildSiblingConflictReport({
      incidentId: 'so-critical',
      summary: '跨团队伪造事故报告并封禁对方部署权限',
    });
    expect(report.conflict.severity).toBe('critical');
    expect(report.actions[0].priority).toBe('immediate');
    expect(report.actions.some(a => a.label.includes('跨团队 HR'))).toBe(true);
  });

  it('returns low-priority action for non-conflict incidents', () => {
    const report = buildSiblingConflictReport({
      incidentId: 'so-low',
      summary: '常规周会同步',
    });
    expect(report.conflict.severity).toBe('low');
    expect(report.actions).toEqual([{ label: '记录为低优先级协作事项', priority: 'normal' }]);
  });

  it('keeps pattern catalog grouped and non-empty', () => {
    expect(SIBLING_ORG_CONFLICT_PATTERNS.resource.length).toBeGreaterThan(0);
    expect(SIBLING_ORG_CONFLICT_PATTERNS.role.length).toBeGreaterThan(0);
    expect(SIBLING_ORG_CONFLICT_PATTERNS.access.length).toBeGreaterThan(0);
    expect(SIBLING_ORG_CONFLICT_PATTERNS.communication.length).toBeGreaterThan(0);
  });
});
