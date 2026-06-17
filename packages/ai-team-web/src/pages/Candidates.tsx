import { useEffect, useState } from 'react';
import { loadTeamData, type TeamData } from '../lib/data';
import { formatDate, statusLabel } from '../lib/format';

export function Candidates() {
  const [data, setData] = useState<TeamData | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadTeamData().then(setData);
  }, []);

  if (!data) return <div className="text-slate-500">加载中...</div>;

  const items = filter === 'all' ? data.candidates : data.candidates.filter((c) => c.status === filter);
  const statuses = ['all', ...new Set(data.candidates.map((c) => c.status))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">候选人</h2>
          <p className="mt-1 text-sm text-slate-500">共 {data.candidates.length} 位候选人</p>
        </div>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn ${filter === s ? 'bg-brand-50 text-brand-700' : 'btn-ghost'}`}
            >
              {s === 'all' ? '全部' : statusLabel(s).text}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card text-center text-slate-500">
          暂无候选人。使用 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">ai-team candidate add</code> 录入
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c0) => {
            const st = statusLabel(c0.status);
            return (
              <div key={c0.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{c0.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{c0.position}</p>
                  </div>
                  <span className={st.cls}>{st.text}</span>
                </div>
                <div className="mt-4 space-y-1 text-xs text-slate-500">
                  <p>ID: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{c0.id}</code></p>
                  <p>来源: {c0.source}</p>
                  {c0.email && <p>邮箱: {c0.email}</p>}
                  <p>录入: {formatDate(c0.createdAt)}</p>
                </div>
                {c0.tags && c0.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c0.tags.map((t) => (
                      <span key={t} className="badge-slate">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
