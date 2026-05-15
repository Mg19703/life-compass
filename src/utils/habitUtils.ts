import type { HabitLog } from '../types';

// ─── Date helper (local — no cross-module deps) ───────────────────────────────

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── calculateStreak ──────────────────────────────────────────────────────────
//
// Returns the current active streak for a given habit, anchored to `today`.
//
// Streak definition:
//   - If today is completed: count backward from today (today counts as day 1).
//   - If today is NOT completed: count backward from yesterday (today is not
//     yet resolved; the streak reflects the last unbroken run ending yesterday).
//   - A day with no HabitLog entry, or with completed===false, breaks the streak.
//   - Future-dated logs (date > today) are ignored.
//   - Duplicate logs for the same habitId+date: the day is treated as completed
//     if any entry has completed===true.
//   - If no habitId match exists, returns 0.
//
// Pure function — no side effects, deterministic for same inputs.
// `today` is injectable so all callers (and tests) can control the date anchor.

export function calculateStreak(
  habitId: string,
  habitLogs: HabitLog[],
  today: string,
): number {
  // Build a Set of completed dates for this habit, excluding future dates
  const completedDates = new Set(
    habitLogs
      .filter(l => l.habitId === habitId && l.completed && l.date <= today)
      .map(l => l.date),
  );

  if (completedDates.size === 0) return 0;

  // Anchor: start from today if completed, yesterday if not
  const anchor = completedDates.has(today) ? today : addDays(today, -1);

  let streak = 0;
  let cursor = anchor;

  while (completedDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}
