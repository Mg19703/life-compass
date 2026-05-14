import type { AppState } from './types';
import { DEFAULT_APP_STATE, SCHEMA_VERSION } from './defaults';

// Fills any missing top-level AppState fields with their defaults.
// Guards against null, primitives, and arrays before field-filling.
export function migrate(loaded: unknown): AppState {
  if (
    typeof loaded !== 'object' ||
    loaded === null ||
    Array.isArray(loaded)
  ) {
    console.warn('[life-compass] Loaded state is not an object — using default state.');
    return { ...DEFAULT_APP_STATE };
  }

  const partial = loaded as Record<string, unknown>;
  const migrated: AppState = { ...DEFAULT_APP_STATE };

  // Preserve any valid top-level fields from the loaded state
  for (const key of Object.keys(DEFAULT_APP_STATE) as (keyof AppState)[]) {
    if (key in partial && partial[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (migrated as any)[key] = partial[key];
    }
  }

  // Always stamp current schema version after migration
  migrated.schemaVersion = SCHEMA_VERSION;

  // Ensure deathbedGoals is always length 7
  if (!Array.isArray(migrated.deathbedGoals) || migrated.deathbedGoals.length !== 7) {
    const existing = Array.isArray(migrated.deathbedGoals) ? migrated.deathbedGoals : [];
    migrated.deathbedGoals = Array.from({ length: 7 }, (_, i) =>
      typeof existing[i] === 'string' ? existing[i] : '',
    );
  }

  return migrated;
}

export { SCHEMA_VERSION };
