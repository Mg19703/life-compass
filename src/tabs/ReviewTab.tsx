import { useState } from 'react';
import type { AppState, TabProps, PlanNavTarget, DimensionId } from '../types';
import { LIFE_DIMENSIONS } from '../defaults';
import { EmptyState } from '../components/EmptyState';
import { DateNavBar } from '../components/DateNavBar';

// ─── Utilities ────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function snapToMonday(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string): string {
  return new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDayShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });
}

function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function lastDayOfMonth(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().slice(0, 10);
}

function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// ─── STORY-029: Dimension distribution calculation ────────────────────────────

interface DimRow {
  dim: (typeof LIFE_DIMENSIONS)[0];
  actualPct: number | null; // null when totalLinked === 0
  gap: number | null;
  status: 'green' | 'amber' | 'red' | null;
}

function calcDimDistribution(state: AppState, start: string, end: string): DimRow[] {
  const linked = state.dailyMITs.filter(m =>
    m.status === 'complete' &&
    m.initiativeId !== null &&
    m.date >= start &&
    m.date <= end
  );

  if (linked.length === 0) {
    return LIFE_DIMENSIONS.map(dim => ({ dim, actualPct: null, gap: null, status: null }));
  }

  const counts = new Map<string, number>(LIFE_DIMENSIONS.map(d => [d.id, 0]));

  for (const mit of linked) {
    const init = state.weeklyInitiatives.find(i => i.id === mit.initiativeId);
    if (!init) continue;
    const kr = state.monthlyKRs.find(k => k.id === init.monthlyKRId);
    if (!kr) continue;
    const qo = state.quarterlyObjectives.find(q => q.id === kr.quarterlyObjectiveId);
    if (!qo) continue;
    const okr = state.annualOKRs.find(o => o.id === qo.annualOKRId);
    if (!okr) continue;
    counts.set(okr.dimensionId, (counts.get(okr.dimensionId) ?? 0) + 1);
  }

  const total = linked.length;
  return LIFE_DIMENSIONS.map(dim => {
    const count = counts.get(dim.id) ?? 0;
    const actualPct = Math.round((count / total) * 100);
    const gap = actualPct - dim.weightPercent;
    const abs = Math.abs(gap);
    const status: DimRow['status'] = abs <= 5 ? 'green' : abs <= 15 ? 'amber' : 'red';
    return { dim, actualPct, gap, status };
  });
}

// ─── STORY-029: Dimension Distribution Table ──────────────────────────────────

