// ─── Shared date utilities ────────────────────────────────────────────────────
// Single source of truth for ISO-date helpers used across multiple tabs and
// components. All functions operate on YYYY-MM-DD strings in local calendar
// time (T00:00:00 anchors prevent UTC-offset drift).

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Returns the Monday of the ISO week containing `iso`. */
export function snapToMonday(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
