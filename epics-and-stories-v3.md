# Project: Life Compass v3

## Summary

22 stories across 7 new epics (EPIC-012 through EPIC-018), numbered STORY-044 through STORY-065. Extends v1 (STORY-001–029) and v2 (STORY-030–043).

Three major capability areas:
1. **MIT Subtasks** — break each Daily MIT into up to 10 checkbox sub-items, track granular progress.
2. **Coach Tool-Calling** — AI proposes discrete, reviewable mutations to OKR and MIT data via Anthropic tool_use API.
3. **Deathbed Mapping** — users explicitly assign each of 7 deathbed goals to one of 6 life dimensions (replaces positional fallback from v2).

Smaller improvements: Initiative hierarchy dropdown on MIT creation/editing, live MIT count badge in tab bar.

---

## Assumptions

1. v1 and v2 codebase (STORY-001–043) fully implemented and passing before any v3 story begins.
2. React + TypeScript + Vite + localStorage. No backend, no database.
3. `schemaVersion` is currently 2. `migrations.ts` is the canonical migration location.
4. `DailyMIT`, `DimensionId`, and `AppState` types already exist.
5. `callCoach.ts` already wired; v3 extends it.
6. Existing `ProposalCard` (STORY-038) is the reference for `ToolProposalCard` styling and confirm/cancel pattern.
7. "Confirm-before-apply": user sees proposed change as a card, must press a button to commit — nothing applies silently.
8. Tab bar: Setup, Today, Plan, Coach, Habits, Review (6 tabs).
9. All 22 v3 stories are MVP scope.

---

## Data model additions

```typescript
// DailyMIT gains:
subtasks: { id: string; text: string; done: boolean }[]  // default []

// AppState gains:
deathbedGoalMappings: (DimensionId | null)[]  // length 7, parallel to deathbedGoals
```

---

## Epic Overview & Dependency Map

| Epic | Title | Stories | Depends On |
|------|-------|---------|------------|
| EPIC-012 | Schema v3 Migration | STORY-044–045 | EPIC-008 (schema v2) |
| EPIC-013 | MIT Subtasks UI | STORY-046–048 | STORY-044 |
| EPIC-014 | Initiative Hierarchy Dropdown | STORY-049–051 | STORY-044 |
| EPIC-015 | Tab Bar MIT Count | STORY-052 | STORY-044 |
| EPIC-016 | Coach Tool-Calling Infrastructure | STORY-053–055 | STORY-018, STORY-038 |
| EPIC-017 | Coach OKR+MIT Tools | STORY-056–061 | STORY-053, 054, 055 |
| EPIC-018 | Deathbed Mapping UI + CSS | STORY-062–065 | STORY-045, STORY-042 |

**Critical path:** STORY-044 → STORY-053 → STORY-054 → STORY-055 → STORY-056 → STORY-057/058 → STORY-059 → STORY-061

---

## EPIC-012: Schema v3 Migration

**User Value:** Existing saved data upgraded non-destructively to support subtasks and explicit deathbed-to-dimension mappings. No data loss, no error on first load.

**Dependencies:** EPIC-008

---

### STORY-044: Add subtasks field to DailyMIT type and migrate stored data

