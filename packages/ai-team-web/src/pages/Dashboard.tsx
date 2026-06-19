// Dashboard with editable layout - drag-and-drop widgets + localStorage persistence

import { useEffect, useMemo, useState } from 'react';
import { useTeamData } from '../lib/hooks';
import { formatDate, recommendationLabel, statusLabel } from '../lib/format';

type WidgetId = 'stats' | 'recentInterviews' | 'recentCandidates' | 'teamDist' | 'topSkills' | 'recentNotifications';
const ALL_WIDGETS: WidgetId[] = ['stats', 'recentInterviews', 'recentCandidates', 'teamDist', 'topSkills', 'recentNotifications'];
const WIDGET_LABELS: Record<WidgetId, string> = {
  stats: '📊 统计卡片',
  recentInterviews: '🎤 最近面试',
  recentCandidates: '👤 最近候选人',
  teamDist: '🏢 团队分布',
  topSkills: '💡 热门技能',
  recentNotifications: '🔔 最近通知',
};
const DEFAULT_LAYOUT: WidgetId[] = ['stats', 'recentInterviews', 'recentCandidates', 'teamDist', 'topSkills', 'recentNotifications'];

const STORAGE_KEY = 'ai-team-dashboard-layout';

interface Layout {
  order: WidgetId[];
  hidden: WidgetId[];
}

function loadLayout(): Layout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate: only keep known widgets
      const order = (parsed.order as string[]).filter((w) => ALL_WIDGETS.includes(w as WidgetId)) as WidgetId[];
      const hidden = (parsed.hidden as string[]).filter((w) => ALL_WIDGETS.includes(w as WidgetId)) as WidgetId[];
      // Add any missing widgets
      ALL_WIDGETS.forEach((w) => { if (!order.includes(w)) order.push(w); });
      return { order, hidden };
    }
  } catch { /* ignore */ }
  return { order: DEFAULT_LAYOUT, hidden: [] };
}

function saveLayout(layout: Layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch { /* ignore */ }
}

