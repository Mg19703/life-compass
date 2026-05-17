import type { AppState } from '../types';
import { buildCoachContext, COACH_SETUP_INCOMPLETE } from './coachContext';
import { SYSTEM_PROMPT } from './coachPrompt';
import type {
  AnthropicTool,
  AnthropicMessageParam,
  AnthropicContentBlock,
  CallCoachWithToolsResult,
} from './types';

export type { AnthropicTool, AnthropicMessageParam, CallCoachWithToolsResult };

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages:   [{ role: 'user', content: userMessage }],
  };

  console.log('[life-compass] API request:', JSON.stringify({
    model:      requestBody.model,
    max_tokens: requestBody.max_tokens,
    system:     requestBody.system?.substring(0, 200),
    messages:   requestBody.messages,
  }, null, 2));

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
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json() as { content: Array<{ type: string; text: string }> };
      const text = data.content?.find(c => c.type === 'text')?.text ?? '';
      return { text, error: false };
    }

    // Log raw error body for debugging — never shown in the UI
    const errorBody = await response.text().catch(() => '(could not read body)');
    console.log(`[life-compass] API error ${response.status}:`, errorBody);

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

// ─── STORY-053: Tool-calling multi-turn loop ──────────────────────────────────
//
// callCoachWithTools — entry point for chat messages that may trigger tool use.
// callCount tracks API calls made in this chain; the 8-call cap prevents runaway
// spend. Callers must thread callCount through each sendToolResult invocation.
//
// sendToolResult — continues a tool-use chain after the user confirms an action.
// callCount is required (no default) to prevent accidental cap reset.

// Internal: shared API call + response parse logic.
// Separated so callCoachWithTools (new conversation) and sendToolResult
// (continuation) don't duplicate headers, timeout, or stop_reason branching.
async function dispatchToAnthropic(
  messages: AnthropicMessageParam[],
  system: string,
  apiKey: string,
  tools: AnthropicTool[],
  callCount: number,
): Promise<CallCoachWithToolsResult> {
  if (callCount >= 8) {
    return { type: 'message', text: 'Coach reached its action limit — start a new message to continue.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const requestBody: Record<string, unknown> = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages,
    // Omit tools key entirely when empty — the API rejects tools:[] on some versions
    ...(tools.length > 0 ? { tools } : {}),
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key':                                 apiKey,
        'anthropic-version':                         '2023-06-01',
        'content-type':                              'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(could not read body)');
      console.log(`[life-compass] callCoachWithTools API error ${response.status}:`, errorBody);
      if (response.status === 401) return { type: 'message', text: 'Invalid API key — update it in Setup.', error: true };
      if (response.status === 429) return { type: 'message', text: 'Rate limit hit — try again in a moment.', error: true };
      return { type: 'message', text: 'Coach is unavailable right now — try again.', error: true };
    }

    const data = await response.json() as {
      stop_reason: string;
      content: AnthropicContentBlock[];
    };

    const stopReason  = data.stop_reason;
    const content     = Array.isArray(data.content) ? data.content : [];
    const textBlock   = content.find(c => c.type === 'text');
    const toolBlock   = content.find(c => c.type === 'tool_use');

    if (stopReason === 'end_turn') {
      const assistantTurn: AnthropicMessageParam = { role: 'assistant', content };
      return {
        type:                'message',
        text:                (textBlock?.text as string | undefined) ?? '',
        conversationHistory: [...messages, assistantTurn].slice(-20),
      };
    }

    if (stopReason === 'tool_use') {
      if (!toolBlock || !toolBlock['id'] || !toolBlock['input']) {
        return { type: 'message', text: 'Action format invalid — please try again.', error: true };
      }
      // Append the assistant turn (containing the tool_use block) to history,
      // then trim to the last 20 messages to bound context growth.
      const assistantTurn: AnthropicMessageParam = { role: 'assistant', content };
      const updatedHistory = [...messages, assistantTurn].slice(-20);

      return {
        type:                'tool_use',
        toolName:            toolBlock['name'] as string,
        toolInput:           toolBlock['input'],
        toolUseId:           toolBlock['id'] as string,
        conversationHistory: updatedHistory,
        // Capture any reasoning text the model emitted before the tool call.
        assistantText:       textBlock ? (textBlock['text'] as string | undefined) : undefined,
      };
    }

    if (stopReason === 'max_tokens') {
      return { type: 'message', text: 'Response exceeded the output limit — try a shorter request.', error: true };
    }

    return { type: 'message', text: 'Coach returned an unexpected response.', error: true };

  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { type: 'message', text: 'Coach timed out — please try again.', error: true };
    }
    return { type: 'message', text: 'Connection failed — check your internet.', error: true };
  } finally {
    clearTimeout(timeout);
  }
}

export async function callCoachWithTools(
  userMessage:  string,
  state:        AppState,
  tools:        AnthropicTool[],
  callCount     = 0,
  priorHistory: AnthropicMessageParam[] = [],
): Promise<CallCoachWithToolsResult> {
  const apiKey = state.apiKey;
  if (!apiKey) return { type: 'message', text: 'Invalid API key — update it in Setup.', error: true };

  const context = buildCoachContext(state);
  if (context === COACH_SETUP_INCOMPLETE) {
    return { type: 'message', text: 'Complete Setup before using the Coach.', error: true };
  }

  const system   = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);
  const messages: AnthropicMessageParam[] = [...priorHistory, { role: 'user', content: userMessage }];

  return dispatchToAnthropic(messages, system, apiKey, tools, callCount);
}

export async function sendToolResult(
  conversationHistory: AnthropicMessageParam[],
  toolUseId:           string,
  result:              unknown,
  state:               AppState,
  tools:               AnthropicTool[],
  callCount:           number, // required — no default; caller must track and increment
): Promise<CallCoachWithToolsResult> {
  const apiKey = state.apiKey;
  if (!apiKey) return { type: 'message', text: 'Invalid API key — update it in Setup.', error: true };

  const context = buildCoachContext(state);
  if (context === COACH_SETUP_INCOMPLETE) {
    return { type: 'message', text: 'Complete Setup before using the Coach.', error: true };
  }

  const system = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

  // Append the tool result as a user turn, then trim to last 20.
  const toolResultMessage: AnthropicMessageParam = {
    role:    'user',
    content: [{ type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(result) }],
  };
  const updatedHistory = [...conversationHistory, toolResultMessage].slice(-20);

  return dispatchToAnthropic(updatedHistory, system, apiKey, tools, callCount);
}
