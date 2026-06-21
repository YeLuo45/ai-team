export type TechPolicyCategory = 'security' | 'compliance' | 'operations' | 'governance';
export type TechPolicySeverity = 'low' | 'medium' | 'high' | 'critical';
export type TechPolicyActionPriority = 'normal' | 'soon' | 'urgent' | 'immediate';

export interface TechPolicyRule {
  id: string;
  description: string;
  keywords: string[];
  category: TechPolicyCategory;
  weight: number;
}

export interface TechPolicyMatch {
  ruleId: string;
  category: TechPolicyCategory;
  weight: number;
}

export interface TechPolicyAssessment {
  severity: TechPolicySeverity;
  score: number;
  matches: TechPolicyMatch[];
}

export interface TechPolicyIncidentInput {
  incidentId: string;
  summary: string;
  context?: string;
}

export interface TechPolicyRemediation {
  action: string;
  priority: TechPolicyActionPriority;
}

export interface TechPolicyReport {
  incidentId: string;
  summary: string;
  policy: TechPolicyAssessment;
  remediations: TechPolicyRemediation[];
  generatedAt: string;
}

export const TECH_POLICY_RULES: Record<TechPolicyCategory, TechPolicyRule[]> = {
  security: [
    {
      id: 'secret-leak',
      description: '密钥/凭证出现在代码或工单',
      keywords: ['密钥', 'secret', '硬编码', '明文密码'],
      category: 'security',
      weight: 55,
    },
    {
      id: 'iam-bypass',
      description: '绕过身份验证或授权',
      keywords: ['绕过', 'bypass', '直连生产', 'iam 绕过', '直接连生产', '绕过身份认证'],
      category: 'security',
      weight: 55,
    },
    {
      id: 'public-endpoint',
      description: '生产入口意外对外暴露',
      keywords: ['入口开放', '公开仓库', '对外暴露', '公网访问'],
      category: 'security',
      weight: 40,
    },
  ],
  compliance: [
    {
      id: 'gpl-license',
      description: '使用 GPL 等强传染性开源许可',
      keywords: ['GPL', '强传染', 'copyleft', '开源协议'],
      category: 'compliance',
      weight: 30,
    },
    {
      id: 'data-residency',
      description: '数据出域或跨境传输',
      keywords: ['跨境', '数据出境', '境外存储'],
      category: 'compliance',
      weight: 35,
    },
    {
      id: 'commit-to-public',
      description: '内部代码或资产进入公开仓库',
      keywords: ['提交到公开仓库', '公开仓库', '上传到公开', 'commit 到 github', '上传公网', '提交到仓库'],
      category: 'compliance',
      weight: 45,
    },
  ],
  operations: [
    {
      id: 'manual-deploy',
      description: '绕过 CI/CD 手动部署到生产',
      keywords: ['手动部署', '绕过 ci', '本地发布', 'ssh 部署'],
      category: 'operations',
      weight: 25,
    },
    {
      id: 'stale-runbook',
      description: '运行手册过期或缺失',
      keywords: ['运行手册过期', 'runbook 缺失', 'wiki 过期'],
      category: 'operations',
      weight: 15,
    },
  ],
  governance: [
    {
      id: 'no-owner',
      description: '资产或服务无明确负责人',
      keywords: ['无 owner', '负责人缺失', '无人维护'],
      category: 'governance',
      weight: 20,
    },
    {
      id: 'policy-missing',
      description: '缺少对应技术政策文档',
      keywords: ['缺少政策', 'policy 缺失', '制度空白'],
      category: 'governance',
      weight: 25,
    },
  ],
};

export function classifyTechPolicy(text: string): TechPolicyAssessment {
  const normalized = text.toLocaleLowerCase('zh-CN');
  const matches: TechPolicyMatch[] = [];
  for (const [category, rules] of Object.entries(TECH_POLICY_RULES)) {
    for (const rule of rules) {
      if (rule.keywords.some((kw) => normalized.includes(kw.toLocaleLowerCase('zh-CN')))) {
        matches.push({ ruleId: rule.id, weight: rule.weight, category: category as TechPolicyCategory });
      }
    }
  }
  const score = Math.min(100, matches.reduce((sum, match) => sum + match.weight, 0));
  return { severity: classifyTechSeverity(score), score, matches };
}

export function buildTechPolicyReport(input: TechPolicyIncidentInput): TechPolicyReport {
  const policy = classifyTechPolicy([input.summary, input.context ?? ''].join('\n'));
  return {
    incidentId: input.incidentId,
    summary: input.summary,
    policy,
    remediations: recommendedTechRemediations(policy),
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeTechPolicyReport(report: TechPolicyReport): string {
  return `${report.incidentId} · ${report.policy.severity} · ${report.summary} · ${report.remediations.length} remediations`;
}

function classifyTechSeverity(score: number): TechPolicySeverity {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function recommendedTechRemediations(policy: TechPolicyAssessment): TechPolicyRemediation[] {
  if (policy.severity === 'critical') {
    return [
      { action: '立即撤销暴露的凭证并轮换密钥', priority: 'immediate' },
      { action: '冻结相关系统入口，等待安全复核', priority: 'immediate' },
      { action: '登记事件至安全审计台', priority: 'urgent' },
    ];
  }
  if (policy.severity === 'high') {
    return [
      { action: '回滚异常入口并强制重新鉴权', priority: 'urgent' },
      { action: '登记事件至安全审计台', priority: 'urgent' },
      { action: '补充相关运行手册与值守安排', priority: 'soon' },
    ];
  }
  if (policy.severity === 'medium') {
    return [
      { action: '安排技术负责人评估并限期整改', priority: 'soon' },
      { action: '归档为合规抽检样本', priority: 'normal' },
    ];
  }
  return [{ action: '登记为低优先级治理事项', priority: 'normal' }];
}
