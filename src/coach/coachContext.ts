import type { AppState } from '../types';
import { LIFE_DIMENSIONS } from '../defaults';
import { calculateStreak } from '../utils/habitUtils';

// Returned when profile is incomplete — callers must check before making an API call.
export const COACH_SETUP_INCOMPLETE = 'User has not yet completed Setup';

// ─── Date utilities (local — avoids cross-module deps) ────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function snapToMonday(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return isoDate(d);
}

function currentQuarter(month: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

// Rough token estimator: ~4 chars per token (English prose average)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Context payload builder ──────────────────────────────────────────────────
//
// Pure function — deterministic given the same AppState and the same `now`.
// Injectable `now` parameter makes every date-relative calculation testable.
//
// Returns COACH_SETUP_INCOMPLETE sentinel when profile is absent or name is
// empty/whitespace-only. Callers must check before making an API call.

export function buildCoachContext(state: AppState, now: Date = new Date()): string {
  if (!state.profile || !state.profile.name.trim()) {
    return COACH_SETUP_INCOMPLETE;
  }

  const nowISO    = isoDate(now);
  const year      = now.getFullYear();
  const month     = now.getMonth() + 1;
  const quarter   = currentQuarter(month);
  const weekStart = snapToMonday(nowISO);

  // 30-day window for MIT log (IDs needed for tool targeting across recent history)
  const mitWindowStart = addDays(nowISO, -29);

  const nextWeekStart = addDays(weekStart, 7);

  const sections: string[] = [];

  // ── Date Context ──────────────────────────────────────────────────────────
  sections.push([
    '## Date Context',
    `Today: ${nowISO}`,
    `Current week starts: ${weekStart}`,
    `Next week starts: ${nextWeekStart}`,
  ].join('\n'));

  // ── User Profile ─────────────────────────────────────────────────────────
  sections.push([
    '## User Profile',
    `Name: ${state.profile.name}`,
    `Role: ${state.profile.role || '(not set)'}`,
    state.profile.bio ? `Bio: ${state.profile.bio}` : '',
  ].filter(Boolean).join('\n'));

  // ── Deathbed Goals (non-empty only) ──────────────────────────────────────
  const goals = state.deathbedGoals.filter(g => g.trim());
  sections.push([
    '## Deathbed Goals',
    goals.length
      ? goals.map((g, i) => `${i + 1}. ${g}`).join('\n')
      : '(none defined yet)',
  ].join('\n'));

  // ── Life Dimensions (weights only — full OKR tree trimmed for token budget)
  sections.push([
    '## Life Dimensions',
    LIFE_DIMENSIONS.map(d => `${d.label}: ${d.weightPercent}%`).join(', '),
  ].join('\n'));

  // ── Current Quarter's Objectives ──────────────────────────────────────────
  const currentQOs = state.quarterlyObjectives.filter(
    q => q.year === year && q.quarter === quarter
  );
  sections.push([
    `## ${quarter} ${year} Objectives`,
    currentQOs.length
      ? currentQOs.map(q => {
          const okr = state.annualOKRs.find(o => o.id === q.annualOKRId);
          const dim = LIFE_DIMENSIONS.find(d => d.id === okr?.dimensionId);
          return `- [${dim?.label ?? '?'}] ${q.objective}`;
        }).join('\n')
      : '(none defined for this quarter)',
  ].join('\n'));

  // ── This Month's Key Results + This Week's Initiatives ───────────────────
  const currentKRs = state.monthlyKRs.filter(k => k.year === year && k.month === month);
  const krLines: string[] = [`## ${MONTH_NAMES[month - 1]} ${year} Key Results`];
  if (currentKRs.length === 0) {
    krLines.push('(none defined for this month)');
  } else {
    for (const kr of currentKRs) {
      krLines.push(`- KR: ${kr.keyResult}`);
      // Show all this-month's initiatives grouped by week so the coach can
      // see which weeks already have plans and which are still open.
      const monthInits = state.weeklyInitiatives
        .filter(i => i.monthlyKRId === kr.id)
        .filter(i => {
          const d = new Date(i.weekStart + 'T00:00:00');
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        })
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      if (monthInits.length === 0) {
        krLines.push('  - (no initiatives planned this month)');
      } else {
        monthInits.forEach(i => {
          const past = i.weekStart < weekStart;
          const label = past ? 'past' : i.weekStart === weekStart ? 'this week' : 'upcoming';
          krLines.push(`  - [${label}][${i.completed ? 'done' : 'open'}] week of ${i.weekStart}: ${i.text}`);
        });
      }
    }
  }
  sections.push(krLines.join('\n'));

  // ── Tool-Targeting ID Block ───────────────────────────────────────────────
  // Machine-readable JSON with IDs for current QOs, KRs, and today's MITs.
  // Lets the model supply valid IDs when calling OKR and MIT tools.
  // If the block exceeds 2000 tokens (large accounts), trim to today's MITs only.
  const idPayload = {
    currentObjectives: currentQOs.map(q => ({
      id:          q.id,
      title:       q.objective,
      dimensionId: state.annualOKRs.find(o => o.id === q.annualOKRId)?.dimensionId ?? null,
      quarter:     q.quarter,
    })),
    currentKeyResults: currentKRs.map(k => ({
      id:          k.id,
      title:       k.keyResult,
      month:       k.month,
      objectiveId: k.quarterlyObjectiveId,
    })),
    todayMITs: state.dailyMITs
      .filter(m => m.date === nowISO)
      .map(m => ({
        id:          m.id,
        text:        m.text,
        done:        m.status === 'complete',
        initiativeId: m.initiativeId,
      })),
  };

  const idBlockStr   = JSON.stringify(idPayload, null, 2);
  const idTokenCount = estimateTokens(idBlockStr);

  if (idTokenCount > 2000) {
    console.warn(`[life-compass] buildCoachContext: ID block ${idTokenCount} tokens — trimming to today's MITs only`);
    const trimmedPayload = {
      currentObjectives: [] as typeof idPayload.currentObjectives,
      currentKeyResults: [] as typeof idPayload.currentKeyResults,
      todayMITs:         idPayload.todayMITs,
    };
    sections.push(`## Tool IDs (trimmed — today's MITs only)\n\`\`\`json\n${JSON.stringify(trimmedPayload, null, 2)}\n\`\`\``);
  } else {
    sections.push(`## Tool IDs\n\`\`\`json\n${idBlockStr}\n\`\`\``);
  }

  // ── MIT Log: 30 days, open + today — id included for tool targeting ──────
  // Completed MITs excluded except today's (keep history noise low).
  // Entry format: date | id | text — status omitted to save tokens.
  const recentMITs = state.dailyMITs
    .filter(m =>
      m.date >= mitWindowStart &&
      m.date <= nowISO &&
      m.status !== 'complete'
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  sections.push([
    '## MIT Log (last 30 days, open only)',
    recentMITs.length
      ? recentMITs.map(m => `${m.date} | [${m.status}] | ${m.id} | ${m.text}`).join('\n')
      : '(no open MITs in this period)',
  ].join('\n'));

  // ── Recent Daily Logs (last 14 days, matching MIT window) ────────────────
  const recentLogs = Object.values(state.dailyLogs)
    .filter(l => l.date >= mitWindowStart && l.date <= nowISO)
    .sort((a, b) => a.date.localeCompare(b.date));

  sections.push([
    '## Daily Logs (last 14 days)',
    recentLogs.length
      ? recentLogs.map(l => {
          const ex = l.exercise ? `, exercise: ${l.exercise.type} ${l.exercise.durationMinutes}min` : '';
          const note = l.note ? `, note: "${l.note}"` : '';
          return `${l.date}: mood ${l.mood}${ex}${note}`;
        }).join('\n')
      : '(no logs in this period)',
  ].join('\n'));

  // ── Active Habits & Streaks ───────────────────────────────────────────────
  const activeHabits = (state.habits ?? []).filter(h => h.archivedAt === null);
  const HABIT_CAP = 20;
  const truncated = activeHabits.length > HABIT_CAP;
  const habitsToShow = truncated ? activeHabits.slice(0, HABIT_CAP) : activeHabits;

  if (truncated) {
    console.warn(`[life-compass] buildCoachContext: showing ${HABIT_CAP} of ${activeHabits.length} active habits.`);
  }

  if (habitsToShow.length === 0) {
    sections.push('## Active Habits & Streaks\n(No active habits configured.)');
  } else {
    const header = truncated
      ? `## Active Habits & Streaks (showing ${HABIT_CAP} of ${activeHabits.length})`
      : '## Active Habits & Streaks';
    const rows = habitsToShow.map(h => {
      const dim       = LIFE_DIMENSIONS.find(d => d.id === h.dimensionId)?.label ?? h.dimensionId;
      const streak    = calculateStreak(h.id, state.habitLogs ?? [], nowISO);
      const doneToday = (state.habitLogs ?? []).some(l => l.habitId === h.id && l.date === nowISO && l.completed);
      return `| ${h.name} | ${dim} | ${streak} | ${doneToday ? 'yes' : 'no'} |`;
    });
    sections.push([
      header,
      '| Habit | Dimension | Streak (days) | Done Today |',
      '|---|---|---|---|',
      ...rows,
    ].join('\n'));
  }

  const payload = sections.join('\n\n');

  // Token budget monitoring — logged always so it's visible in production DevTools
  console.log(`[life-compass] buildCoachContext: ~${estimateTokens(payload).toLocaleString()} tokens`);

  return payload;
}
