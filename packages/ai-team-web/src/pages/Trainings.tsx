// Trainings list - displays saved training plans

import { useState, useEffect } from 'react';
import { formatDate } from '../lib/format';
import type { Training, Member } from '@ai-team/core';

void useState;
void formatDate;

const TYPE_LABELS: Record<Training['type'], string> = {
  course: '课程',
  mentoring: '辅导',
  project: '实战',
  reading: '阅读',
  certification: '认证',
};
const TYPE_COLORS: Record<Training['type'], string> = {
  course: 'badge-blue',
  mentoring: 'badge-green',
  project: 'badge-amber',
  reading: 'badge-slate',
  certification: 'badge-red',
};
const STATUS_COLORS: Record<Training['status'], string> = {
  planned: 'badge-slate',
  in_progress: 'badge-amber',
  completed: 'badge-green',
  cancelled: 'badge-red',
};

export function Trainings() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dataSource, setDataSource] = useState<'api' | 'static' | 'none'>('none');

  useEffect(() => {
    (async () => {
      try {
        // Check API
        const healthResp = await fetch('/api/health', { signal: AbortSignal.timeout(1000) });
        if (healthResp.ok) {
          const [trainingsResp, membersResp] = await Promise.all([
            fetch('/api/trainings'),
            fetch('/api/members'),
          ]);
          setTrainings(await trainingsResp.json());
          setMembers(await membersResp.json());
          setDataSource('api');
        } else {
          throw new Error('API down');
        }
      } catch {
        // Fallback to static
        const teamResp = await fetch(`${import.meta.env.BASE_URL}data/team.json`);
        const team = await teamResp.json();
        setTrainings(team.trainings ?? []);
        setMembers(team.members ?? []);
        setDataSource('static');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-slate-500">加载培训计划...</div>;

  const filtered = statusFilter === 'all' ? trainings : trainings.filter((t) => t.status === statusFilter);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const statuses = ['all', ...new Set(trainings.map((t) => t.status))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">培训计划</h2>
          <p className="mt-1 text-sm text-slate-500">
            共 {trainings.length} 项培训
            {dataSource === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
            {dataSource === 'api' && <span className="ml-2 badge-green">● 实时</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`btn ${statusFilter === s ? 'bg-brand-50 text-brand-700' : 'btn-ghost'}`}>
              {s === 'all' ? '全部' : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-slate-500">
          暂无培训计划
          {dataSource === 'api' && <span> · 去 Members 页点击 "🤖 生成培训计划"</span>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const m = memberById.get(t.memberId);
            return (
              <div key={t.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">{t.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{m?.name ?? t.memberId}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={TYPE_COLORS[t.type]}>{TYPE_LABELS[t.type]}</span>
                    <span className={STATUS_COLORS[t.status]}>{t.status}</span>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{t.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>开始: {formatDate(t.startDate)}</span>
                  <span>AI{t.aiRecommended ? ' ✨' : ''}</span>
                </div>
                {t.milestones.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-xs text-slate-500">里程碑 ({t.milestones.length})</div>
                    <div className="space-y-1">
                      {t.milestones.map((ms, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={ms.completedAt ? 'text-emerald-500' : 'text-slate-400'}>
                            {ms.completedAt ? '●' : '○'}
                          </span>
                          <span className={ms.completedAt ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}>
                            {ms.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full bg-brand-500" style={{ width: `${t.progress}%` }} />
                </div>
                <div className="mt-1 text-right text-xs text-slate-500">{t.progress}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
