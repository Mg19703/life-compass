// ─── STORY-057: Pure OKR mutation function for Coach tool-calling ─────────────
// Returns a new AppState with the requested OKR change applied.
// Never mutates the input state. Unknown toolName returns state unchanged.
// All handlers silently no-op when required IDs are not found.

import type {
  AppState, AnnualOKR, QuarterlyObjective, MonthlyKeyResult,
} from '../types';
import {
  execDeleteAnnual,
  execDeleteQuarterly,
  execDeleteMonthly,
} from '../utils/okrMutations';

const newId = () => crypto.randomUUID();

function cast(toolInput: unknown): Record<string, unknown> {
  return typeof toolInput === 'object' && toolInput !== null
    ? (toolInput as Record<string, unknown>)
    : {};
}

export function applyOKRTool(state: AppState, toolName: string, toolInput: unknown): AppState {
  const i = cast(toolInput);

  switch (toolName) {

    // ── Annual Goal ────────────────────────────────────────────────────────────

    case 'create_annual_goal': {
      const text        = typeof i.text        === 'string' ? i.text        : '';
      const dimensionId = typeof i.dimensionId === 'string' ? i.dimensionId : '';
      if (!text || !dimensionId) return state;
      const okr: AnnualOKR = {
        id: newId(), objective: text,
        dimensionId: dimensionId as AnnualOKR['dimensionId'],
        year: new Date().getFullYear(),
      };
      return { ...state, annualOKRs: [...state.annualOKRs, okr] };
    }

    case 'edit_annual_goal': {
      const id = typeof i.annualOKRId === 'string' ? i.annualOKRId : '';
      if (!id || !state.annualOKRs.some(o => o.id === id)) return state;
      return {
        ...state,
        annualOKRs: state.annualOKRs.map(o => o.id !== id ? o : {
          ...o,
          ...(typeof i.text        === 'string' ? { objective:   i.text }                                  : {}),
          ...(typeof i.dimensionId === 'string' ? { dimensionId: i.dimensionId as AnnualOKR['dimensionId'] } : {}),
        }),
      };
    }

    case 'delete_annual_goal': {
      const id = typeof i.annualOKRId === 'string' ? i.annualOKRId : '';
      if (!id) return state;
      return { ...state, ...execDeleteAnnual(state, id) };
    }

    // ── Quarterly Objective ───────────────────────────────────────────────────

    case 'create_quarterly_objective': {
      const annualOKRId = typeof i.annualOKRId === 'string' ? i.annualOKRId : '';
      const text        = typeof i.text        === 'string' ? i.text        : '';
      const quarter     = typeof i.quarter     === 'string' ? i.quarter     : 'Q1';
      const year        = typeof i.year        === 'number' ? i.year        : new Date().getFullYear();
      if (!annualOKRId || !text) return state;
      if (!state.annualOKRs.some(o => o.id === annualOKRId)) return state;
      const qo: QuarterlyObjective = {
        id: newId(), annualOKRId,
        objective: text,
        quarter: quarter as QuarterlyObjective['quarter'],
        year,
      };
      return { ...state, quarterlyObjectives: [...state.quarterlyObjectives, qo] };
    }

    case 'edit_quarterly_objective': {
      const id = typeof i.quarterlyObjectiveId === 'string' ? i.quarterlyObjectiveId : '';
      if (!id || !state.quarterlyObjectives.some(q => q.id === id)) return state;
      return {
        ...state,
        quarterlyObjectives: state.quarterlyObjectives.map(q => q.id !== id ? q : {
          ...q,
          ...(typeof i.text    === 'string' ? { objective: i.text }                                        : {}),
          ...(typeof i.quarter === 'string' ? { quarter:   i.quarter as QuarterlyObjective['quarter'] }    : {}),
          ...(typeof i.year    === 'number' ? { year:      i.year }                                        : {}),
        }),
      };
    }

    case 'delete_quarterly_objective': {
      const id = typeof i.quarterlyObjectiveId === 'string' ? i.quarterlyObjectiveId : '';
      if (!id) return state;
      return { ...state, ...execDeleteQuarterly(state, id) };
    }

    // ── Monthly Key Result ────────────────────────────────────────────────────

    case 'create_monthly_kr': {
      const quarterlyObjectiveId = typeof i.quarterlyObjectiveId === 'string' ? i.quarterlyObjectiveId : '';
      const text  = typeof i.text  === 'string' ? i.text  : '';
      const month = typeof i.month === 'number' ? i.month : 1;
      const year  = typeof i.year  === 'number' ? i.year  : new Date().getFullYear();
      if (!quarterlyObjectiveId || !text) return state;
      if (!state.quarterlyObjectives.some(q => q.id === quarterlyObjectiveId)) return state;
      const kr: MonthlyKeyResult = {
        id: newId(), quarterlyObjectiveId, keyResult: text, month, year,
      };
      return { ...state, monthlyKRs: [...state.monthlyKRs, kr] };
    }

    case 'edit_monthly_kr': {
      const id = typeof i.monthlyKRId === 'string' ? i.monthlyKRId : '';
      if (!id || !state.monthlyKRs.some(k => k.id === id)) return state;
      return {
        ...state,
        monthlyKRs: state.monthlyKRs.map(k => k.id !== id ? k : {
          ...k,
          ...(typeof i.text  === 'string' ? { keyResult: i.text  } : {}),
          ...(typeof i.month === 'number' ? { month:     i.month } : {}),
          ...(typeof i.year  === 'number' ? { year:      i.year  } : {}),
        }),
      };
    }

    case 'delete_monthly_kr': {
      const id = typeof i.monthlyKRId === 'string' ? i.monthlyKRId : '';
      if (!id) return state;
      return { ...state, ...execDeleteMonthly(state, id) };
    }

    default:
      return state;
  }
}
