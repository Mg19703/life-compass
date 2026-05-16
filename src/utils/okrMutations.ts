// ─── STORY-057: Shared OKR cascade-delete helpers ────────────────────────────
// Extracted from PlanTab.tsx so both PlanTab and applyOKRTool.ts share one
// implementation. Single source of truth prevents silent divergence.
// No circular dependencies: this module only imports from types.ts.

import type { AppState } from '../types';

export function execDeleteAnnual(state: AppState, id: string): Partial<AppState> {
  const qoIds   = state.quarterlyObjectives.filter(q => q.annualOKRId === id).map(q => q.id);
  const krIds   = state.monthlyKRs.filter(k => qoIds.includes(k.quarterlyObjectiveId)).map(k => k.id);
  const initIds = new Set(state.weeklyInitiatives.filter(i => krIds.includes(i.monthlyKRId)).map(i => i.id));
  return {
    annualOKRs:           state.annualOKRs.filter(o => o.id !== id),
    quarterlyObjectives:  state.quarterlyObjectives.filter(q => !qoIds.includes(q.id)),
    monthlyKRs:           state.monthlyKRs.filter(k => !krIds.includes(k.id)),
    weeklyInitiatives:    state.weeklyInitiatives.filter(i => !initIds.has(i.id)),
    dailyMITs:            state.dailyMITs.map(m => initIds.has(m.initiativeId ?? '') ? { ...m, initiativeId: null } : m),
  };
}

export function execDeleteQuarterly(state: AppState, id: string): Partial<AppState> {
  const krIds   = state.monthlyKRs.filter(k => k.quarterlyObjectiveId === id).map(k => k.id);
  const initIds = new Set(state.weeklyInitiatives.filter(i => krIds.includes(i.monthlyKRId)).map(i => i.id));
  return {
    quarterlyObjectives: state.quarterlyObjectives.filter(q => q.id !== id),
    monthlyKRs:          state.monthlyKRs.filter(k => !krIds.includes(k.id)),
    weeklyInitiatives:   state.weeklyInitiatives.filter(i => !initIds.has(i.id)),
    dailyMITs:           state.dailyMITs.map(m => initIds.has(m.initiativeId ?? '') ? { ...m, initiativeId: null } : m),
  };
}

export function execDeleteMonthly(state: AppState, id: string): Partial<AppState> {
  const initIds = new Set(state.weeklyInitiatives.filter(i => i.monthlyKRId === id).map(i => i.id));
  return {
    monthlyKRs:        state.monthlyKRs.filter(k => k.id !== id),
    weeklyInitiatives: state.weeklyInitiatives.filter(i => !initIds.has(i.id)),
    dailyMITs:         state.dailyMITs.map(m => initIds.has(m.initiativeId ?? '') ? { ...m, initiativeId: null } : m),
  };
}

export function execDeleteInitiative(state: AppState, id: string): Partial<AppState> {
  return {
    weeklyInitiatives: state.weeklyInitiatives.filter(i => i.id !== id),
    dailyMITs:         state.dailyMITs.map(m => m.initiativeId === id ? { ...m, initiativeId: null } : m),
  };
}
