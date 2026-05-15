import { useEffect, useState } from 'react';
import type {
  AppState, TabProps, DimensionId, PlanNavTarget,
  AnnualOKR, QuarterlyObjective, MonthlyKeyResult, WeeklyInitiative,
} from '../types';
import { LIFE_DIMENSIONS } from '../defaults';
import { EmptyState } from '../components/EmptyState';

// ─── Utilities ────────────────────────────────────────────────────────────────

const newId = () => crypto.randomUUID();

function todayISO() { return new Date().toISOString().slice(0, 10); }
function currentYear() { return new Date().getFullYear(); }

function snapToMonday(iso: string): string {
  if (!iso) return iso;
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const QUARTERS = ['Q1','Q2','Q3','Q4'] as const;

// ─── Cascade count + exec helpers ────────────────────────────────────────────

function childCounts(state: AppState, level: 'annual' | 'quarterly' | 'monthly', id: string) {
  if (level === 'annual') {
    const qoIds = state.quarterlyObjectives.filter(q => q.annualOKRId === id).map(q => q.id);
    const krIds = state.monthlyKRs.filter(k => qoIds.includes(k.quarterlyObjectiveId)).map(k => k.id);
    return { qos: qoIds.length, krs: krIds.length, inits: state.weeklyInitiatives.filter(i => krIds.includes(i.monthlyKRId)).length };
  }
  if (level === 'quarterly') {
    const krIds = state.monthlyKRs.filter(k => k.quarterlyObjectiveId === id).map(k => k.id);
    return { qos: 0, krs: krIds.length, inits: state.weeklyInitiatives.filter(i => krIds.includes(i.monthlyKRId)).length };
  }
  return { qos: 0, krs: 0, inits: state.weeklyInitiatives.filter(i => i.monthlyKRId === id).length };
}

function cascadeBody(c: { qos: number; krs: number; inits: number }): string {
  const p: string[] = [];
  if (c.qos) p.push(`${c.qos} quarterly objective${c.qos > 1 ? 's' : ''}`);
  if (c.krs) p.push(`${c.krs} monthly key result${c.krs > 1 ? 's' : ''}`);
  if (c.inits) p.push(`${c.inits} weekly initiative${c.inits > 1 ? 's' : ''}`);
  return p.length ? `Also deletes: ${p.join(', ')}.` : 'No child items will be removed.';
}

function execDeleteAnnual(state: AppState, id: string): Partial<AppState> {
  const qoIds = state.quarterlyObjectives.filter(q => q.annualOKRId === id).map(q => q.id);
  const krIds = state.monthlyKRs.filter(k => qoIds.includes(k.quarterlyObjectiveId)).map(k => k.id);
  const initIds = new Set(state.weeklyInitiatives.filter(i => krIds.includes(i.monthlyKRId)).map(i => i.id));
  return {
    annualOKRs: state.annualOKRs.filter(o => o.id !== id),
    quarterlyObjectives: state.quarterlyObjectives.filter(q => !qoIds.includes(q.id)),
    monthlyKRs: state.monthlyKRs.filter(k => !krIds.includes(k.id)),
    weeklyInitiatives: state.weeklyInitiatives.filter(i => !initIds.has(i.id)),
    dailyMITs: state.dailyMITs.map(m => initIds.has(m.initiativeId ?? '') ? { ...m, initiativeId: null } : m),
  };
}

function execDeleteQuarterly(state: AppState, id: string): Partial<AppState> {
  const krIds = state.monthlyKRs.filter(k => k.quarterlyObjectiveId === id).map(k => k.id);
  const initIds = new Set(state.weeklyInitiatives.filter(i => krIds.includes(i.monthlyKRId)).map(i => i.id));
  return {
    quarterlyObjectives: state.quarterlyObjectives.filter(q => q.id !== id),
    monthlyKRs: state.monthlyKRs.filter(k => !krIds.includes(k.id)),
    weeklyInitiatives: state.weeklyInitiatives.filter(i => !initIds.has(i.id)),
    dailyMITs: state.dailyMITs.map(m => initIds.has(m.initiativeId ?? '') ? { ...m, initiativeId: null } : m),
  };
}

function execDeleteMonthly(state: AppState, id: string): Partial<AppState> {
  const initIds = new Set(state.weeklyInitiatives.filter(i => i.monthlyKRId === id).map(i => i.id));
  return {
    monthlyKRs: state.monthlyKRs.filter(k => k.id !== id),
    weeklyInitiatives: state.weeklyInitiatives.filter(i => !initIds.has(i.id)),
    dailyMITs: state.dailyMITs.map(m => initIds.has(m.initiativeId ?? '') ? { ...m, initiativeId: null } : m),
  };
}

function execDeleteInitiative(state: AppState, id: string): Partial<AppState> {
  return {
    weeklyInitiatives: state.weeklyInitiatives.filter(i => i.id !== id),
    dailyMITs: state.dailyMITs.map(m => m.initiativeId === id ? { ...m, initiativeId: null } : m),
  };
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      transform: open ? 'rotate(90deg)' : 'none',
      transition: 'transform 150ms ease',
      fontSize: 10,
    }}>▶</span>
  );
}

