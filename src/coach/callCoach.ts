import type { AppState } from '../types';
import { buildCoachContext, COACH_SETUP_INCOMPLETE } from './coachContext';
import { SYSTEM_PROMPT } from './coachPrompt';

export interface CoachResponse {
  text: string;
  error: boolean;
}

const API_URL     = 'https://api.anthropic.com/v1/messages';
const MODEL       = 'claude-sonnet-4-6';
const MAX_TOKENS  = 1024;
const TIMEOUT_MS  = 30_000;

// ─── STORY-020: Claude API integration ───────────────────────────────────────
//
// Returns a CoachResponse in all cases — never throws.
// The caller (CoachTab) is responsible for blocking the call when profile is
// incomplete (buildCoachContext returns COACH_SETUP_INCOMPLETE).

export async function callCoach(userMessage: string, state: AppState): Promise<CoachResponse> {
  const apiKey = state.apiKey;
  if (!apiKey) {
    return { text: 'Invalid API key — update it in Setup.', error: true };
  }

  const context = buildCoachContext(state);
  if (context === COACH_SETUP_INCOMPLETE) {
    return { text: 'Complete Setup before using the Coach.', error: true };
  }

  const system = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

  // Development-only assertion: catch substitution failures early
  if (import.meta.env.DEV && system.includes('{{CONTEXT}}')) {
    console.error('[life-compass] {{CONTEXT}} substitution failed in system prompt');
  }

  // Debug log with key redacted — gated to development builds only
  if (import.meta.env.DEV) {
    console.debug('[life-compass] callCoach request', {
      model: MODEL,
      userMessage,
      contextLength: context.length,
      apiKey: `${apiKey.slice(0, 8)}…redacted`,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key':                              apiKey,
        'anthropic-version':                      '2023-06-01',
        'content-type':                           'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (response.ok) {
      const data = await response.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content?.find(c => c.type === 'text')?.text ?? '';
      return { text, error: false };
    }

    // HTTP error paths — never expose raw response body to the UI
    if (response.status === 401) return { text: 'Invalid API key — update it in Setup.', error: true };
    if (response.status === 429) return { text: 'Rate limit hit — try again in a moment.', error: true };
    if (response.status === 400) return { text: 'Your request could not be processed — your context may be too large.', error: true };
    return { text: 'Coach is unavailable right now — try again.', error: true };

  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { text: 'Coach took too long to respond — try again.', error: true };
    }
    return { text: 'Connection failed — check your internet.', error: true };
  } finally {
    clearTimeout(timeout);
  }
}