- Type: Technical Story
- Statement: As an engineer, I want the `DailyMIT` type to include a `subtasks` array and the migration layer to back-fill it on all stored MITs.
- Acceptance Criteria:
  - [ ] `DailyMIT` gains `subtasks: { id: string; text: string; done: boolean }[]`
  - [ ] `schemaVersion` constant updated to `3`
  - [ ] `migrations.ts` contains `v2_to_v3` that iterates every stored `DailyMIT` and sets `subtasks: []` if absent
  - [ ] Migration dispatcher calls `v2_to_v3` when `schemaVersion === 2`
  - [ ] After migration, `schemaVersion` stored in localStorage is `3`
  - [ ] Unit test verifies: MIT with no `subtasks` field → `subtasks: []` and `schemaVersion` → `3`
  - [ ] No existing MIT data (text, status, date, etc.) altered by migration
  - [ ] `useAppState.ts` adds a runtime normalization guard applied before the migration version check: `dailyMITs: loaded.dailyMITs?.map(m => ({ subtasks: [], ...m })) ?? []` — matches the existing habits/habitLogs normalization pattern; prevents crash during incremental dev when v3 code loads pre-v3 state (#20)
  - [ ] `handleCarryForward` in `TodayTab.tsx` copies only pending subtasks to the carried MIT: `subtasks: (mit.subtasks ?? []).filter(s => !s.done)` — completed subtasks are not carried; `?? []` guards against undefined during rollout (#12)
  - [ ] Each migration step in `migrations.ts` is wrapped in `try/catch`; on any thrown error the function logs the error to `console.error` and returns `DEFAULT_APP_STATE` — the app never crashes on load due to a migration failure (Decision 3)
  - [ ] `VERSION_MIGRATIONS[2]` is registered with `migrateV2toV3` in the dispatch table before `SCHEMA_VERSION` is bumped to `3` — ordering enforced by the story's implementation order
  - [ ] A migrated MIT that already has a `subtasks` array is not reset to `[]`; existing subtasks are preserved (spread order: `{ subtasks: [], ...m }` ensures `m.subtasks` overwrites the default)
- Complexity: S
- Dependencies: none

---

### STORY-045: Add deathbedGoalMappings to AppState and migrate stored data

- Type: Technical Story
- Statement: As an engineer, I want `AppState` to carry a `deathbedGoalMappings` array and the migration to populate it from positional defaults.
- Acceptance Criteria:
  - [ ] `AppState` gains `deathbedGoalMappings: (DimensionId | null)[]`
  - [ ] Array is always length 7, parallel to `deathbedGoals`
  - [ ] `v2_to_v3` migration populates `deathbedGoalMappings[i]` using the **actual `LIFE_DIMENSIONS` array order** (not named position labels) — exact rule: `deathbedGoalMappings[i] = deathbedGoals[i]?.trim() !== '' ? LIFE_DIMENSIONS[i]?.id ?? null : null`; `LIFE_DIMENSIONS[0]` is `inner-life`, `[1]` is `relationships`, `[2]` is `health`, etc. — read from the live array, never hardcoded (Decision 3, #17)
  - [ ] If goal slot is empty/undefined, `deathbedGoalMappings[i]` is `null` (never assigned a positional dimension) (#17)
  - [ ] Each migration step in `migrations.ts` is wrapped in `try/catch`; on any thrown error the function logs `console.error` and returns `DEFAULT_APP_STATE` — app never crashes on load due to migration failure (Decision 3)
  - [ ] If `deathbedGoals` is shorter than 7 at migration time, remaining mapping slots are `null`; if longer than 7, only indices 0–6 are mapped (excess ignored)
  - [ ] If `deathbedGoalMappings` already exists in stored data, migration does not overwrite it
  - [ ] After migration, reading `appState.deathbedGoalMappings` returns a 7-element array with no holes
  - [ ] Unit test: stored `AppState` with 3 goals and no `deathbedGoalMappings` → 7-element array, positions 0–2 have dimension IDs, 3–6 are `null`
- Complexity: S
- Dependencies: STORY-044

---

## EPIC-013: MIT Subtasks UI

**User Value:** Users can break a Daily MIT into up to 10 granular subtasks, check them off individually, and see a compact badge showing progress.

**Dependencies:** STORY-044

---

### STORY-046: Subtask badge and collapsible panel on MIT card

- Type: User Story
- Statement: As a user, I want to see a subtask progress badge on each MIT card and expand a panel to view details.
- Acceptance Criteria:
  - [ ] MIT card shows `X/Y` badge only when `subtasks.length > 0` (no empty badge)
  - [ ] Clicking badge or adjacent chevron toggles collapsible subtask panel below MIT title
  - [ ] Panel is collapsed by default on load
  - [ ] Collapse/expand state is local component state (not persisted)
  - [ ] Badge updates reactively when subtasks are checked or added in open panel
  - [ ] Badge color: amber (`--color-accent`) when `done > 0 && done < total`; green (`--color-success`) when `done === total`; amber when `done === 0` and subtasks exist (#15)
  - [ ] Keyboard: Enter or Space on toggle also opens/closes panel
  - [ ] Each MIT card tracks `openMode: 'edit' | 'subtasks' | null` in local state; opening the subtask panel sets `openMode: 'subtasks'` and closes edit mode if open; opening edit mode sets `openMode: 'edit'` and collapses the subtask panel (#11)
  - [ ] On past dates (`activeDate !== today`): subtask panel renders read-only — add/delete controls hidden, a muted "Past date — read only" label shown at top of panel (#13)
- Complexity: S
- Dependencies: STORY-044

---

### STORY-047: Add and delete subtasks within the MIT card panel

- Type: User Story
- Statement: As a user, I want to add new subtask items to a MIT and delete existing ones.
- Acceptance Criteria:
  - [ ] Expanded panel shows text input + "Add" button
  - [ ] Enter in input also triggers add
  - [ ] New subtask: unique `id` (crypto.randomUUID()), trimmed text, `done: false`
  - [ ] Input clears after successful add
  - [ ] When `subtasks.length >= 10`: add input and "Add" button are disabled; a muted note "Max 10 subtasks." is shown in their place — no error-on-submit, no error clearance logic needed (#14)
  - [ ] Each subtask row has a delete icon; clicking removes that subtask
  - [ ] Deleting a `done: true` subtask allowed without confirmation
  - [ ] Whitespace-only input: silent no-op (no error message)
  - [ ] All mutations persist to localStorage immediately
  - [ ] On past dates: add input, "Add" button, and all delete icons are hidden (panel is read-only per STORY-046) (#13)
- Complexity: M
- Dependencies: STORY-046

---

### STORY-048: Subtask checkbox completion tracking

- Type: User Story
- Statement: As a user, I want to check off individual subtasks and see the badge count update in real time.
- Acceptance Criteria:
  - [ ] Each subtask row shows a checkbox left of the text
  - [ ] Checking sets `done: true`, persists immediately
  - [ ] Unchecking sets `done: false`, persists immediately
  - [ ] Checked subtasks render with strikethrough text
  - [ ] `X/Y` badge updates immediately on checkbox toggle
  - [ ] Checking all subtasks does NOT auto-complete the parent MIT
  - [ ] Subtask order does not change when checked/unchecked (no auto-resorting)
  - [ ] Checkboxes are disabled on past dates (`activeDate !== today`); panel still renders for read-only review (#13)
- Complexity: S
- Dependencies: STORY-047

---

## EPIC-014: Initiative Hierarchy Dropdown

**User Value:** When creating or editing a Daily MIT, users can associate it with a Weekly Initiative from their plan, creating a visible thread from daily action to weekly intent.

**Dependencies:** STORY-044

---

### STORY-049: InitiativeDropdown reusable component

- Type: Technical Story
- Statement: As an engineer, I want a reusable `InitiativeDropdown` component for use in MIT creation and editing forms.
- Acceptance Criteria:
  - [ ] Component at `src/components/InitiativeDropdown.tsx`
  - [ ] Props: `value: string | null`, `onChange: (initiativeId: string | null) => void`, `appState: AppState`
  - [ ] First option: "No initiative" (calls `onChange(null)`)
  - [ ] Options grouped by `<optgroup>` — label = Monthly KR title; items = Weekly Initiative titles within that KR
  - [ ] Only shows this week's initiatives (week containing the MIT's date)
  - [ ] No initiatives available → only "No initiative" option, no optgroups
  - [ ] Controlled input — does not manage its own state
  - [ ] Named export
  - [ ] If the `value` prop references an `initiativeId` not found in the current week's initiatives, a disabled placeholder option `(Deleted initiative)` is shown pre-selected; user must explicitly choose another option or "No initiative" to clear (#22)
- Complexity: S
- Dependencies: STORY-044

---

### STORY-050: Initiative association on MIT creation form

- Type: User Story
- Statement: As a user, I want to optionally link a new Daily MIT to one of my Weekly Initiatives when I create it.
- Acceptance Criteria:
  - [ ] MIT creation form includes `InitiativeDropdown` below the text input
  - [ ] Dropdown defaults to "No initiative" (`null`)
  - [ ] On submit, selected `initiativeId` (or `null`) stored on new `DailyMIT`
  - [ ] Submitting with "No initiative" stores `initiativeId: null`
  - [ ] Dropdown styled with dark design system (no unstyled native select)
  - [ ] Adding MIT with initiative ID does not break 3-MIT-per-day cap check
- Complexity: M
- Dependencies: STORY-049

---

### STORY-051: Initiative association on MIT inline editing

- Type: User Story
- Statement: As a user, I want to change or remove the initiative association on an existing MIT when I edit it inline.
- Acceptance Criteria:
  - [ ] MIT card in edit mode shows `InitiativeDropdown` pre-populated with current `initiativeId`
  - [ ] User can select different initiative or "No initiative" to clear
  - [ ] On save: updated `initiativeId` persisted
  - [ ] On cancel: original `initiativeId` restored, no mutation
  - [ ] If linked initiative was deleted from plan: dropdown shows disabled `(Deleted initiative)` placeholder pre-selected; user must explicitly select a new option (inherits from InitiativeDropdown, STORY-049) (#22)
  - [ ] When not editing: initiative name shown as subtitle/tag below MIT title if `initiativeId` not null
  - [ ] If `initiativeId` is null: no subtitle or tag rendered
- Complexity: M
- Dependencies: STORY-050

---

## EPIC-015: Tab Bar MIT Count

**User Value:** Tab bar shows a live count of today's MITs, giving instant feedback without a tab switch.

**Dependencies:** STORY-044

---

### STORY-052: Live MIT count badge in tab bar

- Type: User Story
- Statement: As a user, I want to see a numeric badge next to the "Today" tab label showing my MIT count for today.
- Acceptance Criteria:
  - [ ] "Today" tab label shows badge in "completed/total" format, e.g. "2/3" — where completed = MITs with `status === 'complete'` for today, total = all DailyMITs for today regardless of origin (#21)
  - [ ] Carried-over MITs count toward total (e.g. 1 original + 2 carried = total of 3) (#21)
  - [ ] Badge shows "0/0" when no MITs for today (always visible — not hidden)
  - [ ] Badge updates immediately when a MIT is added, deleted, or completed
  - [ ] Badge uses amber accent styling; does not break tab label layout
  - [ ] `aria-label="2 of 3 MITs done today"` for accessibility (#21)
  - [ ] Maximum total display: `3`; badge never shows more than `3` in the denominator in normal operation
- Complexity: S
- Dependencies: STORY-044

---

## EPIC-016: Coach Tool-Calling Infrastructure

**User Value:** Coach tab can engage in structured tool-use dialogue with Claude, enabling it to propose discrete, reviewable changes to the user's data.

**Dependencies:** STORY-018 (Coach tab shell), STORY-038 (ProposalCard pattern)

---

### STORY-053: Extend callCoach to support tool-calling and multi-turn loop

- Type: Technical Story
- Statement: As an engineer, I want `callCoach.ts` to handle tool-use responses and execute a multi-turn loop until the model returns a final text message.
- Acceptance Criteria:
  - [ ] A new named export `callCoachWithTools` is created returning the discriminated union `Promise<{ type: 'message'; text: string; error?: boolean } | { type: 'tool_use'; toolName: string; toolInput: unknown; toolUseId: string; conversationHistory: AnthropicMessageParam[] }>`; `conversationHistory` is typed as `AnthropicMessageParam[]` (Anthropic SDK messages format), distinct from CoachTab's internal `Message` interface — this must be documented in the function signature (#9)
  - [ ] The existing `callCoach` export is unchanged and continues to return `CoachResponse: { text: string; error: boolean }` — backward compat for `handleSuggestMITs` and `handleWeeklyReview` (#9)
  - [ ] When `stop_reason === 'end_turn'`: `callCoachWithTools` returns `{ type: 'message', text }`
  - [ ] When `stop_reason === 'tool_use'` and `tool_use` content block contains valid `toolUseId` and `input`: returns `{ type: 'tool_use', toolName, toolInput, toolUseId, conversationHistory }`
  - [ ] **Failure paths (Decision 2):**
    - `stop_reason === 'max_tokens'`: returns `{ type: 'message', text: 'Response was cut off — try a shorter request.', error: true }` — never returns `tool_use`
    - `stop_reason` is any other unknown value: returns `{ type: 'message', text: 'Coach returned an unexpected response.', error: true }`
    - `tool_use` content block is missing `id` (toolUseId) or `input` fields: returns `{ type: 'message', text: 'Coach returned a malformed action — please try again.', error: true }` — never returns a `tool_use` object with undefined fields
  - [ ] `conversationHistory` is hard-capped at the last 20 messages; when cap is exceeded, oldest messages are trimmed first before the next API call (Decision 2)
  - [ ] `sendToolResult(conversationHistory, toolUseId, result)` exported from `callCoach.ts`; appends `tool_result` block, applies the 20-message trim, and calls the API again; returns the same discriminated union as `callCoachWithTools`; the 8-call counter is threaded as an argument through the recursive chain (not a module-level mutable)
  - [ ] `callCoachWithTools` accepts a `tools: Tool[]` param
  - [ ] Hard cap: 8 API calls per user message (shared across initial call + all `sendToolResult` legs); if reached, returns `{ type: 'message', text: 'The Coach reached its action limit for this turn. Start a new message to continue.' }` — never returns `{ type: 'tool_use' }` at the cap (#4)
  - [ ] Per-call timeout: 30 seconds per API leg (matching existing `callCoach`); timeout returns `{ type: 'message', text: 'Request timed out — please try again.', error: true }`
- Complexity: M
- Dependencies: none (prior Coach stories must be complete)

---

### STORY-054: Define OKR and MIT tool schemas in src/coach/tools.ts

- Type: Technical Story
- Statement: As an engineer, I want all Coach tool definitions in a single file as the source of truth.
- Acceptance Criteria:
  - [ ] `src/coach/tools.ts` created
  - [ ] `OKR_TOOLS` (named export): 9 tools covering all three OKR levels — Annual Goal, Quarterly Objective, Monthly KR — with create/edit/delete per level (Decision 1)
  - [ ] `MIT_TOOLS` (named export): 2 tools — `edit_mit`, `delete_mit`
  - [ ] Each tool: `name`, `description`, `input_schema` conforming to Anthropic tool schema format
  - [ ] **Annual Goal tools:**
    - `create_annual_goal` schema: `{ text: string, dimensionId: DimensionId }`
    - `edit_annual_goal` schema: `{ annualOKRId: string, text?: string, dimensionId?: DimensionId }`
    - `delete_annual_goal` schema: `{ annualOKRId: string }` — cascades to all children
  - [ ] **Quarterly Objective tools:**
    - `create_quarterly_objective` schema: `{ annualOKRId: string, text: string, quarter: string (enum: "Q1"|"Q2"|"Q3"|"Q4"), year: number }`
    - `edit_quarterly_objective` schema: `{ quarterlyObjectiveId: string, text?: string, quarter?: string, year?: number }`
    - `delete_quarterly_objective` schema: `{ quarterlyObjectiveId: string }` — cascades to all children
  - [ ] **Monthly KR tools:**
    - `create_monthly_kr` schema: `{ quarterlyObjectiveId: string, text: string, month: number (min:1, max:12), year: number }`
    - `edit_monthly_kr` schema: `{ monthlyKRId: string, text?: string, month?: number, year?: number }`
    - `delete_monthly_kr` schema: `{ monthlyKRId: string }` — cascades to child weekly initiatives
  - [ ] **MIT tools:**
    - `edit_mit` schema: `{ mitId: string, text?: string, initiativeId?: string | null }` — `initiativeId` uses `type: ["string", "null"]` to allow explicit null
    - `delete_mit` schema: `{ mitId: string }`
  - [ ] `quarter` in create/edit schemas is constrained to enum `["Q1","Q2","Q3","Q4"]`
  - [ ] `month` in create/edit schemas has `minimum: 1, maximum: 12`
  - [ ] Plain-English `description` on each tool explaining when to use it
  - [ ] No runtime side effects — exports only
- Complexity: S
- Dependencies: STORY-053

---

### STORY-055: ToolProposalCard component — display and confirm tool actions

- Type: Technical Story
- Statement: As an engineer, I want a `ToolProposalCard` component that renders a proposed tool action with a human-readable summary, Confirm, and Cancel buttons.
- Acceptance Criteria:
  - [ ] Component at `src/components/ToolProposalCard.tsx`
  - [ ] Props: `toolName: string`, `toolInput: unknown`, `isDestructive: boolean`, `onConfirm: () => void`, `onCancel: () => void`
  - [ ] Renders human-readable summary from `toolName` + `toolInput` (e.g., "Create objective: 'Improve fitness' in Health dimension")
  - [ ] Summaries implemented for all 11 tools (9 OKR + 2 MIT) (Decision 1)
  - [ ] `isDestructive: false` → Confirm button amber accent styling; clicking Confirm immediately disables both Confirm and Cancel and changes Confirm label to "Applying…" (#2)
  - [ ] `isDestructive: true` → first Confirm click does NOT call `onConfirm()` immediately; instead the card renders an inline second-step prompt: "This will permanently delete [item name] and all its children. Confirm delete?" with a second red button and a Cancel link; the second red button calls `onConfirm()`; Cancel link calls `onCancel()` (#7)
  - [ ] On second-step Confirm click: both buttons immediately disabled, label changes to "Deleting…" (#2, #7)
  - [ ] The human-readable summary is derived from `toolInput` fields (e.g. `title`, `text`) so the second-step message can name the item being deleted
  - [ ] Visually distinct from existing `ProposalCard` but uses same dark design tokens
  - [ ] Does NOT import `applyOKRTool` or any state mutation logic — purely presentational
- Complexity: M
- Dependencies: STORY-054

---

## EPIC-017: Coach OKR+MIT Tools

**User Value:** Users can ask the Coach to restructure OKRs or modify MITs via natural language, review each proposed change as a discrete card, and apply or reject individually.

**Dependencies:** STORY-053, STORY-054, STORY-055

---

### STORY-056: Wire OKR tools into Coach tab send flow

- Type: Technical Story
- Statement: As an engineer, I want the Coach tab send handler to pass `OKR_TOOLS` to `callCoach` and render a `ToolProposalCard` when the result is `type: 'tool_use'`.
- Acceptance Criteria:
  - [ ] `handleSend` calls `callCoachWithTools` (not `callCoach`) and passes `[...OKR_TOOLS, ...MIT_TOOLS]`; `handleSuggestMITs` and `handleWeeklyReview` continue to call the original `callCoach` (#9)
  - [ ] `type: 'tool_use'` result → `ToolProposalCard` appended to conversation (not a plain text bubble)
  - [ ] `isDestructive: true` for `delete_annual_goal`, `delete_quarterly_objective`, `delete_monthly_kr`, and `delete_mit`; `false` for all create/edit tools (Decision 1)
  - [ ] `conversationHistory` and `toolUseId` from the tool_use result stored in React component state (ephemeral — lost on tab switch); not persisted to AppState (#6)
  - [ ] While `hasPendingToolCard` is `true`: text input, "Ask Coach" send button, "Suggest MITs" and "Weekly Review" action buttons are all disabled; sublabel "Waiting for your decision on the suggested action above" appears below the input area (#1)
  - [ ] CoachTab state gains `hasPendingToolCard: boolean` (initially `false`); set to `true` when a ToolProposalCard is appended; cleared to `false` on Confirm or Cancel (#1)
  - [ ] While `hasPendingToolCard` is `true`, a warning note "Switching tabs will end this conversation." is visible in the coach thread (#6)
  - [ ] Loading/spinner state correctly shown and cleared for both `message` and `tool_use` results
  - [ ] After Confirm: ToolProposalCard entry in `messages[]` is replaced with a plain summary bubble (e.g. "Created objective: Improve fitness.") (#10)
  - [ ] After Cancel: ToolProposalCard entry in `messages[]` is replaced with a muted "Action cancelled." bubble (#10)
  - [ ] Error handling path for `callCoachWithTools` unchanged (no regressions)
- Complexity: M
- Dependencies: STORY-053, STORY-054, STORY-055

---

### STORY-057: Implement applyOKRTool pure function

- Type: Technical Story
- Statement: As an engineer, I want a pure `applyOKRTool(appState, toolName, toolInput)` function that returns a new `AppState` with the requested OKR mutation applied.
- Acceptance Criteria:
  - [ ] `src/coach/applyOKRTool.ts` created, exports `applyOKRTool` as named export
  - [ ] Signature: `applyOKRTool(state: AppState, toolName: string, toolInput: unknown): AppState`
  - [ ] Handles all 9 OKR tools (Decision 1); `toolInput` is cast from `unknown` — extra unrecognized fields are ignored, never throw
  - [ ] Before implementing, cascade delete helpers are extracted from `PlanTab.tsx` into `src/utils/okrMutations.ts`; both files import from there — no duplicated cascade logic
  - [ ] **Annual Goal handlers:**
    - `create_annual_goal`: appends new `AnnualOKR` with UUID, `text`, `dimensionId`
    - `edit_annual_goal`: finds by `annualOKRId`, applies `text`/`dimensionId` changes; silent no-op if ID not found
    - `delete_annual_goal`: removes `AnnualOKR` by ID and cascades — removes all child `quarterlyObjectives`, then all `monthlyKRs` whose `quarterlyObjectiveId` matched, then all `weeklyInitiatives` whose `monthlyKRId` matched, then sets `initiativeId: null` on any `dailyMITs` linked to those initiatives
  - [ ] **Quarterly Objective handlers:**
    - `create_quarterly_objective`: appends new `QuarterlyObjective` with UUID, `annualOKRId`, `text`, `quarter`, `year`; silent no-op if `annualOKRId` not found
    - `edit_quarterly_objective`: finds by `quarterlyObjectiveId`, applies `text`/`quarter`/`year` changes; silent no-op if not found
    - `delete_quarterly_objective`: removes `QuarterlyObjective` by ID and cascades to child `monthlyKRs`, `weeklyInitiatives`, and `dailyMITs.initiativeId` (same cascade pattern as `delete_annual_goal` but scoped to one QO)
  - [ ] **Monthly KR handlers:**
    - `create_monthly_kr`: appends new `MonthlyKeyResult` with UUID, `quarterlyObjectiveId`, `text`, `month`, `year`; silent no-op if `quarterlyObjectiveId` not found
    - `edit_monthly_kr`: finds by `monthlyKRId`, applies `text`/`month`/`year` changes; silent no-op if not found
    - `delete_monthly_kr`: removes `MonthlyKeyResult` by ID and cascades to child `weeklyInitiatives` and `dailyMITs.initiativeId`
  - [ ] Pure function: never mutates input `state`; always returns a new object; unit test freezes input with `Object.freeze()` to verify purity
  - [ ] Unrecognized `toolName`: returns `state` unchanged
  - [ ] Post-cascade invariant: returned state has no dangling references — no `QuarterlyObjective.annualOKRId`, `MonthlyKeyResult.quarterlyObjectiveId`, `WeeklyInitiative.monthlyKRId`, or `DailyMIT.initiativeId` pointing to a deleted entity
  - [ ] Unit tests required:
    - `create_annual_goal` happy path (verifies new AnnualOKR appended)
    - `delete_annual_goal` full cascade (verifies all QOs, KRs, initiatives removed; linked MIT `initiativeId` set to null)
    - `edit_quarterly_objective` unknown ID (verifies no-op, state unchanged)
    - `delete_monthly_kr` cascade (verifies linked initiatives removed, MIT initiativeId nulled)
- Complexity: M
- Dependencies: STORY-054

---

### STORY-058: Wire MIT tools into Coach tab send flow

- Type: Technical Story
- Statement: As an engineer, I want the Coach tab to pass `MIT_TOOLS` alongside `OKR_TOOLS` and handle `edit_mit` and `delete_mit` tool results.
- Acceptance Criteria:
  - [ ] Coach tab passes `[...OKR_TOOLS, ...MIT_TOOLS]` to `callCoach`
  - [ ] `edit_mit` result → `ToolProposalCard` with `isDestructive: false`
  - [ ] `delete_mit` result → `ToolProposalCard` with `isDestructive: true`
  - [ ] Confirming `edit_mit`: validate `mit.date === todayISO()` before applying; if MIT is from a past date, action is silent no-op and an error bubble is appended: "The Coach can only modify today's MITs." (#23)
  - [ ] Confirming `edit_mit` (today's MIT): find MIT by `mitId`, apply `text` or `initiativeId` changes, persist
  - [ ] Confirming `delete_mit`: validate `mit.date === todayISO()` before applying; if past date, same silent no-op + error bubble (#23)
  - [ ] Confirming `delete_mit` (today's MIT): remove MIT by `mitId` from `appState.dailyMITs`, persist
  - [ ] MIT mutation logic is in Coach tab confirm handler (not in `applyOKRTool`)
  - [ ] If `mitId` not found in state: confirm is silent no-op, no error thrown
- Complexity: M
- Dependencies: STORY-056, STORY-057

---

### STORY-059: Confirm handler — apply OKR tool action and continue conversation

- Type: Technical Story
- Statement: As an engineer, I want the ToolProposalCard Confirm button to apply the mutation, persist it, call `sendToolResult`, and append the model's follow-up response to the conversation.
- Acceptance Criteria:
  - [ ] Confirm on OKR card: calls `applyOKRTool`, sets new state, persists to localStorage
  - [ ] After apply: calls `sendToolResult(conversationHistory, toolUseId, { success: true })`; loading indicator shown while in flight
  - [ ] `sendToolResult` result handled by same branching logic as `callCoachWithTools`: `message` → text bubble; `tool_use` → another `ToolProposalCard`
  - [ ] If `sendToolResult` returns an API error (401, 429, network failure): append a styled error bubble with the reason (e.g. "API error — check your key in Setup."); reset the ToolProposalCard to a cancelled visual state; set `hasPendingToolCard: false` (#5)
  - [ ] Cancel: calls `onCancel`; replaces ToolProposalCard in `messages[]` with "Action cancelled." bubble; calls `sendToolResult(conversationHistory, toolUseId, { success: false, reason: 'User cancelled' })`; appends model's follow-up to conversation (#3, #10)
  - [ ] `hasPendingToolCard` set to `false` after Confirm or Cancel, regardless of whether `sendToolResult` succeeds or fails (#1)
  - [ ] `toolUseId` sourced from the `tool_use` result stored in component state (STORY-056); threaded correctly to `sendToolResult`
- Complexity: M
- Dependencies: STORY-056, STORY-057, STORY-058

---

### STORY-060: Update Coach system prompt to describe available tools

- Type: Technical Story
- Statement: As an engineer, I want the Coach system prompt to include a "Tools" section so the model uses tools appropriately.
- Acceptance Criteria:
  - [ ] System prompt includes "Tools" section after existing framework descriptions
  - [ ] Lists all 11 tools by name with one-sentence purpose: 9 OKR tools (`create_annual_goal`, `edit_annual_goal`, `delete_annual_goal`, `create_quarterly_objective`, `edit_quarterly_objective`, `delete_quarterly_objective`, `create_monthly_kr`, `edit_monthly_kr`, `delete_monthly_kr`) and 2 MIT tools (`edit_mit`, `delete_mit`) (Decision 1)
  - [ ] Instructs model to: (a) only call a tool when user explicitly requests a data change, (b) explain what it is about to do before calling, (c) call at most one tool per turn, (d) not call delete tools unless user explicitly says "delete" or "remove"
  - [ ] Instructs model to briefly confirm what was done/not done after tool result arrives
  - [ ] Added text ≤ 400 tokens (≤ 1600 characters at 4:1 ratio)
  - [ ] Existing prompt sections (role, frameworks, context injection) not altered; `SYSTEM_PROMPT` string before the Tools section is byte-for-byte identical to pre-STORY-060 version
- Complexity: S
- Dependencies: STORY-053, STORY-054

---

### STORY-061: Inject context IDs into Coach context block for tool targeting

- Type: Technical Story
- Statement: As an engineer, I want the Coach context to include stable IDs alongside names for objectives, key results, and today's MITs so the model can supply valid IDs in tool inputs.
- Acceptance Criteria:
  - [ ] ID injection is hard-trimmed to: current quarter's Quarterly Objectives + current month's Monthly KRs + today's DailyMITs; older data is excluded from the ID block to prevent context bloat (#8)
  - [ ] Context block includes for each current-quarter objective: `id`, `title`, `dimensionId`, `quarter`
  - [ ] Context block includes for each current-month key result: `id`, `title`, `month`, `objectiveId`
  - [ ] Context block includes for each MIT in today's `dailyMITs`: `id`, `text`, `done`, `initiativeId`
  - [ ] IDs presented in machine-readable format (JSON or clearly labelled inline field)
  - [ ] 30-day MIT log preserved for context but only `id` and `text` per MIT entry (no subtask arrays) to keep size manageable
  - [ ] If no objectives exist: objectives section is `[]` (not omitted)
  - [ ] If total context block exceeds 2000 tokens after ID injection, a `console.warn` is emitted and the ID block is trimmed to today's MITs only (#8)
- Complexity: S
- Dependencies: STORY-059

---

## EPIC-018: Deathbed Mapping UI + CSS

**User Value:** Users explicitly assign deathbed goals to dimensions in Setup; Review tab reflects those assignments; button-group styles unified under `.btn-row`.

**Dependencies:** STORY-045, STORY-042

---

### STORY-062: Deathbed-to-dimension mapping picker in Setup tab

- Type: User Story
- Statement: As a user, I want to assign each deathbed goal to a life dimension in Setup so the Review tab can compute meaningful alignment scores.
- Acceptance Criteria:
  - [ ] Setup tab has "Dimension Mapping" section below Deathbed Goals input area
  - [ ] For each non-empty goal slot: row showing goal text (read-only, truncated to ~80 chars with `…`) + dimension `<select>` dropdown; full goal text available on hover via `title` attribute (#19)
  - [ ] Empty goal slots: no row rendered
  - [ ] `<select>` pre-populated from `appState.deathbedGoalMappings[i]`; defaults to "No dimension" when `deathbedGoalMappings[i]` is `null` (#16)
  - [ ] First option: "No dimension" (value `null`)
  - [ ] Changes persist immediately on `onChange` (no Save button)
  - [ ] Section only renders if at least one non-empty goal exists
  - [ ] A section-level guidance note renders above the goal rows: "Map each goal to a life dimension so the Review tab can track alignment." (#16)
  - [ ] Styling: dark select bg, amber label, consistent row spacing
  - [ ] The SetupTab welcome banner (when shown) is updated to include a third step: "Map each goal to a life dimension in the Dimension Mapping section below." (#24)
- Complexity: M
- Dependencies: STORY-045

---

### STORY-063: Update Review tab deathbed alignment to use explicit mappings

- Type: User Story
- Statement: As a user, I want the Review tab's deathbed alignment section to use my explicitly chosen dimension mappings instead of positional defaults.
- Acceptance Criteria:
  - [ ] Alignment logic reads `appState.deathbedGoalMappings[i]` (not positional index)
  - [ ] `deathbedGoalMappings[i] === null`: goal row shows "Unassigned" in muted text in the Dimension column; no per-row "Assign in Setup" prompt (#18)
  - [ ] A single section-level note with a "Go to Setup →" button renders below the table when at least one goal has a `null` mapping; it is shown once, not repeated per row (#18)
  - [ ] `deathbedGoalMappings[i]` is valid `DimensionId`: alignment computed from MITs+OKRs for that dimension (same formula as v2)
  - [ ] Positional fallback from STORY-042 removed; explicit mapping is sole source of truth
  - [ ] No visual regression in Review tab alignment table layout
- Complexity: M
- Dependencies: STORY-062

---

### STORY-064: Add .btn-row CSS class and apply to PlanTab

- Type: Technical Story
- Statement: As an engineer, I want a shared `.btn-row` CSS class replacing scattered inline button-group styles in PlanTab.
- Acceptance Criteria:
  - [ ] `.btn-row` defined in global stylesheet: `display: flex; align-items: center; gap: 8px; flex-wrap: wrap;`
  - [ ] All button-group containers in `PlanTab` using equivalent inline styles converted to `className="btn-row"`
  - [ ] No inline `style` props remain on button-group wrapper elements in `PlanTab`
  - [ ] Visual appearance unchanged after refactor
  - [ ] `.btn-row` does not include `margin`, `padding`, or `color` — layout only
- Complexity: S
- Dependencies: STORY-045

---

### STORY-065: Apply .btn-row to HabitsTab and ReviewTab

- Type: Technical Story
- Statement: As an engineer, I want `.btn-row` applied to HabitsTab and ReviewTab button-group containers.
- Acceptance Criteria:
  - [ ] All equivalent inline flex button-group styles in `HabitsTab` converted to `className="btn-row"`
  - [ ] All equivalent inline flex button-group styles in `ReviewTab` converted to `className="btn-row"`
  - [ ] No inline `style` props remain on button-group wrapper elements in either tab
  - [ ] Visual appearance unchanged
  - [ ] Any intentional exception to `.btn-row` defaults has an inline comment explaining why
  - [ ] `.btn-row` definition not duplicated; same class as STORY-064
- Complexity: S
- Dependencies: STORY-064

---

## Recommended Execution Order

| Wave | Stories | Notes |
|------|---------|-------|
| 1 | STORY-044, STORY-053 | No v3 predecessors; run in parallel |
| 2 | STORY-045, STORY-054, STORY-046, STORY-049 | All parallel; share migration function |
| 3 | STORY-047, STORY-050, STORY-052, STORY-055, STORY-057, STORY-062, STORY-064 | 7 stories available simultaneously |
| 4 | STORY-048, STORY-051, STORY-056, STORY-058, STORY-063, STORY-065 | 6 stories in parallel |
| 5 | STORY-059, STORY-060 | Parallel |
| 6 | STORY-061 | Final story on critical path |

---

## Risk & Dependency Summary

- **R1 (HIGH):** Schema migration correctness — STORY-044+045 share `v2_to_v3`. Data loss possible if misimplemented. Unit tests mandatory.
- **R2 (MEDIUM):** callCoach multi-turn cost — 8-call cap is safety ceiling. System prompt (STORY-060) instructs model to call max one tool per turn.
- **R3 (MEDIUM):** toolUseId threading — must be correctly extracted from API response and passed through `sendToolResult`. Log raw API response block in dev mode.
- **R4 (LOW):** ProposalCard vs ToolProposalCard feature creep — keep them separate. Different contracts.
- **R5 (LOW):** InitiativeDropdown stale reference — test scenario where initiative is deleted while MIT edit form is open.
- **R6 (LOW):** deathbedGoalMappings null handling in Review tab — explicit branch coverage required for null-mapped goals.
