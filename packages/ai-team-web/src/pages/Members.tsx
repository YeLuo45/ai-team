import { useEffect, useState } from 'react';
import { loadTeamData, type TeamData } from '../lib/data';
import { formatDate, statusLabel } from '../lib/format';

export function Members() {
  const [data, setData] = useState<TeamData | null>(null);

  useEffect(() => {
    loadTeamData().then(setData);
  }, []);

  if (!data) return <div className="text-slate-500">加载中...</div>;

  const byTeam = new Map<string, typeof data.members>();
  for (const m of data.members) {
    const list = byTeam.get(m.team) ?? [];
    list.push(m);
    byTeam.set(m.team, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">团队成员</h2>
        <p className="mt-1 text-sm text-slate-500">共 {data.members.length} 位成员，{byTeam.size} 个团队</p>
      </div>

      {data.members.length === 0 ? (
        <div className="card text-center text-slate-500">
          暂无成员。使用 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">ai-team member add</code> 添加
        </div>
      ) : (
        <div className="space-y-6">
          {[...byTeam.entries()].map(([team, members]) => (
            <div key={team} className="card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{team}</h3>
                <span className="text-sm text-slate-500">{members.length} 人</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((m) => {
                  const st = statusLabel(m.status);
                  return (
                    <div key={m.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-base font-semibold text-slate-900 dark:text-slate-50">{m.name}</div>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {m.role}{m.level ? ` · ${m.level}` : ''}
                          </p>
                        </div>
                        <span className={st.cls}>{st.text}</span>
                      </div>
                      {m.manager && <p className="mt-2 text-xs text-slate-500">经理: {m.manager}</p>}
                      <p className="mt-1 text-xs text-slate-500">入职: {formatDate(m.joinedAt)}</p>
                      {m.skills.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-slate-500">技能 ({m.skills.length})</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.skills.slice(0, 6).map((s) => (
                              <span key={s.skillId} className="badge-blue">{s.skillId} {s.score}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
