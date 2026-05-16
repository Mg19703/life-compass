import { useRef, useState, useEffect } from 'react';
import type { AppState, DimensionId, WeeklyInitiative, MonthlyKeyResult } from '../types';
import { LIFE_DIMENSIONS } from '../defaults';
import { snapToMonday } from '../utils/dateUtils';

export interface InitiativeDropdownProps {
  value: string | null;
  onChange: (initiativeId: string | null) => void;
  appState: AppState;
  /** ISO date of the MIT being created or edited — drives the active-week filter. */
  activeDate: string;
}

// ─── Data grouping ────────────────────────────────────────────────────────────

interface KRGroup  { kr: MonthlyKeyResult; initiatives: WeeklyInitiative[]; }
interface DimGroup { dimensionId: DimensionId; label: string; krs: KRGroup[]; }

function buildGroups(appState: AppState, weekStart: string): DimGroup[] {
  const weekInits = appState.weeklyInitiatives.filter(i => i.weekStart === weekStart);
  if (weekInits.length === 0) return [];

  const initsByKR: Record<string, WeeklyInitiative[]> = {};
  for (const i of weekInits) (initsByKR[i.monthlyKRId] ??= []).push(i);

  const qoToAnnual: Record<string, string> = {};
  for (const q of appState.quarterlyObjectives) qoToAnnual[q.id] = q.annualOKRId;

  const annualToDim: Record<string, string> = {};
  for (const o of appState.annualOKRs) annualToDim[o.id] = o.dimensionId;

  const byDim: Record<string, KRGroup[]> = {};
  for (const kr of appState.monthlyKRs) {
    const inits = initsByKR[kr.id];
    if (!inits) continue;
    const dimId = annualToDim[qoToAnnual[kr.quarterlyObjectiveId]];
    if (!dimId) continue;
    (byDim[dimId] ??= []).push({ kr, initiatives: inits });
  }

  return LIFE_DIMENSIONS
    .filter(d => byDim[d.id])
    .map(d => ({ dimensionId: d.id as DimensionId, label: d.label, krs: byDim[d.id] }));
}

// ─── Sentinel for "No initiative" in the flat keyboard-nav list ───────────────
const NO_INIT = '__no-initiative__';

// ─── Component ────────────────────────────────────────────────────────────────

