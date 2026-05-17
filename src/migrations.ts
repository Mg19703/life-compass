import type { AppState } from './types';
import { DEFAULT_APP_STATE, LIFE_DIMENSIONS, SCHEMA_VERSION } from './defaults';

// ─── Version-dispatch migration table ─────────────────────────────────────────
// Each function receives a state that has already been type-guarded as an object
// and upgrades it from version N to N+1. Add new entries here as schema versions grow.

function migrateV1toV2(partial: Record<string, unknown>): Record<string, unknown> {
  // v2 adds habits[] and habitLogs[]. If absent, seed with empty arrays.
  return {
    ...partial,
    habits:    Array.isArray(partial.habits)    ? partial.habits    : [],
    habitLogs: Array.isArray(partial.habitLogs) ? partial.habitLogs : [],
    schemaVersion: 2,
  };
}

function migrateV2toV3(partial: Record<string, unknown>): Record<string, unknown> {
  // v3 adds subtasks: Subtask[] to every DailyMIT. Back-fill with [] if absent.
  // Non-object entries (null, corrupt) are dropped with a warning.
  const rawMITs = Array.isArray(partial.dailyMITs) ? partial.dailyMITs : [];
  const migratedMITs = rawMITs
    .filter((m: unknown) => {
      if (typeof m !== 'object' || m === null) {
        console.warn('[life-compass] migrateV2toV3: dropping non-object MIT entry', m);
        return false;
      }
      return true;
    })
    .map((m: unknown) => ({ subtasks: [], ...(m as object) }));

  // v3 also adds deathbedGoalMappings[]. Populate from LIFE_DIMENSIONS positional
  // defaults only if the field is absent or corrupt (idempotency guard).
  let deathbedGoalMappings = partial.deathbedGoalMappings;
  if (!Array.isArray(deathbedGoalMappings)) {
    // Normalize deathbedGoals to length-7 *before* computing mappings so indices
    // are stable and the mapping never reads from an out-of-bounds slot.
    const rawGoals = Array.isArray(partial.deathbedGoals) ? partial.deathbedGoals : [];
    const normalizedGoals = Array.from({ length: 7 }, (_, i) =>
      typeof rawGoals[i] === 'string' ? (rawGoals[i] as string) : ''
    );
    deathbedGoalMappings = normalizedGoals.map((g, i) =>
      g.trim() !== '' ? (LIFE_DIMENSIONS[i]?.id ?? null) : null
    );
  }

  return { ...partial, dailyMITs: migratedMITs, deathbedGoalMappings, schemaVersion: 3 };
}

function migrateV3toV4(partial: Record<string, unknown>): Record<string, unknown> {
  // v4 adds turmoilDismissedFor to AppState and carriedTurmoilFrom to every DailyLog.
  const rawLogs =
    typeof partial.dailyLogs === 'object' && partial.dailyLogs !== null
      ? (partial.dailyLogs as Record<string, unknown>)
      : {};

  const migratedLogs: Record<string, unknown> = {};
  for (const [date, log] of Object.entries(rawLogs)) {
    if (typeof log === 'object' && log !== null) {
      migratedLogs[date] = { carriedTurmoilFrom: null, ...(log as object) };
    }
  }

  return {
    ...partial,
    dailyLogs: migratedLogs,
    turmoilDismissedFor: null,
    schemaVersion: 4,
  };
}

const VERSION_MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
};

// ─── Top-level migrate() ──────────────────────────────────────────────────────
// Called by useAppState when loaded.schemaVersion !== SCHEMA_VERSION.
// Runs each applicable migration step in order, then fills any remaining
// missing fields with DEFAULT_APP_STATE values, and enforces invariants.

export function migrate(loaded: unknown): AppState {
  if (
    typeof loaded !== 'object' ||
    loaded === null ||
    Array.isArray(loaded)
  ) {
    console.warn('[life-compass] Loaded state is not an object — using default state.');
    return { ...DEFAULT_APP_STATE };
  }

  let partial = loaded as Record<string, unknown>;
  const loadedVersion = typeof partial.schemaVersion === 'number' ? partial.schemaVersion : 0;

  // Run each migration step from loadedVersion up to current SCHEMA_VERSION.
  // Each step is isolated in try/catch — a corrupt stored record in one step
  // must not crash the app. On failure we reset to defaults with the current
  // schema version so the bad data isn't retried on the next load.
  for (let v = loadedVersion; v < SCHEMA_VERSION; v++) {
    const step = VERSION_MIGRATIONS[v];
    if (step) {
      try {
        partial = step(partial);
      } catch (err) {
        console.error(`[life-compass] Migration step ${v}→${v + 1} failed — resetting to defaults:`, err);
        return { ...DEFAULT_APP_STATE, schemaVersion: SCHEMA_VERSION };
      }
    }
  }

  // Fill any remaining missing fields with defaults (handles corrupt or very old payloads)
  const migrated: AppState = { ...DEFAULT_APP_STATE };
  for (const key of Object.keys(DEFAULT_APP_STATE) as (keyof AppState)[]) {
    if (key in partial && partial[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (migrated as any)[key] = partial[key];
    }
  }

  migrated.schemaVersion = SCHEMA_VERSION;

  // Invariant: deathbedGoals is always length 7
  if (!Array.isArray(migrated.deathbedGoals) || migrated.deathbedGoals.length !== 7) {
    const existing = Array.isArray(migrated.deathbedGoals) ? migrated.deathbedGoals : [];
    migrated.deathbedGoals = Array.from({ length: 7 }, (_, i) =>
      typeof existing[i] === 'string' ? existing[i] : '',
    );
  }

  return migrated;
}

export { SCHEMA_VERSION };
