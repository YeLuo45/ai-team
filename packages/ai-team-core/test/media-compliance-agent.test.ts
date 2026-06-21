import { describe, expect, it } from 'vitest';
import {
  MEDIA_COMPLIANCE_RULES,
  assessMediaCompliance,
  buildMediaComplianceCheck,
  summarizeMediaComplianceCheck,
} from '../src/media-compliance-agent.js';

describe('V31 MediaComplianceAgent', () => {
  it('classifies media content severity from channel and content cues', () => {
    expect(assessMediaCompliance('内部 OKR 草稿').level).toBe('low');
    expect(assessMediaCompliance('公众号待发布的财报前瞻稿件').level).toBe('medium');
    expect(assessMediaCompliance('未授权曝光用户身份证与手机号').level).toBe('critical');
    expect(assessMediaCompliance('产品宣传视频待上架但未授权').level).toBe('high');
  });

  it('returns matched rule evidence by channel', () => {
    const result = assessMediaCompliance('公众号推送：未脱敏客户手机号，未授权转载', 'wechat');
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'pii-exposure', channel: 'wechat' }),
        expect.objectContaining({ ruleId: 'consent-missing', channel: 'wechat' }),
      ])
    );
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('builds compliance check with blocking actions ordered by severity', () => {
    const check = buildMediaComplianceCheck({
      assetId: 'asset-1',
      title: '品牌代言视频',
      channel: 'douyin',
      excerpt: '未获得代言人肖像权授权即定剪',
    });
    expect(check.assetId).toBe('asset-1');
    expect(check.assessment.level).toBe('critical');
    expect(check.requiredActions[0].kind).toBe('block_publish');
    expect(check.requiredActions.map(a => a.label)).toContain('暂停排期并取得书面授权');
    expect(check.requiredActions.map(a => a.label)).toContain('法务会签并归档凭证');
  });

  it('summarizes check with channel and level for audit trail', () => {
    const check = buildMediaComplianceCheck({
      assetId: 'asset-2',
      title: '内部周会纪要',
      channel: 'feishu',
      excerpt: '讨论方向，无需对外发布',
    });
    expect(summarizeMediaComplianceCheck(check)).toContain('asset-2');
    expect(summarizeMediaComplianceCheck(check)).toContain('low');
    expect(summarizeMediaComplianceCheck(check)).toContain('feishu');
  });

  it('returns compliance actions for high and medium severities', () => {
    const high = buildMediaComplianceCheck({
      assetId: 'asset-high',
      title: '产品宣传视频提前曝光',
      channel: 'douyin',
      excerpt: '涉及未成年人内容，已排期上线',
    });
    expect(high.assessment.level).toBe('high');
    expect(high.requiredActions[0].kind).toBe('flag_for_review');

    const medium = buildMediaComplianceCheck({
      assetId: 'asset-medium',
      title: '公众号待发布的财报前瞻稿件',
    });
    expect(medium.assessment.level).toBe('medium');
    expect(medium.requiredActions.every(a => a.kind === 'flag_for_review')).toBe(true);
  });

  it('keeps rule catalog grouped and non-empty', () => {
    expect(MEDIA_COMPLIANCE_RULES.wechat.length).toBeGreaterThan(0);
    expect(MEDIA_COMPLIANCE_RULES.douyin.length).toBeGreaterThan(0);
    expect(MEDIA_COMPLIANCE_RULES.xiaohongshu.length).toBeGreaterThan(0);
    expect(MEDIA_COMPLIANCE_RULES.bilibili.length).toBeGreaterThan(0);
  });
});
