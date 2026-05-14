import { useState } from 'react';
import type { AppState, TabProps, PlanNavTarget, DimensionId } from '../types';
import { LIFE_DIMENSIONS } from '../defaults';
import { EmptyState } from '../components/EmptyState';

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
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        Dimension Alignment
      </p>
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
      <table className="table-base" style={{ marginTop: 16 }}>
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
            <td style={{ color: pctColor(row.pct), fontWeight: 600, whiteSpace: 'nowrap' }}>
              {row.pct === null ? '—' : `${row.pct}%`}
            </td>
            <td>
              {row.pct !== null && row.pct < 40 && row.qoId && (
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

// ─── STORY-025: Review Tab Assembly ──────────────────────────────────────────

interface ReviewTabProps extends TabProps {
  navigateToPlan: (target: PlanNavTarget) => void;
}

export function ReviewTab({ state, updateState, navigateToPlan }: ReviewTabProps) {
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
        {/* Week selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn-ghost" style={{ padding: '4px 10px' }}
            disabled={atEarliestWeek}
            onClick={() => setWeekStart(w => addDays(w, -7))}>←</button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>
            Week of {formatWeekLabel(weekStart)}
          </span>
          <button className="btn-ghost" style={{ padding: '4px 10px' }}
            disabled={atCurrentWeek}
            onClick={() => setWeekStart(w => addDays(w, 7))}>→</button>
        </div>

        {/* STORY-022 */}
        <WeeklyMITTable weekStart={weekStart} state={state} />

        {/* STORY-023 */}
        <WeeklyMoodTable weekStart={weekStart} state={state} />

        {/* STORY-029 — weekly period */}
        <DimensionDistributionTable state={state} start={weekStart} end={weekEnd} />
      </div>

      {/* ── Monthly OKR Progress ────────────────────────────────────── */}
      <div className="section-divider" style={{ marginTop: 32 }}>Monthly OKR Progress</div>

      <div className="review-section">
        {/* Month selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn-ghost" style={{ padding: '4px 10px' }}
            disabled={atEarliestMonth}
            onClick={prevMonth}>←</button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>
            {formatMonthLabel(selYear, selMonth)}
          </span>
          <button className="btn-ghost" style={{ padding: '4px 10px' }}
            disabled={atCurrentMonth}
            onClick={nextMonth}>→</button>
        </div>

        {/* STORY-024 */}
        <MonthlyOKRTable year={selYear} month={selMonth} state={state} navigateToPlan={navigateToPlan} />

        {/* STORY-029 — monthly period */}
        <DimensionDistributionTable state={state} start={monthS} end={monthE} />
      </div>

    </div>
  );
}
