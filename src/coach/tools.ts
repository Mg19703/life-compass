import type { AnthropicTool } from './types';

// ─── STORY-054: OKR and MIT tool schemas ──────────────────────────────────────
// Single source of truth for all Coach tool definitions.
// Imported by callCoach.ts (STORY-056+) and the system prompt builder (STORY-060).
// No runtime side effects — this module only exports constant arrays.

// ─── Annual Goal tools ────────────────────────────────────────────────────────

const create_annual_goal: AnthropicTool = {
  name: 'create_annual_goal',
  description: 'Create a new annual goal (top-level OKR) and link it to one of the six life dimensions. Use when the user explicitly asks to add a new annual goal.',
  input_schema: {
    type: 'object',
    properties: {
      text:        { type: 'string',  description: 'The annual goal text.' },
      dimensionId: { type: 'string',  description: 'One of: inner-life, relationships, health, financial-security, service, learning-growth.' },
    },
    required: ['text', 'dimensionId'],
  },
};

const edit_annual_goal: AnthropicTool = {
  name: 'edit_annual_goal',
  description: 'Edit the text or dimension of an existing annual goal. Use when the user explicitly asks to update or rename a goal.',
  input_schema: {
    type: 'object',
    properties: {
      annualOKRId: { type: 'string', description: 'The ID of the annual goal to edit.' },
      text:        { type: 'string', description: 'New goal text (optional).' },
      dimensionId: { type: 'string', description: 'New dimension ID (optional).' },
    },
    required: ['annualOKRId'],
  },
};

const delete_annual_goal: AnthropicTool = {
  name: 'delete_annual_goal',
  description: 'Delete an annual goal and ALL of its children — quarterly objectives, monthly key results, and weekly initiatives. This action cannot be undone. Only call when the user explicitly says "delete" or "remove".',
  input_schema: {
    type: 'object',
    properties: {
      annualOKRId: { type: 'string', description: 'The ID of the annual goal to delete.' },
    },
    required: ['annualOKRId'],
  },
};

// ─── Quarterly Objective tools ────────────────────────────────────────────────

const create_quarterly_objective: AnthropicTool = {
  name: 'create_quarterly_objective',
  description: 'Create a new quarterly objective under an existing annual goal. Use when the user explicitly asks to add a quarterly objective.',
  input_schema: {
    type: 'object',
    properties: {
      annualOKRId: { type: 'string',  description: 'The ID of the parent annual goal.' },
      text:        { type: 'string',  description: 'The quarterly objective text.' },
      quarter:     { type: 'string',  enum: ['Q1', 'Q2', 'Q3', 'Q4'], description: 'The quarter this objective belongs to.' },
      year:        { type: 'number',  description: 'The year (e.g. 2026).' },
    },
    required: ['annualOKRId', 'text', 'quarter', 'year'],
  },
};

const edit_quarterly_objective: AnthropicTool = {
  name: 'edit_quarterly_objective',
  description: 'Edit the text, quarter, or year of an existing quarterly objective.',
  input_schema: {
    type: 'object',
    properties: {
      quarterlyObjectiveId: { type: 'string', description: 'The ID of the quarterly objective to edit.' },
      text:    { type: 'string', description: 'New objective text (optional).' },
      quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'], description: 'New quarter (optional).' },
      year:    { type: 'number', description: 'New year (optional).' },
    },
    required: ['quarterlyObjectiveId'],
  },
};

const delete_quarterly_objective: AnthropicTool = {
  name: 'delete_quarterly_objective',
  description: 'Delete a quarterly objective and ALL of its children — monthly key results and weekly initiatives. This action cannot be undone. Only call when the user explicitly says "delete" or "remove".',
  input_schema: {
    type: 'object',
    properties: {
      quarterlyObjectiveId: { type: 'string', description: 'The ID of the quarterly objective to delete.' },
    },
    required: ['quarterlyObjectiveId'],
  },
};

// ─── Monthly Key Result tools ─────────────────────────────────────────────────

