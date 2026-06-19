// Insights page - AI smart analytics dashboard

import { useEffect, useState } from 'react';

interface FunnelResult {
  stages: Array<{ stage: string; count: number }>;
  conversionRates: Array<{ from: string; to: string; rate: number }>;
  bySource: Array<{ source: string; total: number; hired: number; rate: number }>;
  totalCandidates: number;
  totalHired: number;
  overallRate: number;
}

interface SkillGap {
  skill: string;
  teamAvg: number;
  membersWithSkill: number;
  demandLevel: 'low' | 'medium' | 'high';
  gap: number;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'hiring' | 'training' | 'process' | 'culture';
  message: string;
}

interface InsightsResult {
  summary: string;
  recommendations: Recommendation[];
  anomalies: Array<{ type: string; memberId?: string; message: string; severity: 'warning' | 'critical' }>;
}

const STAGE_LABELS: Record<string, string> = {
  new: '新录入',
  screening: '筛选',
  interviewing: '面试中',
  offer: 'Offer',
  hired: '已入职',
  rejected: '已拒绝',
};

const STAGE_COLORS: Record<string, string> = {
  new: '#a5b4fc',
  screening: '#818cf8',
  interviewing: '#6366f1',
  offer: '#4f46e5',
  hired: '#10b981',
  rejected: '#f87171',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'badge-rose',
  medium: 'badge-amber',
  low: 'badge-slate',
};

const CATEGORY_ICONS: Record<string, string> = {
  hiring: '👤',
  training: '📚',
  process: '⚙️',
  culture: '💬',
};

export function Insights() {
  const [funnel, setFunnel] = useState<FunnelResult | null>(null);
  const [gaps, setGaps] = useState<SkillGap[] | null>(null);
  const [recs, setRecs] = useState<InsightsResult | null>(null);
  const [anomalies, setAnomalies] = useState<{ anomalies: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/insights/funnel').then((r) => r.json()),
      fetch('/api/insights/skill-gaps').then((r) => r.json()),
      fetch('/api/insights/recommendations').then((r) => r.json()),
      fetch('/api/insights/anomalies').then((r) => r.json()),
    ]).then(([f, g, r, a]) => {
      setFunnel(f);
      setGaps(g);
      setRecs(r);
      setAnomalies(a);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">加载分析中...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">🧠 AI 智能分析</h2>
        <p className="mt-1 text-sm text-slate-500">
          基于团队数据自动识别的招聘漏斗、技能缺口、AI 建议和异常事件
        </p>
      </div>

      {recs?.summary && (
        <div className="card border-l-4 border-l-brand-500 bg-gradient-to-r from-brand-50 to-transparent">
          <h3 className="text-sm font-semibold text-brand-800">📊 团队状态总结</h3>
          <p className="mt-2 text-sm text-slate-700">{recs.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel Chart */}
        <div className="card">
          <h3 className="mb-3 text-base font-semibold">📊 招聘漏斗</h3>
          {funnel && funnel.totalCandidates > 0 ? (
            <>
              <FunnelChart stages={funnel.stages} />
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">总候选人</div>
                  <div className="text-xl font-bold">{funnel.totalCandidates}</div>
                </div>
                <div className="rounded bg-emerald-50 p-2">
                  <div className="text-xs text-emerald-700">已入职</div>
                  <div className="text-xl font-bold text-emerald-700">{funnel.totalHired}</div>
                </div>
              </div>
              {funnel.bySource.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1 text-xs text-slate-500">按来源</p>
                  <div className="space-y-1">
                    {funnel.bySource.map((s) => (
                      <div key={s.source} className="flex items-center justify-between text-xs">
                        <span>{s.source}</span>
                        <span className="text-slate-500">
                          {s.hired}/{s.total} ({Math.round(s.rate * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">暂无候选人数据</p>
          )}
        </div>

        {/* Skill Gaps */}
        <div className="card">
          <h3 className="mb-3 text-base font-semibold">💡 技能差距雷达</h3>
          {gaps && gaps.length > 0 ? (
            <div className="space-y-2">
              {gaps.slice(0, 8).map((g) => (
                <div key={g.skill} className="flex items-center gap-3">
                  <div className="w-24 truncate text-sm font-medium" title={g.skill}>
                    {g.skill.replace('sk_', '')}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full ${
                          g.demandLevel === 'high' ? 'bg-rose-500' : g.demandLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${g.teamAvg}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right text-sm font-bold">{g.teamAvg}</div>
                  {g.demandLevel === 'high' && (
                    <span className="badge-rose text-[10px]">缺口</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">暂无技能数据</p>
          )}
        </div>

        {/* AI Recommendations */}
        <div className="card lg:col-span-2">
          <h3 className="mb-3 text-base font-semibold">🤖 AI 建议</h3>
          {recs && recs.recommendations.length > 0 ? (
            <div className="space-y-2">
              {recs.recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <span className="text-2xl">{CATEGORY_ICONS[r.category]}</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{r.message}</p>
                    <div className="mt-1 flex gap-2">
                      <span className={PRIORITY_COLORS[r.priority] + ' text-[10px]'}>
                        {r.priority === 'high' ? '高优' : r.priority === 'medium' ? '中优' : '低优'}
                      </span>
                      <span className="badge-slate text-[10px]">{r.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">暂无 AI 建议</p>
          )}
        </div>

        {/* Anomalies */}
        <div className="card lg:col-span-2">
          <h3 className="mb-3 text-base font-semibold">⚠️ 异常检测</h3>
          {anomalies && anomalies.anomalies.length > 0 ? (
            <div className="space-y-2">
              {anomalies.anomalies.map((a, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${a.severity === 'critical' ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50'}`}>
                  <span>{a.severity === 'critical' ? '🔴' : '⚠️'}</span>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-600">✅ 未检测到异常</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelChart({ stages }: { stages: Array<{ stage: string; count: number }> }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="space-y-1">
      {stages.map((s) => {
        const width = s.count > 0 ? Math.max(10, (s.count / max) * 100) : 0;
        return (
          <div key={s.stage} className="flex items-center gap-2">
            <div className="w-16 text-xs text-slate-600">{STAGE_LABELS[s.stage] ?? s.stage}</div>
            <div className="flex-1 overflow-hidden rounded">
              <div
                className="flex h-7 items-center justify-end px-2 text-xs font-bold text-white"
                style={{ width: `${width}%`, backgroundColor: STAGE_COLORS[s.stage] ?? '#94a3b8' }}
              >
                {s.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
