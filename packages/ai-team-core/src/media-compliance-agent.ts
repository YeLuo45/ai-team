export type MediaChannel = 'wechat' | 'douyin' | 'xiaohongshu' | 'bilibili' | 'feishu' | 'other';
export type MediaComplianceLevel = 'low' | 'medium' | 'high' | 'critical';
export type MediaActionKind = 'flag_for_review' | 'request_consent' | 'block_publish' | 'archive_only';

export interface MediaComplianceRule {
  id: string;
  description: string;
  keywords: string[];
  channel: MediaChannel;
  weight: number;
}

export interface MediaComplianceMatch {
  ruleId: string;
  channel: MediaChannel;
  weight: number;
}

export interface MediaComplianceAssessment {
  level: MediaComplianceLevel;
  score: number;
  matches: MediaComplianceMatch[];
}

export interface MediaAssetInput {
  assetId: string;
  title: string;
  channel: MediaChannel;
  excerpt?: string;
}

export interface MediaComplianceAction {
  label: string;
  kind: MediaActionKind;
}

export interface MediaComplianceCheck {
  assetId: string;
  title: string;
  channel: MediaChannel;
  assessment: MediaComplianceAssessment;
  requiredActions: MediaComplianceAction[];
  generatedAt: string;
}

export const MEDIA_COMPLIANCE_RULES: Record<MediaChannel, MediaComplianceRule[]> = {
  wechat: [
    { id: 'pii-exposure', description: '微信公众号未脱敏个人信息', keywords: ['手机号', '身份证', '微信号', '实名', '曝光用户', '客户手机号', '未脱敏', '未脱敏客户'], channel: 'wechat', weight: 65 },
    { id: 'consent-missing', description: '缺少肖像/数据使用授权', keywords: ['未授权', '未经同意', 'consent'], channel: 'wechat', weight: 35 },
    { id: 'financial-disclosure', description: '前瞻性财务披露', keywords: ['财报', '营收预测', '业绩指引'], channel: 'wechat', weight: 25 },
  ],
  douyin: [
    { id: 'celebrity-rights', description: '代言人肖像权未取得', keywords: ['代言人', '肖像权', '代言人肖像权', '未获得授权', '未获得代言人', '肖像', '代言人肖像权授权'], channel: 'douyin', weight: 80 },
    { id: 'minor-content', description: '涉及未成年人且未护栏', keywords: ['未成年人', '未成年'], channel: 'douyin', weight: 40 },
    { id: 'unreleased-product', description: '未发布产品提前曝光', keywords: ['未发布', '提前曝光', '新品未发布'], channel: 'douyin', weight: 35 },
  ],
  xiaohongshu: [
    { id: 'medical-claim', description: '医疗/保健功效断言', keywords: ['疗效', '治愈', '保健品'], channel: 'xiaohongshu', weight: 35 },
    { id: 'paid-disclosure', description: '商业推广未标识', keywords: ['合作', '恰饭', '赞助'], channel: 'xiaohongshu', weight: 25 },
  ],
  bilibili: [
    { id: 'game-license', description: '游戏/影视素材未授权', keywords: ['游戏素材', '未授权', '搬运'], channel: 'bilibili', weight: 30 },
    { id: 'live-script', description: '直播脚本缺合规审查', keywords: ['直播脚本', '口播未审'], channel: 'bilibili', weight: 25 },
  ],
  feishu: [
    { id: 'internal-leak', description: '内部纪要外传', keywords: ['内部纪要', 'OKR 草稿', '未发布'], channel: 'feishu', weight: 15 },
    { id: 'restricted-channel', description: '内部渠道跨群扩散', keywords: ['跨群', '外传', '泄露'], channel: 'feishu', weight: 25 },
  ],
  other: [
    { id: 'generic-pii', description: '通用渠道 PII 风险', keywords: ['手机号', '身份证', '邮箱', '曝光用户'], channel: 'other', weight: 65 },
    { id: 'generic-financial', description: '通用渠道财务前瞻披露', keywords: ['财报', '营收预测', '业绩指引', '前瞻'], channel: 'other', weight: 25 },
    { id: 'generic-consent', description: '通用渠道未授权风险', keywords: ['未授权', '未经同意', 'consent', '待上架'], channel: 'other', weight: 60 },
  ],
};

export function assessMediaCompliance(text: string, channel: MediaChannel = 'other'): MediaComplianceAssessment {
  const normalized = text.toLocaleLowerCase('zh-CN');
  const matches: MediaComplianceMatch[] = [];
  const channelsToCheck: MediaChannel[] = channel === 'other' ? ['other'] : [channel, 'other'];
  for (const ch of channelsToCheck) {
    for (const rule of MEDIA_COMPLIANCE_RULES[ch]) {
      if (rule.keywords.some((kw) => normalized.includes(kw.toLocaleLowerCase('zh-CN')))) {
        matches.push({ ruleId: rule.id, channel: ch, weight: rule.weight });
      }
    }
  }
  const score = Math.min(100, matches.reduce((sum, match) => sum + match.weight, 0));
  return { level: classifyMediaLevel(score), score, matches };
}

export function buildMediaComplianceCheck(input: MediaAssetInput): MediaComplianceCheck {
  const assessment = assessMediaCompliance([input.title, input.excerpt ?? ''].join('\n'), input.channel);
  return {
    assetId: input.assetId,
    title: input.title,
    channel: input.channel,
    assessment,
    requiredActions: recommendedMediaActions(assessment),
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeMediaComplianceCheck(check: MediaComplianceCheck): string {
  return `${check.assetId} · ${check.channel} · ${check.assessment.level} · ${check.title} · ${check.requiredActions.length} actions`;
}

function classifyMediaLevel(score: number): MediaComplianceLevel {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function recommendedMediaActions(assessment: MediaComplianceAssessment): MediaComplianceAction[] {
  if (assessment.level === 'critical') {
    return [
      { label: '暂停排期并取得书面授权', kind: 'block_publish' },
      { label: '法务会签并归档凭证', kind: 'request_consent' },
      { label: '登记事件至合规审计台', kind: 'flag_for_review' },
    ];
  }
  if (assessment.level === 'high') {
    return [
      { label: '提交法务/合规复核', kind: 'flag_for_review' },
      { label: '补齐肖像/数据授权记录', kind: 'request_consent' },
    ];
  }
  if (assessment.level === 'medium') {
    return [
      { label: '在素材描述中补充合规说明', kind: 'flag_for_review' },
      { label: '评估是否标记商业推广', kind: 'flag_for_review' },
    ];
  }
  return [{ label: '归档为低风险内部素材', kind: 'archive_only' }];
}