export function InitiativeDropdown({ value, onChange, appState, activeDate }: InitiativeDropdownProps) {
  const weekStart  = snapToMonday(activeDate);
  const weekInits  = appState.weeklyInitiatives.filter(i => i.weekStart === weekStart);
  const hasAnyEver = appState.weeklyInitiatives.length > 0;
  // Stale = a value is set but the initiative no longer exists anywhere
  const isStale    = value !== null && !appState.weeklyInitiatives.some(i => i.id === value);
  const groups     = buildGroups(appState, weekStart);

  const [isOpen,      setIsOpen]      = useState(false);
  const [focusedId,   setFocusedId]   = useState('');   // '' = none; NO_INIT = "No initiative"
  const [atBottom,    setAtBottom]    = useState(false);
  const [panelStyle,  setPanelStyle]  = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);

  // Ordered flat list of option IDs for keyboard navigation
  const optionIds = [NO_INIT, ...groups.flatMap(g => g.krs.flatMap(k => k.initiatives.map(i => i.id)))];

  // ── Open / close ────────────────────────────────────────────────────────────

  const openPanel = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceAbove   = rect.top - 8;
    const spaceBelow   = window.innerHeight - rect.bottom - 8;
    const openUpward   = spaceAbove >= 200 && spaceAbove > spaceBelow;
    const spaceToRight = window.innerWidth - rect.left - 16;

    const style: React.CSSProperties = { position: 'fixed', minWidth: Math.max(280, rect.width), maxWidth: 360 };

    // Horizontal: align left; flip to right-anchored if near viewport edge
    if (spaceToRight >= 280) style.left = rect.left;
    else style.right = window.innerWidth - rect.right;

    // Vertical: prefer upward to avoid clipping by page bottom
    if (openUpward) style.bottom = window.innerHeight - rect.top + 6;
    else            style.top    = rect.bottom + 6;

    setPanelStyle(style);
    setIsOpen(true);
    setFocusedId(value ?? NO_INIT);
    setAtBottom(false);
  };

  const closePanel = (returnFocus = true) => {
    setIsOpen(false);
    setFocusedId('');
    if (returnFocus) triggerRef.current?.focus();
  };

  const selectOption = (id: string | null) => {
    onChange(id);
    closePanel(true);
  };

  // ── Side-effects ────────────────────────────────────────────────────────────

  // Focus panel container on open so keyboard events are captured
  useEffect(() => { if (isOpen) panelRef.current?.focus(); }, [isOpen]);

  // Scroll focused option into view (keyboard navigation)
  useEffect(() => {
    if (!isOpen || !focusedId) return;
    document.getElementById(`iopt-${focusedId}`)?.scrollIntoView({ block: 'nearest' });
  }, [focusedId, isOpen]);

  // Dismiss on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) &&
          !triggerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedId('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); closePanel(true); return; }
    if (e.key === 'Tab')    { closePanel(false); return; }

    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const idx  = optionIds.indexOf(focusedId);
      const last = optionIds.length - 1;
      let next: number;
      if      (e.key === 'ArrowDown') next = idx < last ? idx + 1 : 0;
      else if (e.key === 'ArrowUp')   next = idx > 0    ? idx - 1 : last;
      else if (e.key === 'Home')      next = 0;
      else                            next = last;
      setFocusedId(optionIds[next]);
      return;
    }

    if ((e.key === 'Enter' || e.key === ' ') && focusedId) {
      e.preventDefault();
      selectOption(focusedId === NO_INIT ? null : focusedId);
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  };

  // ── Trigger label ───────────────────────────────────────────────────────────

  let triggerText:  string;
  let triggerColor: string;
  if (isStale) {
    triggerText  = '(Deleted)';
    triggerColor = 'var(--color-danger)';
  } else if (value) {
    triggerText  = appState.weeklyInitiatives.find(i => i.id === value)?.text ?? 'Initiative';
    triggerColor = 'var(--color-text-primary)';
  } else {
    triggerText  = 'No initiative';
    triggerColor = 'var(--color-text-muted)';
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const noInitFocused  = focusedId === NO_INIT;
  const noInitSelected = value === null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>

      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="initiative-picker-panel"
        aria-label={`Link to initiative — ${value ? triggerText : 'none selected'}`}
        onClick={isOpen ? () => closePanel(true) : openPanel}
        style={{
          width: '100%', height: 32,
          padding: '0 8px 0 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          background: 'var(--color-surface)',
          border: `1px solid ${isOpen ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 4,
          cursor: 'pointer',
          font: 'inherit',
          transition: 'border-color 120ms ease',
        }}
      >
        <span style={{
          flex: 1, minWidth: 0, textAlign: 'left',
          fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: triggerColor,
          fontStyle: isStale ? 'italic' : 'normal',
          opacity: isStale ? 0.8 : 1,
        }}>
          {triggerText}
        </span>
        <span style={{
          fontSize: 9, lineHeight: 1, display: 'inline-block', flexShrink: 0,
          color: isOpen ? 'var(--color-accent)' : 'var(--color-text-muted)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease, color 150ms ease',
        }}>▼</span>
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <div
          ref={panelRef}
          id="initiative-picker-panel"
          role="listbox"
          aria-label="Select initiative"
          aria-multiselectable="false"
          aria-activedescendant={focusedId ? `iopt-${focusedId}` : undefined}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          style={{
            ...panelStyle,
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-accent)',
            borderRadius: 6,
            boxShadow:    '0 8px 24px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
            outline:      'none',
            overflow:     'hidden',
            zIndex:       200,
          }}
        >

          {/* Stale warning — non-list alert rendered above the listbox body */}
          {isStale && (
            <div role="alert" aria-live="polite" style={{
              padding: '5px 10px',
              background: 'rgba(239,68,68,0.08)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 11,
              color: 'var(--color-danger)',
            }}>
              ⚠ Linked initiative was deleted
            </div>
          )}

          {/* Scrollable body */}
          <div style={{ position: 'relative' }}>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                overflowY: 'auto',
                maxHeight: 300,
                scrollbarWidth: 'thin' as const,
                scrollbarColor: 'var(--color-border) transparent',
              }}
            >

              {/* "No initiative" — sticky so it's always reachable */}
              <div
                id={`iopt-${NO_INIT}`}
                role="option"
                aria-selected={noInitSelected}
                onClick={() => selectOption(null)}
                onMouseEnter={() => setFocusedId(NO_INIT)}
                style={{
                  position: 'sticky', top: 0, zIndex: 1,
                  padding:      `6px 10px 6px ${noInitSelected ? 8 : 10}px`,
                  borderBottom: '1px solid var(--color-border)',
                  borderLeft:   noInitSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
                  display:      'flex', alignItems: 'center', gap: 6,
                  cursor:       'pointer',
                  fontSize:     12, fontStyle: 'italic',
                  color:        noInitSelected ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  background:   noInitFocused && noInitSelected
                    ? 'rgba(245,158,11,0.16)'
                    : noInitFocused
                      ? 'rgba(245,158,11,0.10)'
                      : noInitSelected
                        ? 'rgba(245,158,11,0.08)'
                        : 'var(--color-surface)',
                }}
              >
                <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>⊘</span>
                No initiative
              </div>

              {/* Empty: initiatives exist but not this week */}
              {weekInits.length === 0 && hasAnyEver && (
                <div style={{ padding: '16px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No initiatives this week.</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', opacity: 0.55, marginTop: 4 }}>
                    Add one in Plan →
                  </p>
                </div>
              )}

              {/* Dimension groups */}
              {groups.map((group, gIdx) => (
                <div key={group.dimensionId}>

                  {/* Dimension header — non-interactive orientation anchor */}
                  <div aria-hidden="true" style={{
                    height:        28,
                    padding:       '0 10px 0 8px',
                    display:       'flex', alignItems: 'center',
                    background:    'rgba(245,158,11,0.06)',
                    borderTop:     gIdx > 0 ? '1px solid var(--color-border)' : 'none',
                    borderLeft:    '2px solid var(--color-accent)',
                    fontSize:      10, fontWeight: 600,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color:         'var(--color-accent)',
                    userSelect:    'none',
                  }}>
                    {group.label}
                  </div>

                  {group.krs.map(({ kr, initiatives }) => (
                    <div key={kr.id} role="group" aria-label={kr.keyResult}>

                      {/* KR label — non-interactive */}
                      <div style={{
                        padding:    '4px 10px 4px 20px',
                        display:    'flex', alignItems: 'flex-start', gap: 5,
                        userSelect: 'none',
                      }}>
                        <span style={{
                          fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--color-text-muted)', opacity: 0.6,
                          flexShrink: 0, paddingTop: 2,
                        }}>KR</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                          {kr.keyResult}
                        </span>
                      </div>

                      {/* Initiative rows */}
                      {initiatives.map(init => {
                        const isSel = value === init.id;
                        const isFoc = focusedId === init.id;
                        return (
                          <div
                            key={init.id}
                            id={`iopt-${init.id}`}
                            role="option"
                            aria-selected={isSel}
                            onClick={() => selectOption(init.id)}
                            onMouseEnter={() => setFocusedId(init.id)}
                            style={{
                              minHeight:   30,
                              padding:     `5px 10px 5px ${isSel ? 30 : 32}px`,
                              display:     'flex', alignItems: 'center', gap: 8,
                              cursor:      'pointer',
                              position:    'relative',
                              borderLeft:  isSel ? '2px solid var(--color-accent)' : '2px solid transparent',
                              background:  isFoc && isSel
                                ? 'rgba(245,158,11,0.16)'
                                : isFoc
                                  ? 'rgba(255,255,255,0.05)'
                                  : isSel
                                    ? 'rgba(245,158,11,0.10)'
                                    : 'transparent',
                              transition:  'background 80ms ease',
                            }}
                          >
                            {/* L-connector tick */}
                            <span aria-hidden="true" style={{
                              position: 'absolute', left: 16, top: '50%',
                              width: 10, height: 1,
                              background: 'var(--color-border)',
                              display: 'block',
                            }} />

                            {/* Completed checkmark */}
                            {init.completed && (
                              <span aria-hidden="true" style={{ color: 'var(--color-success)', fontSize: 10, flexShrink: 0 }}>✓</span>
                            )}

                            <span style={{
                              flex:               1, fontSize: 13, lineHeight: 1.35,
                              color:              isSel ? 'var(--color-accent)' : 'var(--color-text-primary)',
                              fontWeight:         isSel ? 500 : 400,
                              textDecoration:     init.completed ? 'line-through' : 'none',
                              textDecorationColor:'var(--color-text-muted)',
                              opacity:            init.completed && !isSel ? 0.65 : 1,
                            }}>
                              {init.text}
                            </span>

                            {/* Selected trailing checkmark */}
                            {isSel && (
                              <span aria-hidden="true" style={{ color: 'var(--color-accent)', fontSize: 11, flexShrink: 0, marginLeft: 'auto' }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Bottom fade — hides when scrolled to end */}
            {!atBottom && groups.length > 0 && (
              <div aria-hidden="true" style={{
                position:     'absolute', bottom: 0, left: 0, right: 0, height: 32,
                background:   'linear-gradient(to bottom, transparent 0%, var(--color-surface) 100%)',
                pointerEvents:'none',
                borderRadius: '0 0 6px 6px',
              }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
