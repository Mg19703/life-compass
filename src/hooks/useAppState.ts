import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../types';
import { loadState, saveState } from '../storage';
import { migrate } from '../migrations';
import { DEFAULT_APP_STATE, SCHEMA_VERSION } from '../defaults';

// saveState is intentionally not re-exported — all mutations go through updateState.

/**
 * Merge contract (one-level shallow):
 *   - undefined in partial      → key skipped (no change)
 *   - null / scalar in partial  → replaces existing value
 *   - array in partial          → replaces existing array entirely (never concatenated)
 *   - plain object in partial   → shallow-merged with existing object
 *                                 (sibling fields on existing are preserved)
 *                                 if existing is null/scalar, incoming object is assigned directly
 */
export function useAppState(): {
  state: AppState;
  updateState: (partial: Partial<AppState>) => void;
  getLatestState: () => AppState;
} {
  const initialized = useRef(false);

  const [state, setState] = useState<AppState>(() => {
    // useRef guard: only load once, even under React Strict Mode double-invocation
    if (initialized.current) return DEFAULT_APP_STATE;
    initialized.current = true;

    const loaded = loadState();
    if (loaded.schemaVersion !== SCHEMA_VERSION) {
      return migrate(loaded);
    }
    return loaded;
  });

  // Tracks the latest state synchronously — updated only inside the setState
  // updater, before React schedules a commit. NOT updated in the render body:
  // Strict Mode double-invokes the component with the pre-commit state, which
  // would overwrite the value the updater just wrote with the previous state.
  const latestStateRef = useRef<AppState>(state);

  // Persist on every committed state change.
  // Kept in useEffect (not inside the setState updater) so the updater stays
  // pure — React Strict Mode double-invokes updaters, which caused saveState
  // to run against a stale prev and wipe nested-object sibling fields.
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Merge is computed synchronously against latestStateRef.current, so:
  //   1. the ref is updated before this call returns — console reads work immediately
  //   2. sequential calls chain correctly through the ref, not React's deferred queue
  //   3. setState receives the finished value (not a functional updater), so React
  //      always commits the correct final state regardless of batching behaviour
  const updateState = useCallback((partial: Partial<AppState>) => {
    const next = shallowMerge(latestStateRef.current, partial);
    latestStateRef.current = next;
    setState(next);
  }, []);

  return { state, updateState, getLatestState: () => latestStateRef.current };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shallowMerge(base: AppState, partial: Partial<AppState>): AppState {
  const result = { ...base };

  for (const key of Object.keys(partial) as (keyof AppState)[]) {
    const incoming = partial[key];
    const existing = base[key];

    if (incoming === undefined) {
      // No-op: undefined means "leave this key alone"
      continue;
    } else if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) {
      // Null, scalars, arrays: replace entirely
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = incoming;
    } else {
      // Plain object: shallow-merge with existing if it is also a plain object,
      // otherwise assign incoming directly (handles null-existing case).
      const existingObj = isPlainObject(existing) ? existing : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = { ...existingObj, ...(incoming as object) };
    }
  }

  return result;
}
