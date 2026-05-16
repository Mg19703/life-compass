import { useState } from 'react';
import type { TabProps, DimensionId, Habit } from '../types';
import { LIFE_DIMENSIONS } from '../defaults';
import { EmptyState } from '../components/EmptyState';
import { calculateStreak } from '../utils/habitUtils';
import { DateNavBar } from '../components/DateNavBar';

// ─── Utilities ────────────────────────────────────────────────────────────────

const newId = () => crypto.randomUUID();
function todayISO() { return new Date().toISOString().slice(0, 10); }

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatCreatedDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function DimensionBadge({ dimensionId }: { dimensionId: DimensionId }) {
  const dim = LIFE_DIMENSIONS.find(d => d.id === dimensionId);
  return (
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 10,
      background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
      color: 'var(--color-accent)', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {dim?.label ?? dimensionId}
    </span>
  );
}

// ─── Confirm modal (local — same pattern as PlanTab) ──────────────────────────

interface ConfirmModalProps {
  title: string; body: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}
function ConfirmModal({ title, body, confirmLabel = 'Delete anyway', onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>{title}</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>{body}</p>
        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-ghost"
            style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── STORY-034: Habit CRUD Section ───────────────────────────────────────────

function HabitCRUDSection({ state, updateState }: TabProps) {
  const [newName,   setNewName]   = useState('');
  const [newDimId,  setNewDimId]  = useState<DimensionId>('inner-life');
  const [nameError, setNameError] = useState('');

  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');
  const [editDimId,  setEditDimId]  = useState<DimensionId>('inner-life');

  const [deleteTarget,   setDeleteTarget]   = useState<string | null>(null);
  const [showArchived,   setShowArchived]   = useState(false);

  const today        = todayISO();
  const activeHabits = (state.habits ?? []).filter(h => h.archivedAt === null);
  const archived     = (state.habits ?? []).filter(h => h.archivedAt !== null);

  // ── Add ──────────────────────────────────────────────────────────────────

  const handleAdd = () => {
    if (!newName.trim()) { setNameError('Name is required.'); return; }
    setNameError('');
    const habit: Habit = { id: newId(), name: newName.trim(), dimensionId: newDimId, createdAt: today, archivedAt: null };
    updateState({ habits: [...(state.habits ?? []), habit] });
    setNewName('');
  };

  // ── Edit ─────────────────────────────────────────────────────────────────

  const startEdit = (h: Habit) => {
    setEditingId(h.id);
    setEditName(h.name);
    setEditDimId(h.dimensionId);
  };

  const commitEdit = (id: string) => {
    if (!editName.trim()) return;
    updateState({ habits: state.habits.map(h => h.id === id ? { ...h, name: editName.trim(), dimensionId: editDimId } : h) });
    setEditingId(null);
  };

  // ── Archive ───────────────────────────────────────────────────────────────

  const handleArchive = (id: string) => {
    if (editingId === id) setEditingId(null); // cancel in-progress edit first
    updateState({ habits: state.habits.map(h => h.id === id ? { ...h, archivedAt: today } : h) });
  };

  const handleUnarchive = (id: string) =>
    updateState({ habits: state.habits.map(h => h.id === id ? { ...h, archivedAt: null } : h) });

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = (id: string) => {
    if (editingId === id) setEditingId(null); // cancel in-progress edit first
    setDeleteTarget(id);
  };

  const executeDelete = (id: string) => {
    updateState({
      habits:    (state.habits ?? []).filter(h => h.id !== id),
      habitLogs: (state.habitLogs ?? []).filter(l => l.habitId !== id),
    });
    setDeleteTarget(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const deleteTargetHabit = deleteTarget ? (state.habits ?? []).find(h => h.id === deleteTarget) : null;
  const deleteLogCount    = deleteTarget ? (state.habitLogs ?? []).filter(l => l.habitId === deleteTarget).length : 0;

  const deleteBody = deleteLogCount > 0
    ? `This habit has ${deleteLogCount} day${deleteLogCount > 1 ? 's' : ''} of log history that will be permanently removed.`
    : 'This habit has no log history.';

  return (
    <div>
      {/* Add form */}
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <div style={{ flex: '1 1 180px' }}>
          <input className="input-base" placeholder="Habit name" value={newName} maxLength={80}
            onChange={e => { setNewName(e.target.value); setNameError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {nameError && <span className="field-error">{nameError}</span>}
            <span className="char-count" style={{ marginLeft: 'auto' }}>{newName.length} / 80</span>
          </div>
        </div>
        <select className="input-base" value={newDimId} style={{ flex: '0 0 160px' }}
          onChange={e => setNewDimId(e.target.value as DimensionId)}>
          {LIFE_DIMENSIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <button className="btn-primary" onClick={handleAdd}>Add Habit</button>
      </div>

      {/* Active habits table */}
      {activeHabits.length === 0
        ? <EmptyState message="No habits yet — add one above." />
        : (
          <table className="table-base" style={{ marginBottom: 12 }}>
            <thead>
              <tr><th>Habit</th><th>Dimension</th><th>Streak</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {activeHabits.map(h => {
                const streak = calculateStreak(h.id, state.habitLogs, today);
                const isEditing = editingId === h.id;
                return (
                  <tr key={h.id}>
                    <td>
                      {isEditing
                        ? (
                          <span style={{ display: 'inline-flex', gap: 4, width: '100%' }}>
                            <input className="input-base" value={editName} autoFocus maxLength={80}
                              style={{ flex: 1 }}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit(h.id); if (e.key === 'Escape') setEditingId(null); }}
                            />
                            <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => commitEdit(h.id)}>✓</button>
                            <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setEditingId(null)}>✕</button>
                          </span>
                        )
                        : h.name}
                    </td>
                    <td>
                      {isEditing
                        ? (
                          <select className="input-base" value={editDimId} style={{ fontSize: 12 }}
                            onChange={e => setEditDimId(e.target.value as DimensionId)}>
                            {LIFE_DIMENSIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                          </select>
                        )
                        : <DimensionBadge dimensionId={h.dimensionId} />}
                    </td>
                    <td style={{ color: streak > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {streak > 0 ? `${streak} days` : '—'}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatCreatedDate(h.createdAt)}
                    </td>
                    <td>
                      <span style={{ display: 'flex', gap: 4 }}>
                        {!isEditing && <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => startEdit(h)}>✎</button>}
                        <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => handleArchive(h.id)}>Archive</button>
                        <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                          onClick={() => handleDeleteConfirm(h.id)}>✕</button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      }

      {/* Archived section */}
      {archived.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button className="expand-row" onClick={() => setShowArchived(s => !s)}>
            <span style={{ display: 'inline-block', transform: showArchived ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', fontSize: 10, marginRight: 6 }}>▶</span>
            Archived ({archived.length})
          </button>
          {showArchived && (
            <table className="table-base" style={{ marginTop: 6 }}>
              <thead><tr><th>Habit</th><th>Dimension</th><th>Archived</th><th></th></tr></thead>
              <tbody>
                {archived.map(h => (
                  <tr key={h.id} style={{ opacity: 0.65 }}>
                    <td>{h.name}</td>
                    <td><DimensionBadge dimensionId={h.dimensionId} /></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{formatCreatedDate(h.archivedAt!)}</td>
                    <td>
                      <button className="btn-ghost" style={{ padding: '1px 8px', fontSize: 11 }} onClick={() => handleUnarchive(h.id)}>Restore</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && deleteTargetHabit && (
        <ConfirmModal
          title={`Delete "${deleteTargetHabit.name}"?`}
          body={deleteBody}
          onConfirm={() => executeDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── STORY-035: Daily Check-in Section ───────────────────────────────────────
// Rendered with key={activeDate} from parent — remounts on date change.

function HabitCheckInSection({ activeDate, state, updateState }: { activeDate: string } & TabProps) {
  const [saveError, setSaveError] = useState(false);
  const activeHabits = (state.habits ?? []).filter(h => h.archivedAt === null);

  const isChecked = (habitId: string) =>
    state.habitLogs.some(l => l.habitId === habitId && l.date === activeDate && l.completed);

  const handleToggle = (habitId: string, checked: boolean) => {
    // Read habitLogs from state at call time — no stale closure risk
    const existing = (state.habitLogs ?? []).find(l => l.habitId === habitId && l.date === activeDate);

    // Estimate storage usage before write; warn visibly if near quota
    try {
      const testSize = JSON.stringify(state).length;
      if (testSize > 4 * 1024 * 1024) { // >4MB
        setSaveError(true);
        return;
      }
    } catch { /* ignore measurement errors */ }

    setSaveError(false);
    if (existing) {
      updateState({ habitLogs: (state.habitLogs ?? []).map(l => l.id === existing.id ? { ...l, completed: checked } : l) });
    } else {
      updateState({ habitLogs: [...(state.habitLogs ?? []), { id: newId(), habitId, date: activeDate, completed: checked }] });
    }
  };

  if (activeHabits.length === 0) {
    return <EmptyState message="No active habits — add one in the My Habits section above." />;
  }

  return (
    <>
      {saveError && (
        <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 4, background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', fontSize: 13, border: '1px solid var(--color-danger)' }}>
          Storage is nearly full — check-in not saved. Clear old data in Setup.
        </div>
      )}
    <table className="table-base">
      <thead>
        <tr><th>Habit</th><th>Dimension</th><th>Streak</th><th style={{ width: 40 }}>Done</th></tr>
      </thead>
      <tbody>
        {activeHabits.map(h => {
          const streak  = calculateStreak(h.id, state.habitLogs, activeDate);
          const checked = isChecked(h.id);
          return (
            <tr key={h.id} style={{ opacity: checked ? 0.7 : 1 }}>
              <td style={{ textDecoration: checked ? 'line-through' : 'none' }}>{h.name}</td>
              <td><DimensionBadge dimensionId={h.dimensionId} /></td>
              <td style={{ color: streak > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                {streak > 0 ? `${streak} days` : '—'}
              </td>
              <td>
                <input type="checkbox" checked={checked}
                  style={{ accentColor: 'var(--color-accent)', width: 16, height: 16, cursor: 'pointer' }}
                  onChange={e => handleToggle(h.id, e.target.checked)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </>
  );
}

// ─── STORY-036: HabitsTab Assembly ───────────────────────────────────────────

export function HabitsTab({ state, updateState }: TabProps) {
  const today  = todayISO();
  const minDay = addDays(today, -30);
  const [activeDate, setActiveDate] = useState(today);

  const isToday = activeDate === today;
  const isAtMin = activeDate <= minDay;

  return (
    <div>
      <div className="section-divider">My Habits</div>
      <HabitCRUDSection state={state} updateState={updateState} />

      <div className="section-divider" style={{ marginTop: 24 }}>Today's Check-In</div>

      <DateNavBar
        label={formatDisplayDate(activeDate)}
        sublabel={isToday ? undefined : '(Past)'}
        onPrev={() => setActiveDate(prev => addDays(prev, -1))}
        onNext={() => setActiveDate(prev => addDays(prev, 1))}
        prevDisabled={isAtMin}
        nextDisabled={isToday}
        onToday={isToday ? undefined : () => setActiveDate(today)}
      />

      {/* Check-in list — key resets any local state on date switch */}
      <HabitCheckInSection key={activeDate} activeDate={activeDate} state={state} updateState={updateState} />
    </div>
  );
}
