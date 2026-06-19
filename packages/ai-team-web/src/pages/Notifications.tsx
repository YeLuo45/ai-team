// Notifications page - list + filter + mark as read

import { useEffect, useState } from 'react';
import { formatDateTime } from '../lib/format';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

const TYPE_BADGE: Record<string, string> = {
  'candidate.created': 'badge-blue',
  'interview.completed': 'badge-green',
  'review.saved': 'badge-amber',
  'training.created': 'badge-slate',
  plugin: 'badge-red',
  system: 'badge-slate',
};

export function Notifications() {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    try {
      const r = await fetch('/api/notifications');
      setList(await r.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setList((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteOne = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    setList((prev) => prev.filter((n) => n.id !== id));
  };

  if (loading) return <div className="text-slate-500">加载通知...</div>;

  const filtered = filter === 'unread' ? list.filter((n) => !n.read) : list;
  const unread = list.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">🔔 通知中心</h2>
          <p className="mt-1 text-sm text-slate-500">
            {list.length} 条通知 · {unread} 未读
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={filter === 'all' ? 'btn bg-brand-50 text-brand-700' : 'btn-ghost'}>全部</button>
          <button onClick={() => setFilter('unread')} className={filter === 'unread' ? 'btn bg-brand-50 text-brand-700' : 'btn-ghost'}>
            未读 {unread > 0 && <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{unread}</span>}
          </button>
          {unread > 0 && (
            <button onClick={markAllRead} className="btn-ghost text-xs">✓ 全部已读</button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-slate-500">暂无通知</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`card flex items-start gap-3 ${!n.read ? 'border-l-4 border-l-brand-500' : 'opacity-70'}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={TYPE_BADGE[n.type] ?? 'badge-slate'}>{n.type}</span>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">{n.title}</h3>
                  {!n.read && <span className="badge-rose text-[10px]">NEW</span>}
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
              </div>
              <div className="flex flex-col gap-1">
                {n.link && (
                  <a href={n.link} onClick={() => markRead(n.id)} className="btn-ghost text-xs">查看</a>
                )}
                {!n.read && (
                  <button onClick={() => markRead(n.id)} className="btn-ghost text-xs">✓ 已读</button>
                )}
                <button onClick={() => deleteOne(n.id)} className="btn-ghost text-xs text-rose-500">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
