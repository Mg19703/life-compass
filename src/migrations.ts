import type { AppState } from './types';
import { DEFAULT_APP_STATE, SCHEMA_VERSION } from './defaults';

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

const VERSION_MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  1: migrateV1toV2,
  // 2: migrateV2toV3, — add here when v3 lands
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

  // Run each migration step from loadedVersion up to current SCHEMA_VERSION
  for (let v = loadedVersion; v < SCHEMA_VERSION; v++) {
    const step = VERSION_MIGRATIONS[v];
    if (step) {
      partial = step(partial);
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
