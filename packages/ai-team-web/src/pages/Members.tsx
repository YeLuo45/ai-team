import { useState } from 'react';
import { useTeamData } from '../lib/hooks';
import { formatDate, statusLabel } from '../lib/format';
import { AddMemberModal } from '../components/AddMemberModal';
import { TrainingPlanModal } from '../components/TrainingPlanModal';

export function Members() {
  const { data, source, refresh } = useTeamData();
  const [showAdd, setShowAdd] = useState(false);
  const [trainingTarget, setTrainingTarget] = useState<any>(null);

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
        <div className="card text-center text-slate-500">暂无成员</div>
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
                            {m.skills.slice(0, 5).map((s) => (
                              <span key={s.skillId} className="badge-blue text-[10px]">
                                {s.skillId.replace('sk_', '').replace('kafka', 'Kafka').slice(0, 12)} {s.score}
                              </span>
                            ))}
                            {m.skills.length > 5 && <span className="badge-slate text-[10px]">+{m.skills.length - 5}</span>}
                          </div>
                        </div>
                      )}
                      {source === 'api' && (
                        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <button
                            onClick={() => setTrainingTarget(m)}
                            className="btn-primary w-full text-xs"
                          >
                            🤖 生成培训计划
                          </button>
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

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onAdded={() => refresh()}
        />
      )}

      {trainingTarget && (
        <TrainingPlanModal
          member={trainingTarget}
          onClose={() => setTrainingTarget(null)}
          onSaved={() => refresh()}
        />
      )}
    </div>
  );
}