const create_monthly_kr: AnthropicTool = {
  name: 'create_monthly_kr',
  description: 'Create a new monthly key result under an existing quarterly objective.',
  input_schema: {
    type: 'object',
    properties: {
      quarterlyObjectiveId: { type: 'string',  description: 'The ID of the parent quarterly objective.' },
      text:  { type: 'string',  description: 'The key result text.' },
      month: { type: 'number',  minimum: 1, maximum: 12, description: 'The month number (1–12).' },
      year:  { type: 'number',  description: 'The year (e.g. 2026).' },
    },
    required: ['quarterlyObjectiveId', 'text', 'month', 'year'],
  },
};

const edit_monthly_kr: AnthropicTool = {
  name: 'edit_monthly_kr',
  description: 'Edit the text, month, or year of an existing monthly key result.',
  input_schema: {
    type: 'object',
    properties: {
      monthlyKRId: { type: 'string', description: 'The ID of the monthly key result to edit.' },
      text:  { type: 'string', description: 'New key result text (optional).' },
      month: { type: 'number', minimum: 1, maximum: 12, description: 'New month number (optional).' },
      year:  { type: 'number', description: 'New year (optional).' },
    },
    required: ['monthlyKRId'],
  },
};

const delete_monthly_kr: AnthropicTool = {
  name: 'delete_monthly_kr',
  description: 'Delete a monthly key result and ALL of its weekly initiatives. This action cannot be undone. Only call when the user explicitly says "delete" or "remove".',
  input_schema: {
    type: 'object',
    properties: {
      monthlyKRId: { type: 'string', description: 'The ID of the monthly key result to delete.' },
    },
    required: ['monthlyKRId'],
  },
};

// ─── MIT tools ────────────────────────────────────────────────────────────────

const edit_mit: AnthropicTool = {
  name: 'edit_mit',
  description: "Edit the text or initiative link of one of today's Most Important Tasks. Only applies to today's MITs.",
  input_schema: {
    type: 'object',
    properties: {
      mitId:       { type: 'string',               description: "The ID of the MIT to edit." },
      text:        { type: 'string',               description: 'New task text (optional).' },
      initiativeId: { type: ['string', 'null'],    description: 'New initiative ID to link, or null to remove the link (optional).' },
    },
    required: ['mitId'],
  },
};

const delete_mit: AnthropicTool = {
  name: 'delete_mit',
  description: "Delete one of today's Most Important Tasks. This action cannot be undone. Only applies to today's MITs. Only call when the user explicitly says \"delete\" or \"remove\".",
  input_schema: {
    type: 'object',
    properties: {
      mitId: { type: 'string', description: 'The ID of the MIT to delete.' },
    },
    required: ['mitId'],
  },
};

// ─── Destructive tool set (used by CoachTab to set isDestructive prop) ────────
export const DESTRUCTIVE_TOOL_NAMES = new Set([
  'delete_annual_goal',
  'delete_quarterly_objective',
  'delete_monthly_kr',
  'delete_mit',
]);

// ─── Exported arrays ──────────────────────────────────────────────────────────

export const OKR_TOOLS: AnthropicTool[] = [
  create_annual_goal,
  edit_annual_goal,
  delete_annual_goal,
  create_quarterly_objective,
  edit_quarterly_objective,
  delete_quarterly_objective,
  create_monthly_kr,
  edit_monthly_kr,
  delete_monthly_kr,
];

export const MIT_TOOLS: AnthropicTool[] = [
  edit_mit,
  delete_mit,
];

// ─── Uniqueness assertion (caught at import time in dev) ──────────────────────
const _allTools = [...OKR_TOOLS, ...MIT_TOOLS];
if (import.meta.env.DEV) {
  const names = _allTools.map(t => t.name);
  const unique = new Set(names);
  if (names.length !== 11 || unique.size !== 11) {
    console.error('[life-compass] tools.ts: expected 11 unique tool names, got', names.length, 'with', unique.size, 'unique', names);
  }
}
