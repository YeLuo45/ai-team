import { useEffect, useState } from 'react';
import { loadTeamData, type TeamData } from '../lib/data';
import { formatDate, formatDateTime, recommendationLabel } from '../lib/format';

export function Dashboard() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-slate-500">加载中...</div>;
  }
  if (!data) {
    return <div className="text-slate-500">暂无数据</div>;
  }

  const activeMembers = data.members.filter((m) => m.status === 'active');
  const completedInterviews = data.interviews.filter((i) => i.status === 'completed');
  const avgScore =
    completedInterviews.length > 0
      ? Math.round(
          completedInterviews.reduce((s, i) => s + (i.evaluation?.overall ?? 0), 0) /
            completedInterviews.length
        )
      : 0;

  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const interviewsThisMonth = data.interviews.filter((i) => i.startedAt?.startsWith(thisMonth));

  const teamCounts = new Map<string, number>();
  for (const m of activeMembers) {
    teamCounts.set(m.team, (teamCounts.get(m.team) ?? 0) + 1);
  }

  const recentInterviews = [...completedInterviews]
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 5);

  const recentCandidates = [...data.candidates]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">团队概览</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          数据更新于 {formatDateTime(data.generatedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <span className="stat-label">在职成员</span>
          <span className="stat-value">{activeMembers.length}</span>
          <span className="text-xs text-slate-500">总计 {data.members.length} 人</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">候选人</span>
          <span className="stat-value">{data.candidates.length}</span>
          <span className="text-xs text-slate-500">招聘中</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">本月面试</span>
          <span className="stat-value">{interviewsThisMonth.length}</span>
          <span className="text-xs text-slate-500">总计 {data.interviews.length} 场</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">平均评分</span>
          <span className="stat-value">{avgScore}<span className="text-base text-slate-400">/100</span></span>
          <span className="text-xs text-slate-500">{completedInterviews.length} 场已完成</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-50">最近面试</h3>
          {recentInterviews.length === 0 ? (
            <p className="text-sm text-slate-500">暂无面试记录</p>
          ) : (
            <ul className="space-y-3">
              {recentInterviews.map((iv) => {
                const rec = recommendationLabel(iv.evaluation?.recommendation);
                return (
                  <li key={iv.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{iv.id}</span>
                        <span className="badge-slate">{iv.type}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        候选人 {iv.candidateId} · {iv.position} · {formatDate(iv.completedAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-lg font-bold text-brand-600">{iv.evaluation?.overall ?? '-'}</span>
                      <span className={rec.cls}>{rec.text}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-50">最近候选人</h3>
          {recentCandidates.length === 0 ? (
            <p className="text-sm text-slate-500">暂无候选人</p>
          ) : (
            <ul className="space-y-3">
              {recentCandidates.map((c0) => (
                <li key={c0.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-50">{c0.name}</div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {c0.position} · {c0.source} · {formatDate(c0.createdAt)}
                    </p>
                  </div>
                  <span className="badge-blue">{c0.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-50">团队分布</h3>
        {teamCounts.size === 0 ? (
          <p className="text-sm text-slate-500">暂无团队</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...teamCounts.entries()].map(([team, count]) => (
              <div key={team} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="text-xs text-slate-500">{team}</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{count} <span className="text-sm text-slate-400">人</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