function DimensionDistributionTable({ state, start, end }: { state: AppState; start: string; end: string }) {
  const rows = calcDimDistribution(state, start, end);
  const hasData = rows[0].actualPct !== null;

  // Find index of row with largest absolute gap (only when data exists)
  const maxGapIdx = hasData
    ? rows.reduce((best, r, i) => Math.abs(r.gap!) > Math.abs(rows[best].gap!) ? i : best, 0)
    : -1;

  const dotColor = { green: 'var(--color-success)', amber: 'var(--color-accent)', red: 'var(--color-danger)' } as const;

  return (
    <div>
      <p className="sub-section-label">Dimension Alignment</p>
      <table className="table-base">
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Target</th>
            <th>Actual</th>
            <th>Gap</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.dim.id} style={{
              borderLeft: i === maxGapIdx ? '3px solid var(--color-accent)' : '3px solid transparent',
            }}>
              <td style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{row.dim.label}</td>
              <td style={{ color: 'var(--color-text-muted)' }}>{row.dim.weightPercent}%</td>
              <td>{row.actualPct === null ? '—' : `${row.actualPct}%`}</td>
              <td style={{ color: 'var(--color-text-muted)' }}>
                {row.gap === null ? '—' : `${row.gap >= 0 ? '+' : ''}${row.gap}%`}
              </td>
              <td>
                {row.status && (
                  <span style={{ color: dotColor[row.status], fontSize: 16 }}>●</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── STORY-022: Weekly MIT Completion Table ───────────────────────────────────

function WeeklyMITTable({ weekStart, state }: { weekStart: string; state: AppState }) {
  const days = getWeekDays(weekStart);
  const weekEnd = days[6];
  const allWeekMITs = state.dailyMITs.filter(m => m.date >= weekStart && m.date <= weekEnd);

  const total     = allWeekMITs.length;
  const completed = allWeekMITs.filter(m => m.status === 'complete').length;

  const statusColor = { complete: 'var(--color-success)', carried: 'var(--color-accent)', dropped: 'var(--color-danger)', pending: 'var(--color-text-muted)' };
  const statusLabel = { complete: 'Done', carried: 'Carried', dropped: 'Dropped', pending: 'Pending' };

  if (total === 0) return <EmptyState message="No MITs logged this week." />;

  return (
    <>
      <table className="table-base">
        <thead>
          <tr><th>Day</th><th>MIT</th><th>Initiative</th><th>Status</th></tr>
        </thead>
        <tbody>
          {days.map(day => {
            const dayMITs = allWeekMITs.filter(m => m.date === day);
            if (dayMITs.length === 0) {
              return (
                <tr key={day}>
                  <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDayShort(day)}</td>
                  <td colSpan={3} style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 12 }}>No MITs logged</td>
                </tr>
              );
            }
            return dayMITs.map((mit, idx) => {
              const initiative = mit.initiativeId
                ? state.weeklyInitiatives.find(i => i.id === mit.initiativeId)
                : null;
              return (
                <tr key={mit.id}>
                  {idx === 0 && (
                    <td rowSpan={dayMITs.length} style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      {formatDayShort(day)}
                    </td>
                  )}
                  <td style={{ textDecoration: mit.status === 'complete' ? 'line-through' : 'none', opacity: mit.status === 'complete' ? 0.65 : 1 }}>
                    {mit.text}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                    {initiative?.text.slice(0, 40) ?? '—'}
                  </td>
                  <td style={{ color: statusColor[mit.status], fontSize: 12, whiteSpace: 'nowrap' }}>
                    {statusLabel[mit.status]}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>

      <p style={{ marginTop: 10, fontSize: 13, color: 'var(--color-text-muted)' }}>
        {total === 0
          ? 'No MITs logged this week.'
          : `${completed} of ${total} MITs completed (${Math.round((completed / total) * 100)}%)`}
      </p>
    </>
  );
}

// ─── STORY-023: Weekly Mood & Exercise Table ──────────────────────────────────

function WeeklyMoodTable({ weekStart, state }: { weekStart: string; state: AppState }) {
  const days = getWeekDays(weekStart);
  const weekEnd = days[6];

  const logsInRange = Object.values(state.dailyLogs).filter(l => l.date >= weekStart && l.date <= weekEnd);
  const moodsWithValues = logsInRange.map(l => l.mood);
  const avgMood = moodsWithValues.length > 0
    ? (moodsWithValues.reduce((s, m) => s + m, 0) / moodsWithValues.length).toFixed(1)
    : null;

  // Mood 4-5 = success green (not amber) to match the positive-outcome colour pattern
  const moodColor = (m: number) => m <= 2 ? 'var(--color-danger)' : m === 3 ? 'var(--color-text-muted)' : 'var(--color-success)';

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <p className="sub-section-label">Daily Mood &amp; Exercise</p>
      <table className="table-base">
        <thead>
          <tr><th>Day</th><th>Mood</th><th>Exercise</th><th>Reflection</th></tr>
        </thead>
        <tbody>
          {days.map(day => {
            const log = state.dailyLogs[day];
            return (
              <tr key={day}>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDayShort(day)}</td>
                <td style={{ color: log ? moodColor(log.mood) : 'var(--color-text-muted)' }}>
                  {log ? log.mood : '—'}
                </td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                  {log?.exercise ? `${log.exercise.type} ${log.exercise.durationMinutes}min` : '—'}
                </td>
                <td style={{ fontSize: 12, cursor: log?.note ? 'pointer' : 'default' }}
                  onClick={() => log?.note && setExpanded(expanded === day ? null : day)}>
                  {log?.note
                    ? (expanded === day
                        ? log.note
                        : log.note.length > 80 ? `${log.note.slice(0, 80)}…` : log.note)
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
        {avgMood !== null ? `Avg mood: ${avgMood}` : 'No mood data for this week.'}
      </p>
    </>
  );
}

// ─── STORY-024: Monthly OKR Progress Table ────────────────────────────────────

function MonthlyOKRTable({
  year, month, state, navigateToPlan,
}: { year: number; month: number; state: AppState; navigateToPlan: (t: PlanNavTarget) => void }) {
  const dimOrder = new Map(LIFE_DIMENSIONS.map((d, i) => [d.id, i]));

  // Collect all Monthly KRs for the selected month/year and walk their parent chain
  type OKRRow = {
    kr: (typeof state.monthlyKRs)[0];
    qoObjective: string;
    okrObjective: string;
    dimId: DimensionId;
    dimLabel: string;
    qoId: string;
    total: number;
    done: number;
    pct: number | null;
  };

  const rows: OKRRow[] = state.monthlyKRs
    .filter(kr => kr.month === month && kr.year === year)
    .map(kr => {
      const qo  = state.quarterlyObjectives.find(q => q.id === kr.quarterlyObjectiveId);
      const okr = state.annualOKRs.find(o => o.id === qo?.annualOKRId);
      const dim = LIFE_DIMENSIONS.find(d => d.id === okr?.dimensionId);
      const inits = state.weeklyInitiatives.filter(i => i.monthlyKRId === kr.id);
      const done  = inits.filter(i => i.completed).length;
      const total = inits.length;
      return {
        kr, qoId: qo?.id ?? '', qoObjective: qo?.objective ?? '—',
        okrObjective: okr?.objective ?? '—',
        dimId: (okr?.dimensionId ?? '') as DimensionId,
        dimLabel: dim?.label ?? '—',
        total, done, pct: total === 0 ? null : Math.round((done / total) * 100),
      };
    })
    .sort((a, b) => {
      const dimDiff = (dimOrder.get(a.dimId) ?? 99) - (dimOrder.get(b.dimId) ?? 99);
      if (dimDiff !== 0) return dimDiff;
      if (a.pct === null && b.pct === null) return 0;
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });

  if (rows.length === 0) return <EmptyState message="No key results defined for this month." />;

  const pctColor = (pct: number | null) => {
    if (pct === null) return 'var(--color-text-muted)';
    if (pct >= 80)   return 'var(--color-accent)';
    if (pct < 40)    return 'var(--color-danger)';
    return 'var(--color-text-muted)';
  };

  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Dimension</th><th>Annual OKR</th><th>Quarterly Obj</th>
          <th>Key Result</th><th>Total</th><th>Done</th><th>%</th><th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.kr.id}>
            <td style={{ color: 'var(--color-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {row.dimLabel}
            </td>
            <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {row.okrObjective.slice(0, 40)}
            </td>
            <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {row.qoObjective.slice(0, 40)}
            </td>
            <td>{row.kr.keyResult}</td>
            <td style={{ color: 'var(--color-text-muted)' }}>{row.total || '—'}</td>
            <td style={{ color: 'var(--color-text-muted)' }}>{row.total > 0 ? row.done : '—'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              <span style={{ color: pctColor(row.pct), fontWeight: 600 }}>
                {row.pct === null ? '—' : `${row.pct}%`}
              </span>
              {row.pct !== null && (
                <div style={{ marginTop: 3, height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden', minWidth: 56 }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: pctColor(row.pct), borderRadius: 2, transition: 'width 0.2s ease' }} />
                </div>
              )}
            </td>
            <td>
              {(row.pct === null || row.pct < 40) && row.qoId && (
                <button className="btn-ghost"
                  style={{ fontSize: 11, padding: '1px 8px', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}
                  onClick={() => navigateToPlan({ dimensionId: row.dimId, quarterlyObjectiveId: row.qoId })}>
                  Go to Plan →
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── STORY-042: Deathbed alignment helpers ────────────────────────────────────

// Counts completed MITs per dimensionId for a given date range.
// MITs with initiativeId:null are excluded — same rule as calcDimDistribution.
function mitCountsByDimension(state: AppState, start: string, end: string): Map<string, number> {
  const counts = new Map<string, number>();
  const linked = state.dailyMITs.filter(m =>
    m.status === 'complete' && m.initiativeId !== null &&
    m.date >= start && m.date <= end
  );
  for (const mit of linked) {
    const init = state.weeklyInitiatives.find(i => i.id === mit.initiativeId);
    if (!init) continue;
    const kr   = state.monthlyKRs.find(k => k.id === init.monthlyKRId);
    if (!kr)   continue;
    const qo   = state.quarterlyObjectives.find(q => q.id === kr.quarterlyObjectiveId);
    if (!qo)   continue;
    const okr  = state.annualOKRs.find(o => o.id === qo.annualOKRId);
    if (!okr)  continue;
    counts.set(okr.dimensionId, (counts.get(okr.dimensionId) ?? 0) + 1);
  }
  return counts;
}

// Counts monthly KRs per dimensionId for a given month/year.
function krCountsByDimension(state: AppState, year: number, month: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (const kr of state.monthlyKRs.filter(k => k.year === year && k.month === month)) {
    const qo  = state.quarterlyObjectives.find(q => q.id === kr.quarterlyObjectiveId);
    if (!qo)  continue;
    const okr = state.annualOKRs.find(o => o.id === qo.annualOKRId);
    if (!okr) continue;
    counts.set(okr.dimensionId, (counts.get(okr.dimensionId) ?? 0) + 1);
  }
  return counts;
}

// ─── STORY-042: Deathbed Alignment Section ────────────────────────────────────

function DeathbedAlignmentSection({
  state, year, month, start, end, navigateToSetup,
}: {
  state: AppState; year: number; month: number;
  start: string; end: string; navigateToSetup: () => void;
}) {
  // Condition 1 (checked first): all goals empty
  const allGoalsEmpty = state.deathbedGoals.every(g => !g.trim());
  if (allGoalsEmpty) {
    return (
      <div style={{ color: 'var(--color-text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0 8px' }}>
        Set your deathbed goals in Setup to see alignment.
        <button className="btn-ghost" style={{ fontSize: 12, padding: '1px 8px' }} onClick={navigateToSetup}>
          Edit goals →
        </button>
      </div>
    );
  }

  // Condition 2: no data for this month → show a placeholder rather than silently
  // hiding the section (full hide looks like a layout bug to users navigating months)
  const hasKRs  = state.monthlyKRs.some(k => k.year === year && k.month === month);
  const hasMITs = state.dailyMITs.some(m => m.date >= start && m.date <= end);
  if (!hasKRs && !hasMITs) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '16px 0 8px' }}>
        No KRs or MITs logged for this month. Navigate to a month with activity to see alignment.
      </p>
    );
  }

  const mitCounts = mitCountsByDimension(state, start, end);
  const krCounts  = krCountsByDimension(state, year, month);

  // Goal 7 (Uncategorized) always shows a neutral grey dot — not red — because
  // the user cannot fix the absence of a dimension mapping; red implies a
  // recoverable failure, which this is not.
  const dotColor = { active: 'var(--color-success)', planned: 'var(--color-accent)', absent: 'var(--color-danger)', uncategorized: 'var(--color-text-muted)' } as const;

  return (
    <>
      <table className="table-base">
        <thead>
          <tr>
            <th>Deathbed Goal</th>
            <th>Dimension</th>
            <th>KRs</th>
            <th>Completed MITs</th>
            <th>Alignment</th>
          </tr>
        </thead>
        <tbody>
          {state.deathbedGoals.map((goal, i) => {
            // Positional mapping: indices 0–5 → LIFE_DIMENSIONS, index 6 → Uncategorized
            const dim   = i < 6 ? LIFE_DIMENSIONS[i] : null;
            const dimId = dim?.id as DimensionId | undefined;

            const krCount  = dimId ? (krCounts.get(dimId)  ?? 0) : 0;
            const mitCount = dimId ? (mitCounts.get(dimId) ?? 0) : 0;

            const status = !dimId ? 'absent'
              : mitCount >= 1   ? 'active'
              : krCount  >= 1   ? 'planned'
                                : 'absent';

            const goalText    = goal.trim();
            const displayGoal = goalText
              ? (goalText.length > 60 ? goalText.slice(0, 60) + '…' : goalText)
              : '(not set)';

            const uncategorizedTooltip = !dimId
              ? 'Goals without a dimension mapping are not tracked in OKRs — this is expected.'
              : undefined;

            return (
              <tr key={i}>
                <td title={goalText || undefined}
                  style={{ color: goalText ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontStyle: goalText ? 'normal' : 'italic' }}>
                  {displayGoal}
                </td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}
                  title={uncategorizedTooltip}>
                  {dim?.label ?? 'Uncategorized'}
                </td>
                <td style={{ color: 'var(--color-text-muted)' }}>{krCount}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{mitCount}</td>
                <td title={uncategorizedTooltip ?? { active: 'Active', planned: 'Planned', absent: 'Absent' }[status]}>
                  <span style={{
                    color: !dimId ? dotColor.uncategorized : dotColor[status],
                    fontSize: 16,
                  }}>●</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '2px 10px' }} onClick={navigateToSetup}>
          Edit goals →
        </button>
      </div>
    </>
  );
}

// ─── STORY-025 / STORY-043: Review Tab Assembly ───────────────────────────────

interface ReviewTabProps extends TabProps {
  navigateToPlan: (target: PlanNavTarget) => void;
  navigateToSetup: () => void;
}

export function ReviewTab({ state, updateState, navigateToPlan, navigateToSetup }: ReviewTabProps) {
  void updateState; // Review tab is read-only

  // Week selector — shared by STORY-022 and STORY-023
  const currentWeek = snapToMonday(todayISO());
  const [weekStart, setWeekStart] = useState(currentWeek);
  const atCurrentWeek = weekStart >= currentWeek;
  // Floor: earliest week containing any MIT or log entry (prevents infinite back-scroll)
  const earliestMITDate   = state.dailyMITs.reduce<string | null>((min, m) => !min || m.date < min ? m.date : min, null);
  const earliestLogDate   = Object.keys(state.dailyLogs).reduce<string | null>((min, d) => !min || d < min ? d : min, null);
  const earliestDataDate  = [earliestMITDate, earliestLogDate].filter(Boolean).reduce<string | null>((min, d) => !min || d! < min ? d! : min, null);
  const earliestWeek      = earliestDataDate ? snapToMonday(earliestDataDate) : currentWeek;
  const atEarliestWeek    = weekStart <= earliestWeek;

  // Month selector — used by STORY-024 and monthly STORY-029
  const now = new Date();
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const atCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth() + 1;
  // Floor: earliest month containing any MonthlyKeyResult
  const earliestKR = state.monthlyKRs.reduce<{ year: number; month: number } | null>((min, kr) => {
    if (!min) return kr;
    return kr.year < min.year || (kr.year === min.year && kr.month < min.month) ? kr : min;
  }, null);
  const atEarliestMonth = earliestKR
    ? (selYear < earliestKR.year || (selYear === earliestKR.year && selMonth <= earliestKR.month))
    : true;

  const prevMonth = () => {
    if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1); }
    else setSelMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selMonth === 12) { setSelMonth(1); setSelYear(y => y + 1); }
    else setSelMonth(m => m + 1);
  };

  const weekEnd   = addDays(weekStart, 6);
  const monthS    = firstDayOfMonth(selYear, selMonth);
  const monthE    = lastDayOfMonth(selYear, selMonth);

  return (
    <div className="review-tab">

      {/* ── Weekly Review ───────────────────────────────────────────── */}
      <div className="section-divider">Weekly Review</div>

      <div className="review-section">
        <div className="review-nav-bar">
          <DateNavBar
            label={`Week of ${formatWeekLabel(weekStart)}`}
            onPrev={() => setWeekStart(w => addDays(w, -7))}
            onNext={() => setWeekStart(w => addDays(w, 7))}
            prevDisabled={atEarliestWeek}
            nextDisabled={atCurrentWeek}
            style={{ marginBottom: 0, flex: 1 }}
          />
        </div>

        {/* STORY-022 */}
        <WeeklyMITTable weekStart={weekStart} state={state} />

        {/* STORY-023 */}
        <WeeklyMoodTable weekStart={weekStart} state={state} />

        {/* STORY-029 — weekly period */}
        <DimensionDistributionTable state={state} start={weekStart} end={weekEnd} />
      </div>

      {/* ── Monthly OKR Progress ────────────────────────────────────── */}
      <div className="section-divider">Monthly OKR Progress</div>

      <div className="review-section">
        <div className="review-nav-bar">
          <DateNavBar
            label={formatMonthLabel(selYear, selMonth)}
            onPrev={prevMonth}
            onNext={nextMonth}
            prevDisabled={atEarliestMonth}
            nextDisabled={atCurrentMonth}
            style={{ marginBottom: 0, flex: 1 }}
          />
        </div>

        {/* STORY-024 */}
        <MonthlyOKRTable year={selYear} month={selMonth} state={state} navigateToPlan={navigateToPlan} />

        {/* STORY-029 — monthly period */}
        <DimensionDistributionTable state={state} start={monthS} end={monthE} />
      </div>

      {/* ── Deathbed Alignment (STORY-042) ──────────────────────────── */}
      <div className="section-divider">Deathbed Alignment</div>

      <div className="review-section">
        <DeathbedAlignmentSection
          state={state}
          year={selYear} month={selMonth}
          start={monthS} end={monthE}
          navigateToSetup={navigateToSetup}
        />
      </div>

    </div>
  );
}
