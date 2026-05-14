import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../types';
import { loadState, saveState } from '../storage';
import { migrate } from '../migrations';
import { DEFAULT_APP_STATE, SCHEMA_VERSION } from '../defaults';

// saveState is intentionally not re-exported — all mutations go through updateState.

/**
 * Merge contract (one-level shallow):
 *   - Scalar top-level keys: replaced by the partial value
 *   - Object top-level keys: shallow-merged (sibling scalar fields preserved)
 *   - Array top-level keys: replaced entirely (never concatenated)
 *   - Explicit null: replaces the existing value (intentional reset)
 *
 * Uses functional setState so rapid sequential calls never merge against stale closures.
 * saveState is called synchronously inside the updater, before React schedules a re-render.
 */
export function useAppState(): {
  state: AppState;
  updateState: (partial: Partial<AppState>) => void;
} {
  const initialized = useRef(false);

  const [state, setState] = useState<AppState>(() => {
    // useRef guard: only load once, even under React Strict Mode double-invocation
    if (initialized.current) return DEFAULT_APP_STATE;
    initialized.current = true;

    const loaded = loadState();

    // Run migration if schema version mismatches or state looks incomplete
    if (loaded.schemaVersion !== SCHEMA_VERSION) {
      return migrate(loaded);
    }

    return loaded;
  });

  // Sync the ref with actual initialized state (handles Strict Mode second-pass)
  useEffect(() => {
    initialized.current = true;
  }, []);

  const updateState = useCallback((partial: Partial<AppState>) => {
    setState(prev => {
      const next = shallowMerge(prev, partial);
      saveState(next); // synchronous — before React schedules re-render
      return next;
    });
  }, []);

  return { state, updateState };
}

// One-level shallow merge:
//   - Arrays: replaced entirely
//   - Objects (non-array, non-null): shallow-merged (one level deep)
//   - Everything else (scalars, null): replaced
function shallowMerge(base: AppState, partial: Partial<AppState>): AppState {
  const result = { ...base };

  for (const key of Object.keys(partial) as (keyof AppState)[]) {
    const incoming = partial[key];
    const existing = base[key];

    if (incoming === null || incoming === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = incoming ?? null;
    } else if (Array.isArray(incoming)) {
      // Arrays replaced entirely — never concatenated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = incoming;
    } else if (typeof incoming === 'object' && !Array.isArray(existing)) {
      // Plain objects: shallow-merge one level
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = { ...(existing as object), ...(incoming as object) };
    } else {
      // Scalars: replaced
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = incoming;
    }
  }

  return result;
}
