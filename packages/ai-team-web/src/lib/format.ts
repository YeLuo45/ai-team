// Formatting helpers

export function formatDate(iso: string | undefined): string {
  if (!iso) return '-';
  return iso.slice(0, 10);
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-';
  return iso.replace('T', ' ').slice(0, 19);
}

export function relativeTime(iso: string | undefined): string {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(iso);
}

export function recommendationLabel(r: string | undefined): { text: string; cls: string } {
  const map: Record<string, { text: string; cls: string }> = {
    strong_hire: { text: '强烈推荐', cls: 'badge-green' },
    hire: { text: '推荐', cls: 'badge-blue' },
    no_hire: { text: '不推荐', cls: 'badge-amber' },
    strong_no_hire: { text: '强烈不推荐', cls: 'badge-red' },
  };
  return (r && map[r]) || { text: r ?? '-', cls: 'badge-slate' };
}

export function statusLabel(s: string): { text: string; cls: string } {
  const map: Record<string, { text: string; cls: string }> = {
    new: { text: '新录入', cls: 'badge-slate' },
    screening: { text: '筛选中', cls: 'badge-blue' },
    interviewing: { text: '面试中', cls: 'badge-amber' },
    offer: { text: '已发 Offer', cls: 'badge-green' },
    hired: { text: '已入职', cls: 'badge-green' },
    rejected: { text: '已拒绝', cls: 'badge-red' },
    scheduled: { text: '已安排', cls: 'badge-slate' },
    in_progress: { text: '进行中', cls: 'badge-amber' },
    completed: { text: '已完成', cls: 'badge-green' },
    cancelled: { text: '已取消', cls: 'badge-slate' },
    active: { text: '在职', cls: 'badge-green' },
    on_leave: { text: '休假', cls: 'badge-amber' },
    exited: { text: '已离职', cls: 'badge-slate' },
  };
  return map[s] || { text: s, cls: 'badge-slate' };
}
