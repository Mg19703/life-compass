import type { AppState } from '../types';
import { LIFE_DIMENSIONS } from '../defaults';

// Returned when profile is incomplete — callers must check before making an API call.
export const COACH_SETUP_INCOMPLETE = 'User has not yet completed Setup';

// ─── Date utilities (local — avoids cross-module deps) ────────────────────────

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function currentQuarter(month: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── STORY-018: Context payload builder ──────────────────────────────────────
//
// Pure function — deterministic given the same AppState and the same `now`.
// Injectable `now` parameter makes every date-relative calculation testable.
//
// Returns COACH_SETUP_INCOMPLETE sentinel (not the payload) when profile is
// absent or name is empty/whitespace-only. Callers must check before using.

export function buildCoachContext(state: AppState, now: Date = new Date()): string {
  // Guard: profile must exist and have a non-empty name
  if (!state.profile || !state.profile.name.trim()) {
    return COACH_SETUP_INCOMPLETE;
  }

  const nowISO     = isoDate(now);
  const year       = now.getFullYear();
  const month      = now.getMonth() + 1;
  const quarter    = currentQuarter(month);
  const windowStart = addDays(nowISO, -29); // 30-day window: -29 days through today

  const sections: string[] = [];

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

  // ── Life Dimensions & Annual OKRs ─────────────────────────────────────────
  const dimLines: string[] = ['## Life Dimensions & Annual OKRs'];
  for (const dim of LIFE_DIMENSIONS) {
    const okrs = state.annualOKRs.filter(o => o.dimensionId === dim.id);
    dimLines.push(`\n${dim.label} (${dim.weightPercent}%)`);
    if (okrs.length === 0) {
      dimLines.push('  - (no OKRs defined)');
    } else {
      okrs.forEach(o => dimLines.push(`  - ${o.year}: ${o.objective}`));
    }
  }
  sections.push(dimLines.join('\n'));

  // ── Current Quarter's Quarterly Objectives ────────────────────────────────
  const currentQOs = state.quarterlyObjectives.filter(
    q => q.year === year && q.quarter === quarter
  );
  sections.push([
    `## Current Quarter (${quarter} ${year}) Objectives`,
    currentQOs.length
      ? currentQOs.map(q => {
          const okr = state.annualOKRs.find(o => o.id === q.annualOKRId);
          const dim = LIFE_DIMENSIONS.find(d => d.id === okr?.dimensionId);
          return `- [${dim?.label ?? '?'}] ${q.objective}`;
        }).join('\n')
      : '(none defined for this quarter)',
  ].join('\n'));

  // ── Current Month's Key Results & Initiatives ─────────────────────────────
  const currentKRs = state.monthlyKRs.filter(k => k.year === year && k.month === month);
  const krLines: string[] = [`## Current Month (${MONTH_NAMES[month - 1]} ${year}) Key Results & Initiatives`];
  if (currentKRs.length === 0) {
    krLines.push('(none defined for this month)');
  } else {
    for (const kr of currentKRs) {
      krLines.push(`- KR: ${kr.keyResult}`);
      const inits = state.weeklyInitiatives.filter(i => i.monthlyKRId === kr.id);
      if (inits.length === 0) {
        krLines.push('  - (no initiatives)');
      } else {
        inits.forEach(i => krLines.push(`  - [${i.completed ? 'done' : 'open'}] ${i.text}`));
      }
    }
  }
  sections.push(krLines.join('\n'));

  // ── Recent MITs (last 30 days) ────────────────────────────────────────────
  const recentMITs = state.dailyMITs
    .filter(m => m.date >= windowStart && m.date <= nowISO)
    .sort((a, b) => a.date.localeCompare(b.date));

  sections.push([
    '## Recent MITs (last 30 days)',
    recentMITs.length
      ? recentMITs.map(m => `${m.date}: [${m.status}] ${m.text}`).join('\n')
      : '(no MITs logged in this period)',
  ].join('\n'));

  // ── Recent Daily Logs (last 30 days) ──────────────────────────────────────
  const recentLogs = Object.values(state.dailyLogs)
    .filter(l => l.date >= windowStart && l.date <= nowISO)
    .sort((a, b) => a.date.localeCompare(b.date));

  sections.push([
    '## Recent Daily Logs (last 30 days)',
    recentLogs.length
      ? recentLogs.map(l => {
          const ex = l.exercise ? `, exercise: ${l.exercise.type} ${l.exercise.durationMinutes}min` : '';
          const note = l.note ? `, note: "${l.note}"` : '';
          return `${l.date}: mood ${l.mood}${ex}${note}`;
        }).join('\n')
      : '(no logs in this period)',
  ].join('\n'));

  return sections.join('\n\n');
}
