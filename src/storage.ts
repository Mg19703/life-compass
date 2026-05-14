/* SECURITY: API key stored in plain text in localStorage — personal single-user tool only. Never distribute. */
import type { AppState } from './types';
import { DEFAULT_APP_STATE } from './defaults';

export const STORAGE_KEY = 'life-compass-v1';
// WARNING: changing STORAGE_KEY orphans all existing persisted data with no migration path.

export function loadState(storage: Storage = window.localStorage): AppState {
  const raw = storage.getItem(STORAGE_KEY);

  // Key absent — first run
  if (raw === null) {
    return { ...DEFAULT_APP_STATE };
  }

  // Key present — attempt parse
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed as AppState;
  } catch {
    console.warn('[life-compass] localStorage data is corrupt — resetting to default state.');
    return { ...DEFAULT_APP_STATE };
  }
}

export function saveState(state: AppState, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      const estimatedKB = Math.round(JSON.stringify(state).length / 1024);
      console.warn(
        `[life-compass] localStorage quota exceeded (~${estimatedKB} KB). State not saved.`,
      );
    } else {
      throw err;
    }
  }
}

export function clearState(storage: Storage = window.localStorage): void {
  storage.removeItem(STORAGE_KEY); // no-op if key does not exist
}
