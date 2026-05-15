import { useState } from 'react';
import type { TabProps, DailyMIT, DailyLog } from '../types';
import { EmptyState } from '../components/EmptyState';
import { calculateStreak } from '../utils/habitUtils';
import { DateNavBar } from '../components/DateNavBar';

// ─── Utilities ────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatCarryFrom(iso: string): string {
  const today     = todayISO();
  const yesterday = addDays(today, -1);
  if (iso === today)     return 'today';
  if (iso === yesterday) return 'yesterday';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function snapToMonday(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

const newId = () => crypto.randomUUID();

// ─── STORY-016: Daily Log Section ────────────────────────────────────────────
// Rendered with key={activeDate} so local state resets on date navigation.

function DailyLogSection({ activeDate, state, updateState }: { activeDate: string } & TabProps) {
  const existing = state.dailyLogs[activeDate];

  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(existing?.mood ?? null);
  const [exType, setExType]   = useState(existing?.exercise?.type ?? '');
  const [exMins, setExMins]   = useState(existing?.exercise != null ? String(existing.exercise.durationMinutes) : '');
  const [note, setNote]       = useState(existing?.note ?? '');
  const [saved, setSaved]     = useState(false);

  const handleSave = () => {
    if (mood === null) return;
    const exercise = exType.trim()
      ? { type: exType.trim(), durationMinutes: Number(exMins) || 0 }
      : null;
    const log: DailyLog = { date: activeDate, mood, exercise, note: note.trim() };
    updateState({ dailyLogs: { ...state.dailyLogs, [activeDate]: log } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="section-divider">Daily Log</div>

      <div className="form-field">
        <span className="form-label">Mood</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 2 }}>Low</span>
          {([1, 2, 3, 4, 5] as const).map(n => (
            <button key={n}
              className={mood === n ? 'btn-primary' : 'btn-ghost'}
              style={{ width: 36, height: 34, padding: 0 }}
              onClick={() => setMood(n)}
            >{n}</button>
          ))}
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 2 }}>High</span>
        </div>
      </div>

      <div className="form-field">
        <span className="form-label">
          Exercise{' '}
          <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional)</span>
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input-base" placeholder="Type (run, yoga…)"
            value={exType} maxLength={50} style={{ flex: '1 1 140px' }}
            onChange={e => setExType(e.target.value)} />
          <input type="number" className="input-base" placeholder="Min"
            value={exMins} min={0} max={300} style={{ flex: '0 0 90px' }}
            onChange={e => setExMins(e.target.value)} />
        </div>
      </div>

      <div className="form-field">
        <span className="form-label">Reflection</span>
        <textarea className="input-base" rows={2} maxLength={200}
          value={note} onChange={e => setNote(e.target.value)} />
        <span className="char-count">{note.length} / 200</span>
      </div>

      <div className="form-actions">
        <button className="btn-primary" onClick={handleSave} disabled={mood === null}>
          {existing ? 'Update Log' : 'Save Log'}
        </button>
        {saved && <span style={{ color: 'var(--color-success)', fontSize: 13 }}>Logged.</span>}
      </div>
    </div>
  );
}

// ─── STORY-015: End-of-day resolution ────────────────────────────────────────
// Not time-gated. Appears on any date (today or historical) with pending MITs.
// Hidden entirely when the viewed date has zero MITs.

