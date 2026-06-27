// V113: Pure calendar helpers — zero deps, fully testable

export interface CalendarCell {
  year: number;
  month: number;
  day: number;
  iso: string;
  inMonth: boolean;
}

export function buildCalendarMonth(year: number, month: number): CalendarCell[] {
  // month is 0-indexed (0=Jan)
  const first = new Date(year, month, 1);
  const firstDay = first.getDay(); // 0=Sun
  const startDate = new Date(year, month, 1 - firstDay);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    cells.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      iso,
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

export function buildHeatmapCalendar(
  year: number,
  month: number,
  items: Array<{ id: string; date: string }>
): Record<string, number> {
  const out: Record<string, number> = {};
  const cells = buildCalendarMonth(year, month);
  for (const c of cells) out[c.iso] = 0;
  for (const it of items) {
    if (typeof it.date === 'string' && it.date in out) {
      out[it.date] = (out[it.date] ?? 0) + 1;
    }
  }
  return out;
}

export function groupInterviewsByDate<T extends { id: string; date: string }>(
  items: T[]
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of items) {
    if (!out[it.date]) out[it.date] = [];
    out[it.date].push(it);
  }
  return out;
}

export function formatInterviewTime(t: string): string {
  return t; // already HH:mm
}

export function calendarMonthLabel(year: number, month: number): string {
  return `${year} 年 ${month + 1} 月`;
}

export function calendarPrevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 0) return { year: year - 1, month: 11 };
  return { year, month: month - 1 };
}

export function calendarNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 11) return { year: year + 1, month: 0 };
  return { year, month: month + 1 };
}

export function navigateCalendarMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}