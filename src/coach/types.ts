// ─── Anthropic API types (raw fetch — no SDK installed) ───────────────────────
// Minimal interfaces that satisfy the Anthropic messages API contract.
// Exported so tools.ts (STORY-054) and CoachTab (STORY-056) can import without
// re-declaring or casting from callCoach.ts implementation details.

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: unknown;
}

// Content union covers both outgoing (string | tool_result array) and incoming
// (text | tool_use block array) message shapes.
export type AnthropicContentBlock = { type: string; [key: string]: unknown };

export type AnthropicMessageParam = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

// ─── callCoachWithTools return type ───────────────────────────────────────────

export type CallCoachWithToolsResult =
  | { type: 'message'; text: string; error?: boolean }
  | {
      type: 'tool_use';
      toolName: string;
      toolInput: unknown;
      toolUseId: string;
      conversationHistory: AnthropicMessageParam[];
      /** Text block from the same assistant turn, when the model reasons before calling a tool */
      assistantText?: string;
    };