function EndOfDayResolution({ activeDate, state, updateState }: { activeDate: string } & TabProps) {
  const allMITs    = state.dailyMITs.filter(m => m.date === activeDate);
  const pendingMITs = allMITs.filter(m => m.status === 'pending');

  if (allMITs.length === 0) return null;

  // On today: suppress if ALL pending MITs are freshly created (no carryovers).
  // Showing "Resolve unfinished MITs" for a task set 30 seconds ago is misleading.
  // The section surfaces naturally once a carried-in MIT appears or the user revisits.
  const isViewingToday = activeDate === todayISO();
  const hasAnyCarriedIn = pendingMITs.some(m => m.carriedOverFrom !== null);
  if (isViewingToday && pendingMITs.length > 0 && !hasAnyCarriedIn) return null;

  if (pendingMITs.length === 0) {
    return (
      <div style={{
        marginTop: 16, padding: '10px 14px',
        border: '1px solid var(--color-success)',
        borderRadius: 4,
        background: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
        color: 'var(--color-success)', fontSize: 13,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>✓</span> All resolved.
      </div>
    );
  }

  const handleDone = (id: string) =>
    updateState({ dailyMITs: state.dailyMITs.map(m => m.id === id ? { ...m, status: 'complete' } : m) });

  const handleCarryForward = (mit: DailyMIT) => {
    // Always carry to TODAY when resolving a historical date — carrying to
    // viewedDate+1 would silently bury the task in a date the user may not revisit.
    const nowISO = todayISO();
    const targetDay = activeDate < nowISO ? nowISO : addDays(activeDate, 1);
    const carried: DailyMIT = {
      id: newId(), date: targetDay, text: mit.text,
      status: 'pending', carriedOverFrom: activeDate,
      carriedForwardTo: null, initiativeId: mit.initiativeId,
    };
    updateState({
      dailyMITs: [
        ...state.dailyMITs.map(m =>
          m.id === mit.id ? { ...m, status: 'carried' as const, carriedForwardTo: targetDay } : m
        ),
        carried,
      ],
    });
  };

  const handleDrop = (id: string) =>
    updateState({ dailyMITs: state.dailyMITs.map(m => m.id === id ? { ...m, status: 'dropped' as const } : m) });

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{
        color: 'var(--color-text-muted)', fontSize: 12,
        fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', marginBottom: 8,
      }}>
        Resolve unfinished MITs
      </p>
      {pendingMITs.map(mit => (
        <div key={mit.id} style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          padding: '8px 0', borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ flex: 1, minWidth: 120 }}>{mit.text}</span>
          <button className="btn-ghost"
            style={{ fontSize: 12, padding: '2px 10px' }}
            onClick={() => handleDone(mit.id)}>Done</button>
          <button className="btn-ghost"
            style={{ fontSize: 12, padding: '2px 10px', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}
            onClick={() => handleCarryForward(mit)}>Carry Forward</button>
          <button className="btn-ghost"
            style={{ fontSize: 12, padding: '2px 10px', color: 'var(--color-text-muted)' }}
            onClick={() => handleDrop(mit.id)}>Drop</button>
        </div>
      ))}
    </div>
  );
}

// ─── STORY-037: Habit Streak Summary ─────────────────────────────────────────
// Rendered inside MITSection, below the MIT add form, above end-of-day resolution.
// Always writes to todayISO() — never to MITSection's activeDate.