function InlineEdit({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  const commit = () => { if (v.trim()) onSave(v.trim()); };
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', width: '100%' }}>
      <input
        className="input-base"
        value={v}
        autoFocus
        style={{ flex: 1 }}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
      />
      <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={commit}>✓</button>
      <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={onCancel}>✕</button>
    </span>
  );
}

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
          <button className="btn-ghost" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── STORY-012: Weekly Initiatives ───────────────────────────────────────────

function WeeklyInitiativesSection({ krId, state, updateState }: { krId: string } & TabProps) {
  const [expanded, setExpanded] = useState(false);
  const [newText, setNewText] = useState('');
  const [newWeek, setNewWeek] = useState(snapToMonday(todayISO()));
  const [addError, setAddError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const initiatives = state.weeklyInitiatives
    .filter(i => i.monthlyKRId === krId)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const handleAdd = () => {
    if (!newText.trim()) return;
    const week = snapToMonday(newWeek || todayISO());
    const sameWeek = initiatives.filter(i => i.weekStart === week).length;
    if (sameWeek >= 4) { setAddError('Max 4 initiatives per KR per week.'); return; }
    setAddError('');
    const init: WeeklyInitiative = { id: newId(), monthlyKRId: krId, text: newText.trim(), weekStart: week, completed: false };
    updateState({ weeklyInitiatives: [...state.weeklyInitiatives, init] });
    setNewText('');
  };

  const toggleComplete = (id: string, completed: boolean) =>
    updateState({ weeklyInitiatives: state.weeklyInitiatives.map(i => i.id === id ? { ...i, completed } : i) });

  return (
    <div>
      <button className="expand-row" onClick={() => setExpanded(e => !e)}>
        <Chevron open={expanded} />
        Initiatives ({initiatives.length})
      </button>

      {expanded && (
        <div className="nested-content" style={{ background: 'color-mix(in srgb, var(--color-border) 25%, var(--color-surface))' }}>
          {initiatives.length === 0
            ? <EmptyState message="No initiatives this week — add one below." />
            : (
              <table className="table-base" style={{ marginBottom: 10 }}>
                <thead><tr><th>Week of</th><th>Initiative</th><th style={{ width: 40 }}>Done</th><th style={{ width: 32 }}></th></tr></thead>
                <tbody>
                  {initiatives.map(i => (
                    <tr key={i.id} style={{ opacity: i.completed ? 0.55 : 1 }}>
                      <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{i.weekStart}</td>
                      <td style={{ textDecoration: i.completed ? 'line-through' : 'none' }}>{i.text}</td>
                      <td><input type="checkbox" checked={i.completed} style={{ accentColor: 'var(--color-accent)' }} onChange={e => toggleComplete(i.id, e.target.checked)} /></td>
                      <td><button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setDeleteTarget(i.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <input className="input-base" placeholder="Initiative text" value={newText} style={{ flex: '1 1 180px' }}
              onChange={e => { setNewText(e.target.value); setAddError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <input type="date" className="input-base" value={newWeek} style={{ flex: '0 0 140px' }}
              onChange={e => setNewWeek(snapToMonday(e.target.value))}
            />
            <button className="btn-primary" onClick={handleAdd}>Add</button>
          </div>
          {addError && <span className="field-error">{addError}</span>}
        </div>
      )}

      {deleteTarget && (() => {
        const linkedMITs = state.dailyMITs.filter(m => m.initiativeId === deleteTarget).length;
        const body = linkedMITs > 0
          ? `${linkedMITs} daily task${linkedMITs > 1 ? 's are' : ' is'} linked to this initiative and will be unlinked. Delete anyway?`
          : 'This cannot be undone.';
        return (
          <ConfirmModal title="Delete initiative?" body={body}
            confirmLabel="Delete" onConfirm={() => { updateState(execDeleteInitiative(state, deleteTarget)); setDeleteTarget(null); }}
            onCancel={() => setDeleteTarget(null)} />
        );
      })()}
    </div>
  );
}

// ─── STORY-011: Monthly Key Results ──────────────────────────────────────────

function MonthlyKRsSection({ qoId, qoYear, state, updateState }: { qoId: string; qoYear: number } & TabProps) {
  const [expanded, setExpanded] = useState(false);
  const [newKR, setNewKR] = useState('');
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const krs = state.monthlyKRs.filter(k => k.quarterlyObjectiveId === qoId);

  const progressPct = (krId: string) => {
    const inits = state.weeklyInitiatives.filter(i => i.monthlyKRId === krId);
    if (inits.length === 0) return null;
    return Math.round((inits.filter(i => i.completed).length / inits.length) * 100);
  };

  const handleAdd = () => {
    if (!newKR.trim()) return;
    const kr: MonthlyKeyResult = { id: newId(), quarterlyObjectiveId: qoId, keyResult: newKR.trim(), month: newMonth, year: qoYear };
    updateState({ monthlyKRs: [...state.monthlyKRs, kr] });
    setNewKR('');
  };

  const handleSaveEdit = (id: string, text: string) => {
    updateState({ monthlyKRs: state.monthlyKRs.map(k => k.id === id ? { ...k, keyResult: text } : k) });
    setEditingId(null);
  };

  const confirmDelete = (id: string) => {
    updateState(execDeleteMonthly(state, id));
    setDeleteTarget(null);
  };

  return (
    <div>
      <button className="expand-row" onClick={() => setExpanded(e => !e)}>
        <Chevron open={expanded} />
        Key Results ({krs.length})
      </button>

      {expanded && (
        <div className="nested-content" style={{ background: 'color-mix(in srgb, var(--color-border) 12%, var(--color-surface))' }}>
          {krs.length === 0
            ? <EmptyState message="No key results yet — add one below." />
            : (
              <table className="table-base" style={{ marginBottom: 10 }}>
                <thead><tr><th>Month</th><th>Key Result</th><th>Progress</th><th></th></tr></thead>
                <tbody>
                  {krs.map(k => {
                    const pct = progressPct(k.id);
                    return (
                      <tr key={k.id}>
                        <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{MONTH_NAMES[k.month - 1]} {k.year}</td>
                        <td>
                          {editingId === k.id
                            ? <InlineEdit initial={k.keyResult} onSave={v => handleSaveEdit(k.id, v)} onCancel={() => setEditingId(null)} />
                            : k.keyResult}
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {pct === null ? '—' : `${pct}%`}
                        </td>
                        <td>
                          <span style={{ display: 'flex', gap: 4 }}>
                            <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setEditingId(k.id)}>✎</button>
                            <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setDeleteTarget(k.id)}>✕</button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }

          {/* Initiatives nested under each KR */}
          {krs.map(k => (
            <div key={k.id} style={{ marginBottom: 4 }}>
              <WeeklyInitiativesSection krId={k.id} state={state} updateState={updateState} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'flex-start' }}>
            <input className="input-base" placeholder="Key result (measurable)" value={newKR} style={{ flex: '1 1 200px' }}
              onChange={e => setNewKR(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <select className="input-base" value={newMonth} style={{ flex: '0 0 100px' }} onChange={e => setNewMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <button className="btn-primary" onClick={handleAdd}>Add KR</button>
          </div>
        </div>
      )}

      {deleteTarget && (() => {
        const counts = childCounts(state, 'monthly', deleteTarget);
        return (
          <ConfirmModal title="Delete key result?" body={cascadeBody(counts)}
            onConfirm={() => confirmDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
        );
      })()}
    </div>
  );
}

// ─── STORY-010: Quarterly Objectives ─────────────────────────────────────────

function QuarterlyObjectivesSection({ annualOKRId, parentYear, autoExpand, state, updateState }: { annualOKRId: string; parentYear: number; autoExpand?: boolean } & TabProps) {
  const [expanded, setExpanded] = useState(autoExpand ?? false);

  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);
  const [newObj, setNewObj] = useState('');
  const [newQuarter, setNewQuarter] = useState<'Q1'|'Q2'|'Q3'|'Q4'>('Q1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const qos = state.quarterlyObjectives.filter(q => q.annualOKRId === annualOKRId);

  const handleAdd = () => {
    if (!newObj.trim()) return;
    const qo: QuarterlyObjective = { id: newId(), annualOKRId, objective: newObj.trim(), quarter: newQuarter, year: parentYear };
    updateState({ quarterlyObjectives: [...state.quarterlyObjectives, qo] });
    setNewObj('');
  };

  const handleSaveEdit = (id: string, text: string) => {
    updateState({ quarterlyObjectives: state.quarterlyObjectives.map(q => q.id === id ? { ...q, objective: text } : q) });
    setEditingId(null);
  };

  const confirmDelete = (id: string) => {
    updateState(execDeleteQuarterly(state, id));
    setDeleteTarget(null);
  };

  return (
    <div>
      <button className="expand-row" onClick={() => setExpanded(e => !e)}>
        <Chevron open={expanded} />
        Quarterly Objectives ({qos.length})
      </button>

      {expanded && (
        <div className="nested-content" style={{ background: 'var(--color-surface)' }}>
          {qos.length === 0
            ? <EmptyState message="No quarterly objectives yet — use the form below to add one." />
            : (
              <table className="table-base" style={{ marginBottom: 10 }}>
                <thead><tr><th>Quarter</th><th>Objective</th><th></th></tr></thead>
                <tbody>
                  {qos.map(q => (
                    <tr key={q.id}>
                      <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{q.quarter} {q.year}</td>
                      <td>
                        {editingId === q.id
                          ? <InlineEdit initial={q.objective} onSave={v => handleSaveEdit(q.id, v)} onCancel={() => setEditingId(null)} />
                          : q.objective}
                      </td>
                      <td>
                        <span style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setEditingId(q.id)}>✎</button>
                          <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setDeleteTarget(q.id)}>✕</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }

          {/* Monthly KRs nested under each Quarterly Objective */}
          {qos.map(q => (
            <div key={q.id} style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', marginRight: 8 }}>{q.quarter} — {q.objective}</span>
              <MonthlyKRsSection qoId={q.id} qoYear={q.year} state={state} updateState={updateState} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'flex-start' }}>
            <input className="input-base" placeholder="Quarterly objective" value={newObj} style={{ flex: '1 1 200px' }}
              onChange={e => setNewObj(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <select className="input-base" value={newQuarter} style={{ flex: '0 0 80px' }} onChange={e => setNewQuarter(e.target.value as 'Q1'|'Q2'|'Q3'|'Q4')}>
              {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <button className="btn-primary" onClick={handleAdd}>Add</button>
          </div>
        </div>
      )}

      {deleteTarget && (() => {
        const counts = childCounts(state, 'quarterly', deleteTarget);
        return (
          <ConfirmModal title="Delete quarterly objective?" body={cascadeBody(counts)}
            onConfirm={() => confirmDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
        );
      })()}
    </div>
  );
}

// ─── STORY-009: Annual OKR management ────────────────────────────────────────

function AnnualOKRsSection({ dimensionId, targetQOId, state, updateState }: { dimensionId: DimensionId; targetQOId?: string | null } & TabProps) {
  const [newObj, setNewObj] = useState('');
  const [newYear, setNewYear] = useState(currentYear());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const okrs = state.annualOKRs.filter(o => o.dimensionId === dimensionId);

  const handleAdd = () => {
    if (!newObj.trim()) return;
    const okr: AnnualOKR = { id: newId(), dimensionId, objective: newObj.trim(), year: newYear };
    updateState({ annualOKRs: [...state.annualOKRs, okr] });
    setNewObj('');
  };

  const handleSaveEdit = (id: string, text: string) => {
    updateState({ annualOKRs: state.annualOKRs.map(o => o.id === id ? { ...o, objective: text } : o) });
    setEditingId(null);
  };

  const confirmDelete = (id: string) => {
    updateState(execDeleteAnnual(state, id));
    setDeleteTarget(null);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {okrs.length === 0
        ? <EmptyState message="No annual OKR yet — add one below." />
        : (
          <table className="table-base" style={{ marginBottom: 10 }}>
            <thead><tr><th>Objective</th><th>Year</th><th></th></tr></thead>
            <tbody>
              {okrs.map(o => (
                <tr key={o.id}>
                  <td>
                    {editingId === o.id
                      ? <InlineEdit initial={o.objective} onSave={v => handleSaveEdit(o.id, v)} onCancel={() => setEditingId(null)} />
                      : o.objective}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{o.year}</td>
                  <td>
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setEditingId(o.id)}>✎</button>
                      <button className="btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }} onClick={() => setDeleteTarget(o.id)}>✕</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }

      {/* Quarterly Objectives nested under each Annual OKR */}
      {okrs.map(o => (
        <div key={o.id} style={{ marginBottom: 12, paddingLeft: 8, borderLeft: '2px solid var(--color-border)' }}>
          <span style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 600 }}>{o.year} — {o.objective}</span>
          <QuarterlyObjectivesSection annualOKRId={o.id} parentYear={o.year} state={state} updateState={updateState}
            autoExpand={state.quarterlyObjectives.some(q => q.id === targetQOId && q.annualOKRId === o.id)} />
        </div>
      ))}

      {/* Add form */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 8 }}>
        <input className="input-base" placeholder="Annual objective" value={newObj} style={{ flex: '1 1 200px' }}
          onChange={e => setNewObj(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        <input type="number" className="input-base" value={newYear} style={{ flex: '0 0 80px' }} min={2020} max={2040}
          onChange={e => setNewYear(Number(e.target.value))}
        />
        <button className="btn-primary" onClick={handleAdd}>Add OKR</button>
      </div>

      {deleteTarget && (() => {
        const counts = childCounts(state, 'annual', deleteTarget);
        return (
          <ConfirmModal title="Delete annual OKR?" body={cascadeBody(counts)}
            onConfirm={() => confirmDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
        );
      })()}
    </div>
  );
}

// ─── STORY-013: Plan Tab assembly + filter ────────────────────────────────────

interface PlanTabProps extends TabProps {
  navTarget?: PlanNavTarget | null;
  onNavConsumed?: () => void;
}

export function PlanTab({ state, updateState, navTarget, onNavConsumed }: PlanTabProps) {
  const [filter, setFilter]       = useState<DimensionId | 'all'>('all');
  const [targetQOId, setTargetQOId] = useState<string | null>(null);

  // Consume deep-link from Review tab: activate dimension filter + auto-expand
  // the target Quarterly Objective via prop threading to QuarterlyObjectivesSection.
  useEffect(() => {
    if (navTarget) {
      setFilter(navTarget.dimensionId);
      setTargetQOId(navTarget.quarterlyObjectiveId);
      onNavConsumed?.();
    }
  }, [navTarget, onNavConsumed]);

  // Reset targetQOId one frame after autoExpand fires so a stale ID doesn't
  // re-trigger expansion if the user navigates away and returns to Plan later.
  useEffect(() => {
    if (targetQOId) {
      const frame = requestAnimationFrame(() => setTargetQOId(null));
      return () => cancelAnimationFrame(frame);
    }
  }, [targetQOId]);

  const hasAnyOKR = state.annualOKRs.length > 0;
  const visibleDimensions = filter === 'all'
    ? LIFE_DIMENSIONS
    : LIFE_DIMENSIONS.filter(d => d.id === filter);

  return (
    <div className="plan-tab">
      {/* Filter bar */}
      <div className="filter-bar">
        <button className={`filter-chip${filter === 'all' ? ' filter-chip--active' : ''}`} onClick={() => setFilter('all')}>
          All Dimensions
        </button>
        {LIFE_DIMENSIONS.map(d => (
          <button
            key={d.id}
            className={`filter-chip${filter === d.id ? ' filter-chip--active' : ''}`}
            onClick={() => setFilter(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {!hasAnyOKR && filter === 'all' && (
        <EmptyState message="Start by adding an Annual OKR for one of your life dimensions." />
      )}

      {visibleDimensions.map(dim => {
        const dimOKRs = state.annualOKRs.filter(o => o.dimensionId === dim.id);
        // Always show dimension when filter is active, even if 0 OKRs — gives add form context
        if (filter !== 'all' || dimOKRs.length > 0 || !hasAnyOKR) {
          return (
            <div key={dim.id} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 15 }}>{dim.label}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{dim.weightPercent}%</span>
              </div>
              <AnnualOKRsSection dimensionId={dim.id} targetQOId={targetQOId} state={state} updateState={updateState} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
