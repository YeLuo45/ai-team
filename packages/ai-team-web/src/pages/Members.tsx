import { useState } from 'react';
import { useTeamData } from '../lib/hooks';
import { formatDate, statusLabel } from '../lib/format';
import { AddMemberModal } from '../components/AddMemberModal';

export function Members() {
  const { data, source, refresh } = useTeamData();
  const [showAdd, setShowAdd] = useState(false);

  const byTeam = new Map<string, typeof data.members>();
  for (const m of data.members) {
    const list = byTeam.get(m.team) ?? [];
    list.push(m);
    byTeam.set(m.team, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">团队成员</h2>
          <p className="mt-1 text-sm text-slate-500">
            共 {data.members.length} 位成员，{byTeam.size} 个团队
            {source === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
            {source === 'api' && <span className="ml-2 badge-green">● 实时</span>}
          </p>
        </div>
        {source === 'api' && (
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ 添加成员</button>
        )}
      </div>

      {data.members.length === 0 ? (
        <div className="card text-center text-slate-500">
          暂无成员
          {source === 'api' ? <span> · 点击右上角添加</span> : <span> · 启动 server 启用添加功能</span>}
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
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onAdded={() => refresh()}
        />
      )}
    </div>
  );
}