export function Dashboard() {
  const { data, source } = useTeamData();
  const [layout, setLayout] = useState<Layout>({ order: DEFAULT_LAYOUT, hidden: [] });
  const [editing, setEditing] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => { setLayout(loadLayout()); }, []);
  useEffect(() => { if (editing) saveLayout(layout); }, [layout, editing]);

  // Fetch additional data when needed
  useEffect(() => {
    if (source !== 'api') return;
    (async () => {
      try {
        const [s, n] = await Promise.all([
          fetch('/api/stats').then((r) => r.ok ? r.json() : null),
          fetch('/api/notifications').then((r) => r.ok ? r.json() : []),
        ]);
        if (s) setStats(s);
        if (Array.isArray(n)) setNotifications(n);
      } catch { /* ignore */ }
    })();
  }, [source]);

  // Compute derived data
  const localStats = useMemo(() => {
    const active = data.members.filter((m) => m.status === 'active');
    const completed = data.interviews.filter((i) => i.evaluation);
    const avgScore = completed.length
      ? Math.round(completed.reduce((s, i) => s + (i.evaluation?.overall ?? 0), 0) / completed.length)
      : 0;
    const teamCounts = new Map<string, number>();
    for (const m of active) teamCounts.set(m.team, (teamCounts.get(m.team) ?? 0) + 1);
    return {
      activeMembers: active.length,
      candidates: data.candidates.length,
      totalInterviews: data.interviews.length,
      avgScore,
      teamCounts: Object.fromEntries(teamCounts),
    };
  }, [data]);

  const displayStats = stats ?? localStats;

  const topSkills = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const m of data.members) {
      for (const s of m.skills) {
        const cur = map.get(s.skillId) ?? { total: 0, count: 0 };
        cur.total += s.score;
        cur.count += 1;
        map.set(s.skillId, cur);
      }
    }
    return [...map.entries()]
      .map(([k, v]) => ({ skill: k, avg: Math.round(v.total / v.count), count: v.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [data]);

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      return;
    }
    const newOrder = [...layout.order];
    const [removed] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, removed);
    setLayout({ ...layout, order: newOrder });
    setDraggedIdx(null);
  };

  const toggleHidden = (w: WidgetId) => {
    const hidden = layout.hidden.includes(w) ? layout.hidden.filter((x) => x !== w) : [...layout.hidden, w];
    setLayout({ ...layout, hidden });
  };

  const resetLayout = () => {
    setLayout({ order: DEFAULT_LAYOUT, hidden: [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">团队概览</h2>
          <p className="mt-1 text-sm text-slate-500">
            数据更新于 {formatDate(data.generatedAt)}
            {source === 'static' && <span className="ml-2 badge-amber">静态数据</span>}
            {source === 'api' && <span className="ml-2 badge-green">● 实时</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {editing && <button onClick={resetLayout} className="btn-ghost text-xs">↺ 重置默认</button>}
          <button
            onClick={() => setEditing(!editing)}
            className={editing ? 'btn-primary' : 'btn-ghost'}
          >
            {editing ? '💾 完成编辑' : '✏️ 编辑布局'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 p-3 text-sm dark:border-brand-700 dark:bg-brand-900/20">
          <p className="font-semibold text-brand-800 dark:text-brand-200">✏️ 编辑模式</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            拖动 widget 重新排序 · 点击 👁/🚫 切换显示 · 关闭此模式保存
          </p>
        </div>
      )}

      <div className="space-y-4">
        {layout.order.filter((w) => !layout.hidden.includes(w)).map((w, idx) => {
          const Widget = WIDGETS[w];
          return (
            <div
              key={w}
              draggable={editing}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              className={editing ? `cursor-move ${draggedIdx === idx ? 'opacity-50' : ''}` : ''}
            >
              <div className="relative">
                {editing && (
                  <div className="absolute -left-3 top-3 z-10 flex flex-col gap-1">
                    <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">≡</span>
                  </div>
                )}
                {editing && (
                  <button
                    onClick={() => toggleHidden(w)}
                    className="absolute -right-3 top-3 z-10 rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-900"
                    title="隐藏"
                  >
                    🚫
                  </button>
                )}
                <Widget stats={displayStats} team={data} topSkills={topSkills} notifications={notifications} />
              </div>
            </div>
          );
        })}

        {layout.hidden.length > 0 && editing && (
          <div className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
            <p className="mb-2 text-xs text-slate-500">已隐藏 (点击恢复):</p>
            <div className="flex flex-wrap gap-2">
              {layout.hidden.map((w) => (
                <button key={w} onClick={() => toggleHidden(w)} className="btn-ghost text-xs">
                  👁 {WIDGET_LABELS[w]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== Widgets ==============
type WidgetProps = {
  stats: any;
  team: { candidates: any[]; members: any[]; interviews: any[]; trainings: any[] };
  topSkills: { skill: string; avg: number; count: number }[];
  notifications: any[];
};

function StatsWidget({ stats }: WidgetProps) {
  if (!stats) return <div className="card text-slate-500">加载中...</div>;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatBox label="在职成员" value={stats.activeMembers} sub={`总计 ${stats.totalMembers}`} />
      <StatBox label="候选人" value={stats.candidates} sub="招聘中" />
      <StatBox label="本月面试" value={stats.totalInterviews} sub={`完成 ${stats.completedInterviews}`} />
      <StatBox label="平均评分" value={stats.avgScore} sub="满分 100" />
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-3xl font-bold text-slate-900 dark:text-slate-50">{value}</span>
      <span className="text-xs text-slate-500">{sub}</span>
    </div>
  );
}

function RecentInterviewsWidget({ team }: WidgetProps) {
  const recent = [...team.interviews].slice(-5).reverse();
  if (recent.length === 0) return <div className="card text-slate-500">暂无面试</div>;
  return (
    <div className="card">
      <h3 className="mb-3 text-base font-semibold">🎤 最近面试</h3>
      <ul className="space-y-2">
        {recent.map((iv: any) => {
          const rec = recommendationLabel(iv.evaluation?.recommendation);
          return (
            <li key={iv.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
              <div>
                <div className="text-sm font-medium">{iv.id}</div>
                <div className="text-xs text-slate-500">{iv.position} · {formatDate(iv.completedAt ?? iv.startedAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-brand-600">{iv.evaluation?.overall ?? '-'}</span>
                <span className={rec.cls}>{rec.text}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentCandidatesWidget({ team }: WidgetProps) {
  const recent = [...team.candidates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  if (recent.length === 0) return <div className="card text-slate-500">暂无候选人</div>;
  return (
    <div className="card">
      <h3 className="mb-3 text-base font-semibold">👤 最近候选人</h3>
      <ul className="space-y-2">
        {recent.map((c: any) => {
          const st = statusLabel(c.status);
          return (
            <li key={c.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-slate-500">{c.position} · {c.source}</div>
              </div>
              <span className={st.cls}>{st.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TeamDistWidget({ stats }: WidgetProps) {
  const counts = stats?.teamCounts ?? {};
  const teams = Object.entries(counts);
  if (teams.length === 0) return <div className="card text-slate-500">暂无团队</div>;
  return (
    <div className="card">
      <h3 className="mb-3 text-base font-semibold">🏢 团队分布</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {teams.map(([t, c]: [string, any]) => (
          <div key={t} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="text-xs text-slate-500">{t}</div>
            <div className="text-2xl font-bold">{c} <span className="text-sm text-slate-400">人</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopSkillsWidget({ topSkills }: WidgetProps) {
  if (topSkills.length === 0) return <div className="card text-slate-500">暂无技能数据</div>;
  return (
    <div className="card">
      <h3 className="mb-3 text-base font-semibold">💡 热门技能 (Top 5)</h3>
      <div className="space-y-2">
        {topSkills.map((s) => (
          <div key={s.skill} className="flex items-center gap-3">
            <div className="w-32 truncate text-sm font-medium">{s.skill.replace('sk_', '')}</div>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full bg-brand-500" style={{ width: `${s.avg}%` }} />
              </div>
            </div>
            <div className="w-16 text-right text-sm font-bold text-brand-600">{s.avg}</div>
            <div className="w-12 text-right text-xs text-slate-500">{s.count}人</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentNotificationsWidget({ notifications }: WidgetProps) {
  const recent = notifications.slice(0, 3);
  if (recent.length === 0) return <div className="card text-slate-500">暂无通知</div>;
  return (
    <div className="card">
      <h3 className="mb-3 text-base font-semibold">🔔 最近通知</h3>
      <ul className="space-y-2">
        {recent.map((n: any) => (
          <li key={n.id} className="flex items-start gap-2 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
            <div className={`mt-0.5 h-2 w-2 rounded-full ${n.read ? 'bg-slate-300' : 'bg-rose-500'}`}></div>
            <div className="flex-1">
              <div className="text-sm font-medium">{n.title}</div>
              <div className="text-xs text-slate-500">{n.message}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const WIDGETS: Record<WidgetId, React.FC<WidgetProps>> = {
  stats: StatsWidget,
  recentInterviews: RecentInterviewsWidget,
  recentCandidates: RecentCandidatesWidget,
  teamDist: TeamDistWidget,
  topSkills: TopSkillsWidget,
  recentNotifications: RecentNotificationsWidget,
};
