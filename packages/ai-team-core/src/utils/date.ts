// Date utilities

export function formatDate(iso: string | undefined): string {
  if (!iso) return '-';
  return iso.slice(0, 10);
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-';
  return iso.replace('T', ' ').slice(0, 19);
}

export function daysSince(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
