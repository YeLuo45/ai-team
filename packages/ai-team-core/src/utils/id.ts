// ID generation utilities

export function generateId(prefix: string): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  // Random 6-char suffix (36^6 = 2.1B combinations, plenty for V1)
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `${prefix}_${yyyy}${mm}${dd}-${suffix}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
