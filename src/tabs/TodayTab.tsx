import { useState } from 'react';
import type { TabProps, DailyMIT, DailyLog } from '../types';
import { EmptyState } from '../components/EmptyState';

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
        <div style={{ display: 'flex', gap: 8 }}>
          {([1, 2, 3, 4, 5] as const).map(n => (
            <button key={n}
              className={mood === n ? 'btn-primary' : 'btn-ghost'}
              style={{ width: 40, height: 36, padding: 0 }}
              onClick={() => setMood(n)}
            >{n}</button>
          ))}
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
        border: '1px solid var(--color-border)', borderRadius: 4,
        color: 'var(--color-success)', fontSize: 13,
      }}>
        All resolved.
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
          m.id === mit.id ? { ...m, status: 'carried', carriedForwardTo: targetDay } : m
        ),
        carried,
      ],
    });
  };

  const handleDrop = (id: string) =>
    updateState({ dailyMITs: state.dailyMITs.map(m => m.id === id ? { ...m, status: 'dropped' } : m) });

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

// ─── STORY-014: MIT Section ───────────────────────────────────────────────────
// Rendered with key={activeDate} so local form state resets on date navigation.

function MITSection({ activeDate, state, updateState }: { activeDate: string } & TabProps) {
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
                from {mit.carriedOverFrom}
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
          <select className="input-base" value={newInitiativeId}
            style={{ flex: '0 0 190px' }}
            disabled={weekInitiatives.length === 0}
            onChange={e => setNewInitId(e.target.value)}>
            <option value="">
              {weekInitiatives.length === 0 ? 'Add initiatives in Plan first' : 'Link initiative (optional)'}
            </option>
            {weekInitiatives.map(i => (
              <option key={i.id} value={i.id}>{i.text.slice(0, 45)}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={handleAdd} disabled={!newText.trim()}>Add MIT</button>
        </div>
      ) : (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 10 }}>
          Max 3 MITs per day.
        </p>
      )}

      <EndOfDayResolution activeDate={activeDate} state={state} updateState={updateState} />
    </div>
  );
}

// ─── STORY-017: Today Tab assembly + date navigation ─────────────────────────

export function TodayTab({ state, updateState }: TabProps) {
  const today  = todayISO();
  const minDay = addDays(today, -30);
  const [activeDate, setActiveDate] = useState(today);

  const isToday  = activeDate === today;
  const isAtMin  = activeDate === minDay;

  const nav = (n: number) => setActiveDate(prev => addDays(prev, n));

  return (
    <div>
      {/* Date navigation header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 24, paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <button className="btn-ghost" style={{ padding: '4px 12px', flexShrink: 0 }}
          disabled={isAtMin} onClick={() => nav(-1)}>←</button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontWeight: 600 }}>{formatDisplayDate(activeDate)}</span>
          {!isToday && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 12, marginLeft: 8 }}>
              (Past)
            </span>
          )}
        </div>

        <button className="btn-ghost" style={{ padding: '4px 12px', flexShrink: 0 }}
          disabled={isToday} onClick={() => nav(+1)}>→</button>

        {!isToday && (
          <button className="btn-ghost" style={{ fontSize: 12, flexShrink: 0 }}
            onClick={() => setActiveDate(today)}>Today</button>
        )}
      </div>

      {/* MIT section — key resets local form state on date switch */}
      <MITSection key={activeDate} activeDate={activeDate} state={state} updateState={updateState} />

      {/* Daily log — key resets local form state on date switch */}
      <DailyLogSection key={`log-${activeDate}`} activeDate={activeDate} state={state} updateState={updateState} />
    </div>
  );
}
