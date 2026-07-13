// V107: 4-group nav structure — recruitment / members / intelligence / system
// 17 pages collapsed into 4 sidebar groups

export interface NavItem {
  path: string;
  label: string;
  testId: string;
  keywords?: string[];
}
export interface NavGroup {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
}

export const PRIMARY_NAV_GROUPS: NavGroup[] = [
  {
    key: 'recruitment',
    label: '招聘',
    icon: '🎯',
    items: [
      { path: '/candidates', label: '候选人', testId: 'nav-candidates', keywords: ['candidate'] },
      { path: '/interviews', label: '面试', testId: 'nav-interviews', keywords: ['interview'] },
      { path: '/pipeline', label: '漏斗', testId: 'nav-pipeline', keywords: ['pipeline', 'funnel'] },
      { path: '/reviews', label: 'Review', testId: 'nav-reviews', keywords: ['review'] },
      { path: '/plugins', label: '插件', testId: 'nav-plugins', keywords: ['plugin'] },
    ],
  },
  {
    key: 'members',
    label: '成员',
    icon: '🧑‍💻',
    items: [
      { path: '/members', label: '成员', testId: 'nav-members', keywords: ['member'] },
      { path: '/skills', label: '技能图谱', testId: 'nav-skills', keywords: ['skill'] },
      { path: '/trainings', label: '培训', testId: 'nav-trainings', keywords: ['training'] },
      { path: '/heatmap', label: '能力热力图', testId: 'nav-heatmap', keywords: ['heatmap'] },
    ],
  },
  {
    key: 'intelligence',
    label: '智能',
    icon: '🧠',
    items: [
      { path: '/', label: '概览', testId: 'nav-overview', keywords: ['dashboard'] },
      { path: '/insights', label: 'AI 智能分析', testId: 'nav-insights', keywords: ['insights'] },
      { path: '/orchestration', label: '编排台', testId: 'nav-orchestration', keywords: ['workflow'] },
      { path: '/agents', label: '合规 Agent', testId: 'nav-agents', keywords: ['compliance'] },
      { path: '/agent-config', label: 'Agent 配置', testId: 'nav-agent-config', keywords: ['config'] },
      { path: '/eval-dashboard', label: 'Eval 仪表盘', testId: 'nav-eval-dashboard', keywords: ['eval', 'dashboard'] },
    ],
  },
  {
    key: 'system',
    label: '系统',
    icon: '⚙️',
    items: [
      { path: '/audit', label: '审计', testId: 'nav-audit', keywords: ['audit'] },
      { path: '/privacy-override-log', label: 'Override 日志', testId: 'nav-privacy-override-log', keywords: ['privacy', 'override'] },
      { path: '/noise-stats-lab', label: '噪声实验室', testId: 'nav-noise-stats-lab', keywords: ['noise', 'audio', 'meter'] },
      { path: '/notifications', label: '通知', testId: 'nav-notifications', keywords: ['notification'] },
      { path: '/data', label: '数据', testId: 'nav-data', keywords: ['data'] },
    ],
  },
];

export function resolveNavGroups(): NavGroup[] {
  return PRIMARY_NAV_GROUPS;
}

export function findNavItemByPath(path: string): { group: NavGroup; item: NavItem } | null {
  for (const group of PRIMARY_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.path === path) return { group, item };
    }
  }
  return null;
}