function HabitStreakSummary({ state, updateState, navigateToHabits }: { navigateToHabits?: () => void } & TabProps) {
  const activeHabits = (state.habits ?? []).filter(h => h.archivedAt === null);
  if (activeHabits.length === 0) return null;

  const today = todayISO(); // always real today — not the viewed date

  const isCompleted = (habitId: string) =>
    (state.habitLogs ?? []).some(l => l.habitId === habitId && l.date === today && l.completed);

  const handleToggle = (habitId: string, checked: boolean) => {
    const existing = (state.habitLogs ?? []).find(l => l.habitId === habitId && l.date === today);
    if (existing) {
      updateState({ habitLogs: (state.habitLogs ?? []).map(l => l.id === existing.id ? { ...l, completed: checked } : l) });
    } else {
      updateState({ habitLogs: [...(state.habitLogs ?? []), { id: newId(), habitId, date: today, completed: checked }] });
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Habit Streaks
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6, fontSize: 11 }}>
            (always logs to today)
          </span>
        </p>
        {navigateToHabits && (
          <button className="btn-ghost" style={{ fontSize: 11, padding: '1px 8px' }} onClick={navigateToHabits}>
            Manage habits →
          </button>
        )}
      </div>
      {activeHabits.map(h => {
        const streak = calculateStreak(h.id, state.habitLogs, today);
        const done   = isCompleted(h.id);
        return (
          <div key={h.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 0', borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ flex: 1, fontSize: 13 }}>{h.name}</span>
            {streak > 0 && (
              <span style={{ fontSize: 11, color: 'var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', padding: '1px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                {streak} days
              </span>
            )}
            <button
              style={{
                width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                border: `2px solid ${done ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: done ? 'var(--color-accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
              onClick={() => handleToggle(h.id, !done)}
            >
              {done && <span style={{ color: '#0f1117', fontSize: 11, lineHeight: 1 }}>✓</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── STORY-014: MIT Section ───────────────────────────────────────────────────
// Rendered with key={activeDate} so local form state resets on date navigation.

function MITSection({ activeDate, state, updateState, navigateToHabits, navigateToPlan }: { activeDate: string; navigateToHabits?: () => void; navigateToPlan?: () => void } & TabProps) {
  const today = todayISO();
  const [newText, setNewText]           = useState('');
  const [newInitiativeId, setNewInitId] = useState<string>('');

  const allMITs = state.dailyMITs.filter(m => m.date === activeDate);

  // Only originally-created (non-carried) MITs count toward the 3-MIT limit.
  // Past dates are read-only for new MIT creation — only today allows adding.
  const createdCount = allMITs.filter(m => m.carriedOverFrom === null).length;
  const canAdd = activeDate === today && createdCount < 3;

  // Initiatives for the week containing activeDate
  const weekStart = snapToMonday(activeDate);
  const weekInitiatives = state.weeklyInitiatives.filter(i => i.weekStart === weekStart);

  const handleAdd = () => {
    if (!newText.trim() || !canAdd) return;
    const mit: DailyMIT = {
      id: newId(), date: activeDate, text: newText.trim(),
      status: 'pending', carriedOverFrom: null, carriedForwardTo: null,
      initiativeId: newInitiativeId || null,
    };
    updateState({ dailyMITs: [...state.dailyMITs, mit] });
    setNewText('');
    setNewInitId('');
  };

  const handleComplete = (id: string) =>
    updateState({ dailyMITs: state.dailyMITs.map(m => m.id === id ? { ...m, status: 'complete' } : m) });

  const statusColor = (s: DailyMIT['status']) =>
    ({ complete: 'var(--color-success)', carried: 'var(--color-accent)', dropped: 'var(--color-danger)', pending: 'transparent' })[s];

  const statusLabel = (s: DailyMIT['status']) =>
    ({ complete: '✓ Done', carried: '→ Carried', dropped: '✕ Dropped', pending: '' })[s];

  const emptyMsg = activeDate === today
    ? 'Start by adding up to 3 MITs for today.'
    : 'No MITs were logged for this date.';

  return (
    <div>
      <div className="section-divider">Most Important Tasks</div>

      {allMITs.length === 0 && <EmptyState message={emptyMsg} />}

      {allMITs.map(mit => (
        <div key={mit.id} style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '9px 0', borderBottom: '1px solid var(--color-border)',
          opacity: mit.status === 'complete' ? 0.5 : 1,
        }}>
          {mit.status === 'pending'
            ? <input type="checkbox"
                style={{ accentColor: 'var(--color-accent)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                onChange={() => handleComplete(mit.id)} />
            : <div style={{ width: 16, flexShrink: 0 }} />
          }
          <span style={{
            flex: 1,
            textDecoration: mit.status === 'complete' ? 'line-through' : 'none',
          }}>
            {mit.text}
            {mit.carriedOverFrom && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, marginLeft: 8 }}>
                from {formatCarryFrom(mit.carriedOverFrom)}
              </span>
            )}
          </span>
          {mit.status !== 'pending' && (
            <span style={{ fontSize: 11, color: statusColor(mit.status), whiteSpace: 'nowrap', flexShrink: 0 }}>
              {statusLabel(mit.status)}
            </span>
          )}
        </div>
      ))}

      {canAdd ? (
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input className="input-base" placeholder="What must get done today?"
            value={newText} maxLength={150} style={{ flex: '1 1 180px' }}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
          {weekInitiatives.length === 0 ? (
            <button className="btn-ghost" style={{ flex: '0 0 190px', fontSize: 12 }}
              onClick={navigateToPlan}>
              Add initiatives in Plan →
            </button>
          ) : (
            <select className="input-base" value={newInitiativeId}
              style={{ flex: '0 0 190px' }}
              onChange={e => setNewInitId(e.target.value)}>
              <option value="">Link initiative (optional)</option>
              {weekInitiatives.map(i => (
                <option key={i.id} value={i.id}>{i.text.slice(0, 45)}</option>
              ))}
            </select>
          )}
          <button className="btn-primary" onClick={handleAdd} disabled={!newText.trim()}>Add MIT</button>
        </div>
      ) : (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 10 }}>
          Max 3 MITs per day.
        </p>
      )}

      <HabitStreakSummary state={state} updateState={updateState} navigateToHabits={navigateToHabits} />
      <EndOfDayResolution activeDate={activeDate} state={state} updateState={updateState} />
    </div>
  );
}

// ─── STORY-017: Today Tab assembly + date navigation ─────────────────────────

interface TodayTabProps extends TabProps {
  navigateToHabits: () => void;
  navigateToPlan?: () => void;
}

export function TodayTab({ state, updateState, navigateToHabits, navigateToPlan }: TodayTabProps) {
  const today  = todayISO();
  const minDay = addDays(today, -30);
  const [activeDate, setActiveDate] = useState(today);

  const isToday  = activeDate === today;
  const isAtMin  = activeDate === minDay;

  const nav = (n: number) => setActiveDate(prev => addDays(prev, n));

  return (
    <div>
      <DateNavBar
        label={formatDisplayDate(activeDate)}
        sublabel={isToday ? undefined : '(Past)'}
        onPrev={() => nav(-1)}
        onNext={() => nav(+1)}
        prevDisabled={isAtMin}
        nextDisabled={isToday}
        onToday={isToday ? undefined : () => setActiveDate(today)}
        style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}
      />

      {/* MIT section — key resets local form state on date switch */}
      <MITSection key={activeDate} activeDate={activeDate} state={state} updateState={updateState} navigateToHabits={navigateToHabits} navigateToPlan={navigateToPlan} />

      {/* Daily log — key resets local form state on date switch */}
      <DailyLogSection key={`log-${activeDate}`} activeDate={activeDate} state={state} updateState={updateState} />
    </div>
  );
}
