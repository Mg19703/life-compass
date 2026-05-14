# Life Compass — Epics & Stories

**7 Epics | 29 Stories | All MVP scope**
**Stack:** React artifact · Claude API · localStorage · Claude Code Desktop App
**Last updated:** 2026-05-13 (post test-architect audit)

---

## Epic Overview & Dependency Map

```
EPIC-001 Data Model & Storage Layer
    └── blocks all other epics

EPIC-007 Shell / Navigation / Design System
    └── depends_on: EPIC-001
    └── blocks EPIC-002, 003, 004, 005, 006

EPIC-002 Setup Tab
    └── depends_on: EPIC-001, EPIC-007

EPIC-003 Plan Tab
    └── depends_on: EPIC-001, EPIC-007, EPIC-002

EPIC-004 Today Tab
    └── depends_on: EPIC-001, EPIC-007, EPIC-003

EPIC-005 Coach Tab
    └── depends_on: EPIC-001, EPIC-007, EPIC-002, EPIC-003, EPIC-004

EPIC-006 Review Tab
    └── depends_on: EPIC-001, EPIC-007, EPIC-003, EPIC-004
```

---

## EPIC-001: Data Model & Storage Layer

**User value:** All application state is reliably persisted across sessions and can be read and written by every tab without data loss or corruption.
**Dependencies:** None — this is the foundation.
**Deferred:** Multi-device sync, cloud backup, export to JSON/CSV.

---

### STORY-001: Define core data schema and TypeScript types

As a developer, I want a canonical TypeScript schema for every data entity so that all components read and write state in a consistent shape.

**Acceptance criteria:**
- [ ] Types defined for: `UserProfile`, `DeathbedGoal` (7 max), `LifeDimension` (6 fixed), `AnnualOKR`, `QuarterlyObjective`, `MonthlyKeyResult`, `WeeklyInitiative`, `DailyMIT`, `DailyLog`, `AppState`
- [ ] `DailyMIT` includes: `id: string`, `date: string` (ISO YYYY-MM-DD), `text: string`, `status: 'complete' | 'carried' | 'dropped' | 'pending'`, `carriedOverFrom: string | null`, `carriedForwardTo: string | null`, `initiativeId: string | null`
- [ ] `DailyMIT` does NOT include a `completed: boolean` field — `status` is the sole completion signal
- [ ] `DailyLog` includes: `date: string` (ISO YYYY-MM-DD), `mood: 1 | 2 | 3 | 4 | 5`, `note: string`, `exercise: { type: string; durationMinutes: number } | null`
- [ ] `WeeklyInitiative` includes: `id: string`, `monthlyKRId: string`, `text: string`, `weekStart: string` (ISO YYYY-MM-DD, always a Monday), `completed: boolean`
- [ ] `AppState` shape is explicitly defined with all top-level keys:
  ```
  AppState {
    schemaVersion: number
    profile: UserProfile | null
    deathbedGoals: string[]          // always length 7; empty slots are ''
    annualOKRs: AnnualOKR[]
    quarterlyObjectives: QuarterlyObjective[]
    monthlyKRs: MonthlyKeyResult[]
    weeklyInitiatives: WeeklyInitiative[]
    dailyMITs: DailyMIT[]            // flat array, queried by date field
    dailyLogs: Record<string, DailyLog>  // keyed by ISO date string
    apiKey: string | null
  }
  ```
- [ ] All collections use flat arrays (not nested maps), queried by id/date fields at read time
- [ ] All types exported from a single `src/types.ts` file
- [ ] No runtime library required — pure TypeScript interfaces

**Size:** S | **Dependencies:** None

---

### STORY-002: Implement localStorage read/write service

As a developer, I want a storage service module that serializes and deserializes `AppState` to `localStorage` so that no component touches `localStorage` directly.

**Acceptance criteria:**
- [ ] `storage.ts` exports `loadState(): AppState`, `saveState(state: AppState): void`, `clearState(): void`
- [ ] Uses `window.localStorage` (not `window.storage`) — this is a standalone app built with Claude Code
- [ ] `loadState` when key is absent (storage returns `null`) returns the default `AppState` — distinct from corrupt data path
- [ ] `loadState` when key exists but JSON parse fails logs `console.warn` and returns the default `AppState` — does not throw
- [ ] `saveState` serializes state to JSON and writes to a single localStorage key (`life-compass-v1`)
- [ ] `saveState` catches `QuotaExceededError`: logs `console.warn` with estimated payload size and returns without throwing — write failures degrade gracefully
- [ ] `clearState` is idempotent — calling it when the key does not exist is a no-op; does not throw
- [ ] Storage key exported as a named constant `STORAGE_KEY = 'life-compass-v1'`
- [ ] All three functions accept an optional `storage?: Storage` parameter defaulting to `window.localStorage` for test injection

**Size:** S | **Dependencies:** STORY-001

---

### STORY-003: Implement state initialization and migration hook

As a developer, I want a React hook (`useAppState`) that loads state on mount, exposes it, and saves it on every mutation so that components get a single, reactive interface to persisted state.

**Acceptance criteria:**
- [ ] `useAppState()` hook returns `{ state, updateState }` where `updateState(partial: Partial<AppState>)` merges and persists per the contract below
- [ ] State is loaded from storage exactly once on mount; a `useRef` guard prevents re-loading even under React Strict Mode double-invocation
- [ ] `saveState(newState)` is called synchronously inside `updateState` before `setState` is called — no async gap, no dependency on render timing
- [ ] `updateState` uses the functional setState form (`setState(prev => merge(prev, partial))`) so merges always apply against latest state, never a stale closure; `saveState` receives the post-merge value
- [ ] Hook includes a `useRef` guard so `loadState` is called at most once per hook instance lifetime — survives React Strict Mode double-invocation
- [ ] `schemaVersion` is a required field in `AppState`; if the loaded version does not match the current version, missing required fields are filled with their default values (empty arrays, null scalars, empty strings) before state is set — the app must never reach an unrenderable state due to schema mismatch
- [ ] `saveState` is not exported from the hook module — consumers can only mutate state via `updateState`
- [ ] Verified: refreshing the artifact reloads state correctly

**Merge behavior contract (all cases must have a unit test):**

| Call | Before | After | Rule |
|---|---|---|---|
| `updateState({ schemaVersion: 2 })` | `{ schemaVersion: 1, profile: { name: 'Moe', role: 'PM' } }` | `{ schemaVersion: 2, profile: { name: 'Moe', role: 'PM' } }` | Scalar top-level key replaced; sibling keys untouched |
| `updateState({ profile: { name: 'New' } })` | `{ profile: { name: 'Moe', role: 'PM', bio: 'hi' } }` | `{ profile: { name: 'New', role: 'PM', bio: 'hi' } }` | Object top-level key shallow-merged; sibling scalar fields within the object preserved |
| `updateState({ deathbedGoals: ['g1'] })` | `{ deathbedGoals: ['a', 'b', 'c'] }` | `{ deathbedGoals: ['g1'] }` | Array top-level key replaced entirely — never concatenated |
| `updateState({ profile: null })` | `{ profile: { name: 'Moe' } }` | `{ profile: null }` | Explicit null replaces the value — intentional reset is allowed |
| `updateState({ profile: { name: 'X' } })` called twice in same tick | `{ profile: { name: 'Moe', role: 'PM' } }` | `{ profile: { name: 'X', role: 'PM' } }` (second call sees first call's result) | Functional setState ensures second merge sees post-first-merge state, not original |

**Size:** M | **Dependencies:** STORY-001, STORY-002

---

## EPIC-002: Setup Tab

**User value:** The user can configure their identity, articulate their seven deathbed goals, and provide their Claude API key so the rest of the product has the foundational context it needs.
**Dependencies:** EPIC-001, EPIC-007
**Deferred:** Guided onboarding wizard, deathbed-to-annual OKR linkage visualization.

---

### STORY-004: Setup tab — user profile form

As Moe, I want to enter my name, current role, and a brief bio so that the Coach has identity context when generating advice.

**Acceptance criteria:**
- [ ] Form fields: Name (text, required), Current Role (text, required), Bio (textarea, 500 char max, optional)
- [ ] "Save Profile" button writes to `AppState.profile` via `updateState`
- [ ] Saved values reload correctly on next session
- [ ] Validation: Name and Role fields show inline error if blank on submit
- [ ] Character counter displayed below Bio field
- [ ] Styled: slate background, amber save button

**Size:** S | **Dependencies:** STORY-003, STORY-026

---

### STORY-005: Setup tab — deathbed goals editor

As Moe, I want to write and edit my seven deathbed goals so that everything I plan is anchored to what matters most at end of life.

**Acceptance criteria:**
- [ ] Exactly 7 goal slots rendered (labeled Goal 1 through Goal 7)
- [ ] Each slot is a textarea (300 char max) with a character counter
- [ ] "Save Goals" button persists all 7 to `AppState.deathbedGoals`
- [ ] Partial saves allowed (not all 7 must be filled to save)
- [ ] Goals reload on session restore
- [ ] Empty goals display placeholder: "What would you regret not doing or being?"

**Size:** S | **Dependencies:** STORY-003, STORY-026

---

### STORY-006: Setup tab — Claude API key configuration

As Moe, I want to enter and save my Claude API key in Setup so that the Coach tab can make API calls without hardcoding credentials.

**Acceptance criteria:**
- [ ] Input field of type `password` (masked) for the API key
- [ ] "Save Key" button stores the key to `AppState.apiKey` in localStorage
- [ ] After save, masked confirmation shown: "Key saved: sk-ant-...xxxx"
- [ ] "Clear Key" button removes the key with a confirmation prompt
- [ ] If no key present, Coach tab shows: "Add your Claude API key in Setup to enable coaching."
- [ ] Key is never logged to console

**Size:** S | **Dependencies:** STORY-003, STORY-026

---

### STORY-007: Setup tab — life dimensions display

As Moe, I want to see the six fixed life dimensions listed on the Setup tab so that I understand the structure before building my OKRs.

**Acceptance criteria:**
- [ ] Six dimensions rendered in a table: Inner Life, Relationships, Health, Financial Security, Service, Learning & Growth
- [ ] Each row shows: dimension name, weight (%), one-line description (hardcoded), count of active Annual OKRs
- [ ] Dimensions are read-only — no add/delete/rename; rows are not clickable and have no navigation action
- [ ] Amber accent on dimension names

**Size:** S | **Dependencies:** STORY-003, STORY-026

---

### STORY-008: Setup tab — layout and section assembly

As a developer, I want the Setup tab to assemble its four sections in a scrollable single-column layout so that the tab is complete and navigable.

**Acceptance criteria:**
- [ ] Sections in order: Profile, Deathbed Goals, API Key, Life Dimensions
- [ ] Each section has a titled amber divider
- [ ] On first load (empty state), welcome banner shown: "Welcome — start by filling in your profile and deathbed goals."
- [ ] Welcome banner dismissed once Profile and at least one Goal are saved
- [ ] Tab fully scrollable; no horizontal overflow

**Size:** S | **Dependencies:** STORY-004, STORY-005, STORY-006, STORY-007

---

## EPIC-003: Plan Tab

**User value:** The user can build and manage the full OKR hierarchy — from Annual OKRs down to Weekly Initiatives — in one structured, navigable view.
**Dependencies:** EPIC-001, EPIC-007, EPIC-002
**Deferred:** Drag-and-drop reordering, OKR archiving, bulk import from CSV.

---

### STORY-009: Plan tab — Annual OKR management

As Moe, I want to create, edit, and delete Annual OKRs for each life dimension so that I have a year-level intention for each area of life.

**Acceptance criteria:**
- [ ] Inline add form: Dimension (dropdown, 6 options), Objective text (required), Year (defaults to current year)
- [ ] Table rows: Dimension | Objective | Year | Actions (Edit / Delete)
- [ ] Edit: inline editing confirmed with checkmark button
- [ ] Delete: before executing, show a confirmation modal listing everything that will be removed (all child Quarterly Objectives, Monthly KRs, and Weekly Initiatives by count). User must click "Delete anyway" to confirm — Cancel aborts with no changes.
- [ ] Cascade delete executes only after explicit confirmation
- [ ] OKRs grouped by life dimension with sub-header
- [ ] Empty state per dimension: "No annual OKR yet — add one above."

**Size:** M | **Dependencies:** STORY-003, STORY-026

---

### STORY-010: Plan tab — Quarterly Objectives management

As Moe, I want to add Quarterly Objectives under each Annual OKR so that I can break the year into 90-day chunks.

**Acceptance criteria:**
- [ ] Each Annual OKR row is expandable; shows its Quarterly Objectives
- [ ] Add form per OKR: Objective text (required), Quarter (Q1–Q4), Year (auto-filled)
- [ ] Table: Quarter | Objective | Actions (Edit / Delete)
- [ ] Edit: inline editing of Objective text, confirmed with checkmark button, cancelled with X — same pattern as STORY-009
- [ ] Delete: before executing, show a confirmation modal listing all child Monthly KRs and Weekly Initiatives that will be removed (by count). User must confirm explicitly — Cancel aborts.
- [ ] Cascade delete executes only after explicit confirmation
- [ ] Collapsed by default; expand/collapse via chevron
- [ ] Empty state when expanded with no children: "No quarterly objectives yet — add one above."

**Size:** M | **Dependencies:** STORY-009

---

### STORY-011: Plan tab — Monthly Key Results management

As Moe, I want to define Monthly Key Results under each Quarterly Objective so that I have measurable monthly targets.

**Acceptance criteria:**
- [ ] Each Quarterly Objective row is expandable; shows its Monthly KRs
- [ ] Add form: KR text (required), Month (Jan–Dec dropdown), Year (auto-filled)
- [ ] Table: Month | Key Result | Progress % (completed initiatives / total initiatives) | Actions (Edit / Delete)
- [ ] Edit: inline editing of KR text, confirmed with checkmark button, cancelled with X — same pattern as STORY-009
- [ ] Progress shown as numeric percentage (not a bar)
- [ ] Delete: before executing, show a confirmation modal listing all child Weekly Initiatives that will be removed (by count). User must confirm explicitly — Cancel aborts.
- [ ] Cascade delete executes only after explicit confirmation
- [ ] Empty state when expanded with no children: "No key results yet — add one above."

**Size:** M | **Dependencies:** STORY-010

---

### STORY-012: Plan tab — Weekly Initiatives management

As Moe, I want to define up to four Weekly Initiatives under each Monthly KR so that I have a concrete weekly action plan.

**Acceptance criteria:**
- [ ] Each Monthly KR row is expandable; shows its Weekly Initiatives
- [ ] Add form: Initiative text (required), week start date (date picker, auto-snapped to Monday)
- [ ] Adding a 5th initiative to a KR in the same week blocked: "Max 4 initiatives per KR per week"
- [ ] Table: Week of | Initiative | Completed (checkbox) | Actions (Edit / Delete)
- [ ] Completing an initiative updates `WeeklyInitiative.completed` via `updateState`
- [ ] Completed initiatives show with strikethrough text
- [ ] Single-item delete (no cascade); no confirmation modal required
- [ ] Empty state when expanded with no children: "No initiatives this week — add one above."

**Size:** M | **Dependencies:** STORY-011

---

### STORY-013: Plan tab — layout, filtering, and navigation

As a developer, I want the Plan tab to support dimension-level filtering and a coherent tree layout so that the user can focus on one area of life at a time.

**Acceptance criteria:**
- [ ] Filter bar: "All Dimensions" default + one chip per dimension (6)
- [ ] Active chip highlighted in amber
- [ ] Selecting a dimension hides non-matching Annual OKRs
- [ ] Dimension filter is local to Plan tab — no cross-tab state; Setup tab has no navigation action on dimensions
- [ ] Full tree renders without horizontal scroll at 1280px+
- [ ] Empty state (no OKRs at all): "Start by adding an Annual OKR for one of your life dimensions."

**Size:** S | **Dependencies:** STORY-009, STORY-010, STORY-011, STORY-012

---

## EPIC-004: Today Tab

**User value:** The user can set their three Most Important Tasks for today, log mood, exercise, and a reflection, and see carried-over incomplete tasks — all in one daily command center.
**Dependencies:** EPIC-001, EPIC-007, EPIC-003
**Deferred:** Calendar integration, push notifications, MIT drag-to-reorder.

---

### STORY-014: Today tab — Daily MIT management

As Moe, I want to set up to three MITs for today and mark them complete so that I end every day with clarity on what I actually accomplished.

**Acceptance criteria:**
- [ ] Three MIT slots for today's date (ISO date, no time)
- [ ] Each slot: text input (150 char max) + optional link to a Weekly Initiative (dropdown of active initiatives) + complete checkbox; if no Weekly Initiatives exist in Plan, the dropdown is disabled and shows "Add initiatives in Plan first"
- [ ] Adding a 4th MIT blocked: "Max 3 MITs per day" (carried-in MITs do not count toward today's limit — only MITs created today count)
- [ ] Checking the complete checkbox sets `DailyMIT.status = 'complete'`; strikethrough + 50% opacity on text; there is no separate `completed` boolean field
- [ ] Checking a checkbox immediately removes that MIT from the end-of-day resolution section (STORY-015) without a page reload
- [ ] MITs stored per date; switching days shows that day's MITs (today default)
- [ ] Amber checkboxes

**Size:** M | **Dependencies:** STORY-003, STORY-012, STORY-026

---

### STORY-015: Today tab — end-of-day MIT resolution + Zeigarnik surface

As Moe, I want to explicitly resolve each incomplete MIT at the end of the day — marking it Done, Carry Forward, or Drop — so that nothing falls through the cracks silently.

**Acceptance criteria:**

*End-of-day resolution prompt:*
- [ ] The resolution section is **not time-gated** — it appears whenever any MIT for the viewed date has status 'pending', at any time of day (Decision B)
- [ ] The section appears on **any date** — today or any historical date — that has ≥1 pending MIT; users can resolve past pending MITs at any time (Decision C)
- [ ] Section is hidden entirely when the viewed date has zero MITs; "All resolved." does not appear for zero-MIT dates
- [ ] Section title: "Resolve unfinished MITs"
- [ ] Each pending MIT listed with three action buttons: **Done** | **Carry Forward** | **Drop** — no default; user must choose explicitly
- [ ] **Done**: sets `status = 'complete'` on the current record
- [ ] **Carry Forward**: sets `status = 'carried'` and `carriedForwardTo = [viewed date + 1 day]` on the current record; creates a new `DailyMIT` for that next day with `status = 'pending'`, `carriedOverFrom = [viewed date]`, same text and `initiativeId`; carry forward is **always allowed** regardless of how many MITs the next day already has — the 3-MIT creation limit applies only when the user manually adds new MITs on that day (Decision D)
- [ ] **Drop**: sets `status = 'dropped'` on the current record
- [ ] Resolved MITs remain visible in the main MIT list for that date with their status indicator; they are not removed from the list
- [ ] Once all MITs for the viewed date are resolved (zero pending): section shows "All resolved." and collapses

*Carryover deduplication — explicit algorithm:*

The resolution section shows only MITs where `status = 'pending'`. Because **Carry Forward** immediately transitions the source MIT to `status = 'carried'`, earlier links in a carry chain are never 'pending' and therefore never surface in the resolution section again. No additional traversal or chain-following logic is needed.

```
// Pseudocode: MITs shown in resolution section for a given date
function getPendingMITs(allMITs: DailyMIT[], date: string): DailyMIT[] {
  return allMITs.filter(m => m.date === date && m.status === 'pending');
  // MIT-A (Day 1, status='carried') → excluded — already resolved
  // MIT-B (Day 2, status='carried') → excluded — already resolved
  // MIT-C (Day 3, status='pending') → included ← user resolves here
  // Unrelated MIT-D (Day 3, status='pending') → included independently
}
```

Status transitions are one-way in v1: once a MIT is resolved (non-pending), it does not re-enter the resolution prompt.

*Review tab integration:*
- [ ] MIT status ('complete', 'carried', 'dropped', 'pending') visible in STORY-022's Status column; color: complete = green, carried = amber, dropped = muted red, pending = gray

**Size:** M | **Dependencies:** STORY-014

---

### STORY-016: Today tab — daily log (mood + exercise + reflection)

As Moe, I want to log my mood (1–5), today's exercise, and a one-line reflection each day so that the Coach can reference my physical and emotional state alongside my task performance.

**Acceptance criteria:**
- [ ] Mood input: five clickable numbers/icons (1–5); selected value highlighted in amber
- [ ] Exercise field: two sub-inputs — Type (text, e.g. "run", "yoga", 50 char max) + Duration in minutes (number input, 0–300 range); field is optional (can be left blank)
- [ ] Reflection text: single textarea, 200 char max, with live character counter
- [ ] "Save Log" button writes `DailyLog` for today's date via `updateState`; entry includes mood, exercise (null if not filled), and note
- [ ] If a log already exists for today, form pre-fills and button reads "Update Log"
- [ ] Saved confirmation: "Logged." fades after 2 seconds
- [ ] Log indexed by ISO date string
- [ ] Exercise data exposed to Coach context payload (STORY-018) and Review tab (STORY-023)

**Size:** S | **Dependencies:** STORY-003, STORY-026

---

### STORY-017: Today tab — layout and date navigation

As a developer, I want the Today tab to display today's date prominently and allow backward navigation to previous days so that historical MITs and logs are accessible.

**Acceptance criteria:**
- [ ] Header: current date in "Tuesday, May 12, 2026" format
- [ ] Left/right chevrons navigate one day at a time (back up to 30 days, no future navigation)
- [ ] Active date drives all data queries on the tab
- [ ] "Today" button snaps back to current date
- [ ] Historical dates labeled "(Past)" in muted text
- [ ] Date navigation is local component state only — does not modify `AppState`
- [ ] First-run empty state: when today has no MITs and no log, MIT section shows "Start by adding up to 3 MITs for today."

**Size:** S | **Dependencies:** STORY-014, STORY-015, STORY-016

---

## EPIC-005: Coach Tab

**User value:** The user can have an AI coaching conversation that draws on their full life planning context and applies structured behavioral frameworks to give grounded, relevant advice.
**Dependencies:** EPIC-001, EPIC-007, EPIC-002, EPIC-003, EPIC-004
**Deferred:** Streaming responses, conversation history persistence across sessions, voice input.

---

### STORY-018: Coach tab — context payload builder

As a developer, I want a function that assembles the full coaching context from `AppState` into a structured string so that the Coach system prompt always reflects current reality.

**Acceptance criteria:**
- [ ] `buildCoachContext(state: AppState, now?: Date): string` exported from `coachContext.ts`; the optional `now` parameter defaults to `new Date()` and is used for all date-relative calculations ("current quarter", "current month", 30-day window) — this makes the function fully testable without mocking the system clock
- [ ] Output sections (each with a markdown heading): User Profile, Deathbed Goals (non-empty only), Life Dimensions + Annual OKRs, Current Quarter's Quarterly Objectives, Current Month's KRs + Weekly Initiatives, Last 30 days of DailyMITs (date, text, status), Last 30 days of DailyLogs (date, mood, exercise type + duration if present, note), Dimension Distribution (current week: each dimension's target weight %, actual completed-MIT %, and gap — same calculation as STORY-029); the 30-day window is `now - 29 days` through `now` inclusive
- [ ] Guard: if `AppState.profile` is null or `profile.name` is empty/whitespace-only, function returns the exported sentinel constant (see below) instead of assembling the payload; caller must compare against the constant before making an API call
- [ ] Sentinel is exported as a named constant: `export const COACH_SETUP_INCOMPLETE = "User has not yet completed Setup"` — callers import and compare against this constant, never a hardcoded string literal
- [ ] Empty or whitespace-only deathbed goals are omitted from the payload; the section heading still appears with only non-empty goals listed
- [ ] Output is deterministic given the same `AppState` and the same `now` value
- [ ] Function has no side effects and makes no API calls
- [ ] Output estimated under 8,000 tokens for a realistic 6-month dataset (not enforced at runtime; trim is always applied at 30 days before estimation)

**Size:** M | **Dependencies:** STORY-003

---

### STORY-019: Coach tab — system prompt with 7 frameworks

As a developer, I want a hardcoded system prompt that instructs the Coach to apply seven behavioral frameworks so that every coaching response is grounded in the EWMBA 258 curriculum.

**Acceptance criteria:**
- [ ] System prompt defined as a constant in `coachPrompt.ts`
- [ ] All 7 frameworks named and described: MIT prioritization, FOCUS model, Mental Contrasting (WOOP), Yerkes-Dodson optimal arousal, Type 1 vs Type 2 Decisions, MVOs, Anti-perfectionism / good-enough threshold
- [ ] Coach always anchors to current MITs and deathbed goals; surfaces named frameworks only when contextually relevant
- [ ] Tone instructions: data + action, no cheerleading, under 300 words unless depth requested
- [ ] Context placeholder `{{CONTEXT}}` replaced at call time with `buildCoachContext` output
- [ ] Instructs model to ask one clarifying question if user input is ambiguous
- [ ] Instructs model: if OKR sections are absent or empty in the context, respond with "I don't see any OKRs yet — head to Plan to set them before we go deeper." rather than extrapolating or giving generic advice
- [ ] Prompt target: under 1,200 tokens

**Size:** M | **Dependencies:** STORY-018

---

### STORY-020: Coach tab — Claude API integration

As a developer, I want a `callCoach(userMessage, state): Promise<string>` function that sends the assembled prompt to the Claude API and returns the response so that the UI only handles display.

**Acceptance criteria:**
- [ ] Uses `fetch` to call Anthropic messages API directly (no SDK dependency)
- [ ] Reads API key from `AppState.apiKey`; throws descriptive error if absent
- [ ] Model: `claude-sonnet-4-6`; `max_tokens`: 1024
- [ ] Messages array: system prompt (context injected) + single human turn (stateless — no history between sessions)
- [ ] HTTP 401 returns: "Invalid API key — update it in Setup."
- [ ] HTTP 429 returns: "Rate limit hit — try again in a moment."
- [ ] Network failure / no response returns: "Connection failed — check your internet."
- [ ] All other non-2xx returns: "Coach is unavailable right now — try again."
- [ ] API key never logged; request body logged at debug level only with key redacted

**Size:** M | **Dependencies:** STORY-018, STORY-019, STORY-006

---

### STORY-021: Coach tab — chat UI

As Moe, I want a chat interface where I can type a question and receive a coaching response so that I can get grounded, context-aware advice without switching tools.

**Acceptance criteria:**
- [ ] Scrollable message thread: user messages right-aligned, coach responses left-aligned
- [ ] Input field at bottom with "Ask Coach" send button; Enter key also submits
- [ ] While loading: input disabled, button shows "Thinking..."
- [ ] Coach responses rendered as plain text (no markdown parsing in v1)
- [ ] Chat history is local component state — clears on tab switch or session refresh
- [ ] If API key missing: send button disabled, replaced with link to Setup tab
- [ ] If `buildCoachContext` returns the Setup sentinel ("User has not yet completed Setup"): API call is blocked; tab shows "Complete Setup before using the Coach" with a link to Setup tab
- [ ] Error messages from `callCoach` (401, 429, network, other) rendered inline in the chat thread as a coach message in muted red text
- [ ] Input char limit: 500 with counter
- [ ] Empty chat shows static prompt suggestion: "Try: 'What should my 3 MITs be this week?'"

**Size:** M | **Dependencies:** STORY-020, STORY-026

---

## EPIC-006: Review Tab

**User value:** The user can see a weekly summary of MIT completion and mood, and a monthly summary of OKR progress, so that they can reflect on patterns and adjust their plan.

**Two review rhythms:**
- **Weekly** (STORY-022, STORY-023): MIT completion + mood trend — mapped to weekly initiatives
- **Monthly** (STORY-024): OKR progress — mapped to monthly KRs

**Dependencies:** EPIC-001, EPIC-007, EPIC-003, EPIC-004
**Deferred:** Charts/graphs (v1 is tables and numbers), export to PDF/CSV, year-in-review.

---

### STORY-022: Review tab — weekly MIT completion summary

As Moe, I want to see a table of this week's MITs with completion status so that I can assess my weekly follow-through.

**Acceptance criteria:**
- [ ] Week selector: defaults to current ISO week; chevrons navigate to prior weeks (no future)
- [ ] Table columns: Day | MIT Text | Initiative (if linked) | Status
- [ ] Status column displays one of four labels: Done / Carried / Dropped / Pending; color-coded: Done = success green, Carried = amber, Dropped = muted red, Pending = gray
- [ ] Summary row: "X of Y MITs completed (Z%)" — counts only status='complete' as completed; if Y = 0, shows "No MITs logged this week" instead of a percentage
- [ ] Days with no MITs: italic "No MITs logged" placeholder row
- [ ] Sorted Mon → Sun

**Size:** M | **Dependencies:** STORY-003, STORY-014, STORY-026

---

### STORY-023: Review tab — weekly mood and exercise trend

As Moe, I want to see my daily mood scores and exercise log for the selected week so that I can spot physical and emotional patterns alongside task performance.

**Acceptance criteria:**
- [ ] Shares the week selector from STORY-022 (same component, same selected week)
- [ ] Table columns: Day | Mood (1–5) | Exercise (type + duration, or "—") | Reflection Note
- [ ] Days with no log: "—" in all columns
- [ ] Weekly average mood below table: "Avg mood: X.X"; if no logs exist for the selected week, shows "No mood data for this week." instead
- [ ] Mood 1–2: muted red text; 3: gray; 4–5: amber
- [ ] Reflection notes truncated at 80 chars; full text on hover/expand

**Size:** S | **Dependencies:** STORY-016, STORY-022

---

### STORY-024: Review tab — monthly OKR progress table

As Moe, I want to see a table of this month's Key Results with completion percentages so that I can evaluate which OKRs are on track.

**Acceptance criteria:**
- [ ] Month selector: defaults to current month; prior months navigable
- [ ] Table columns: Dimension | Annual OKR | Quarterly Obj | Monthly KR | Initiatives Total | Initiatives Done | % Complete
- [ ] % Complete = completed initiatives / total initiatives for that KR in selected month
- [ ] KRs with 0 initiatives: show "No initiatives planned" in the % column and "—" for all count columns; no color indicator applied (neutral gray row)
- [ ] ≥80% highlighted amber; <40% muted red; 40–79% gray; 0-initiative KRs = no color
- [ ] KR rows with status <40% (red) include a "Go to Plan →" link that navigates to the Plan tab and opens that dimension's filter; the KR's parent Quarterly Objective is expanded on arrival
- [ ] Sorted by Dimension then % Complete descending

**Size:** M | **Dependencies:** STORY-003, STORY-011, STORY-012, STORY-026

---

### STORY-029: Review tab — dimension weight vs MIT distribution table

As Moe, I want to see a table comparing my target dimension weights against how I actually spent my MITs this week and month so that I have a clear accountability mechanism for whether my time matches my stated priorities.

**Acceptance criteria:**
- [ ] Table appears in both the Weekly Review section (STORY-022) and the Monthly OKR Progress section (STORY-024) of the Review tab — one instance per section, each using that section's selected time period
- [ ] Table columns: Dimension | Target Weight (%) | Actual MIT % | Gap | Status
- [ ] Target Weight (%): the fixed weight for that dimension from `LIFE_DIMENSIONS` (e.g., Inner Life = 20%)
- [ ] Actual MIT %: percentage of completed MITs (status = 'complete') in the selected period that are linked to an initiative under that dimension, calculated as: (completed MITs linked to dimension / total completed MITs with any initiative link) × 100; MITs with no initiative link are excluded from both numerator and denominator
- [ ] Gap: Actual MIT % − Target Weight %; displayed with explicit sign (e.g., +3%, −8%)
- [ ] Status indicator: green dot if |gap| ≤ 5%, amber dot if 6–15%, red dot if > 15%
- [ ] If total completed MITs with initiative links = 0 for the period, all rows show "—" in Actual MIT % and Gap columns and no status indicator
- [ ] Dimensions with 0 completed MITs in the period show 0% actual, not "—" (zero is a meaningful data point — the user chose not to work in that dimension)
- [ ] Table is sorted in the fixed dimension order from `LIFE_DIMENSIONS` (not alphabetical, not by gap)
- [ ] Row with largest absolute gap highlighted with amber left border to draw attention to the biggest misalignment
- [ ] No edit actions — table is read-only

**Size:** M | **Dependencies:** STORY-014 (DailyMIT with initiativeId), STORY-022 (weekly review), STORY-024 (monthly review)

---

### STORY-025: Review tab — layout and section assembly

As a developer, I want the Review tab to assemble weekly and monthly sections in a two-section layout so that the two review rhythms are clearly distinct.

**Acceptance criteria:**
- [ ] Two labeled sections: "Weekly Review" (top) and "Monthly OKR Progress" (bottom)
- [ ] Week selector (STORY-022/023) and month selector (STORY-024) are independent
- [ ] Section dividers styled with amber titled rule (consistent with Setup tab)
- [ ] No horizontal overflow at 1280px
- [ ] "No data yet" empty state for each section
- [ ] Each section scrolls independently within a fixed-height container (`overflow-y: auto`)

**Size:** S | **Dependencies:** STORY-022, STORY-023, STORY-024, STORY-029

---

## EPIC-007: Shell / Navigation / Design System

**User value:** The application has a cohesive visual identity and a working five-tab navigation shell so that every tab feels part of the same product.
**Dependencies:** EPIC-001
**Deferred:** Mobile/responsive layout, keyboard shortcut navigation, theme switching.

---

### STORY-026: App shell and five-tab navigation

As a developer, I want a top-level App component with a five-tab nav bar so that the artifact has a navigable shell from the first render.

**Acceptance criteria:**
- [ ] Five tab buttons: Setup | Today | Plan | Coach | Review
- [ ] Active tab: amber underline/border; inactive: muted slate text
- [ ] Tab switching is client-side state only (no routing library)
- [ ] `useAppState` instantiated at App level; `state` and `updateState` passed as explicit props to each tab component — no React Context (Decision E)
- [ ] On first load (when `AppState.profile` is null), active tab defaults to Setup so the welcome banner is the first thing the user sees
- [ ] App renders without error on first load with empty state
- [ ] Tab bar fixed at top; content area scrolls independently
- [ ] Tab bar does not overflow at 1280px

**Size:** S | **Dependencies:** STORY-003

---

### STORY-027: Design system — color tokens and base styles

As a developer, I want CSS custom properties defining the design system tokens so that all components use consistent colors, spacing, and typography.

**Acceptance criteria:**
- [ ] CSS variables in `:root`: `--color-bg` (#1e2130), `--color-surface` (#252836), `--color-border` (#333650), `--color-text-primary` (#e8eaf0), `--color-text-muted` (#8a8fa8), `--color-accent` (#f59e0b), `--color-accent-hover` (#d97706), `--color-danger` (#ef4444), `--color-success` (#22c55e)
- [ ] Base font: system-ui or monospace stack (no external font imports)
- [ ] Base font size: 14px; line-height: 1.6
- [ ] All interactive elements use `--color-accent` for focus ring
- [ ] Reusable classes: `.table-base`, `.btn-primary`, `.btn-ghost`, `.input-base`, `.section-divider`
- [ ] No external CSS framework

**Size:** S | **Dependencies:** None (parallel with STORY-026)

---

### STORY-028: Error boundary and empty-state components

As a developer, I want a React error boundary wrapping the entire app and reusable empty-state components so that rendering failures are caught gracefully.

**Acceptance criteria:**
- [ ] `ErrorBoundary` catches any render error; displays "Something went wrong. Reload the app to recover." with a reload button
- [ ] ErrorBoundary wraps the entire App at the root
- [ ] `EmptyState` component accepts `message: string` prop; renders centered in muted text
- [ ] `EmptyState` used in: Plan tab dimension sections, weekly MIT table, mood/exercise table, monthly OKR table, carryover section, Coach chat history
- [ ] No unhandled promise rejections in Coach API call — all errors surfaced to UI via chat thread

**Size:** S | **Dependencies:** STORY-026, STORY-027

---

## Recommended Execution Order

```
Phase 1 (sequential):   001 → 002 → 003
Phase 2 (parallel):     026 ‖ 027 → 028
Phase 3 (parallel):
  Setup stream:          004 → 005 → 006 → 007 → 008
  Plan stream:           009 → 010 → 011 → 012 → 013
Phase 4 (Today):        014 → 015 → 016 → 017
Phase 5 ‖ Phase 6:
  Coach:                 018 → 019 → 020 → 021
  Review:                022 → 023 → 024 → 025
```

---

## Risk Register

| Risk | Affected Stories | Mitigation |
|---|---|---|
| localStorage size limit (~5MB) exceeded after months of use | 002, 003 | Log warning at 4MB — UI surface deferred to backlog (no story in MVP) |
| API key stored in localStorage accessible to any script in artifact renderer | 006, 020 | Known limitation for single-user local tool; never log the key |
| Context payload exceeds Claude context window for power users | 018 | Cap DailyMIT and DailyLog history at 30 days in payload builder |
| `useAppState` deep-merge clobbers nested arrays on partial update | 003 | Explicit merge strategy test: arrays must be replaced, not concatenated |
| Cascade deletes remove data user did not intend to remove | 009, 010, 011 | Confirmation modal listing full cascade impact before any delete executes |
| Review→Plan deep-link breaks if Plan tab state resets on navigation | 024, 013 | Dimension filter and expanded KR target must be passed via App-level state, not Plan-local state — only for the Review→Plan link (Setup→Plan cross-tab navigation is out of scope) |

---

## MVP vs. Deferred

**All 29 stories are MVP scope.**

**Added to backlog (not MVP):**
- Storage-full warning UI ("Clear old logs" option in Setup)

**Explicitly deferred:**
- Export to JSON, CSV, or PDF
- Multi-device sync or cloud backup
- Mobile / responsive layout
- Drag-and-drop reordering
- OKR archiving
- Coach streaming responses
- Coach conversation history persistence
- Voice input for Coach
- Charts or graphs in Review (tables and numbers only in v1)
- Keyboard shortcut navigation
- Theme switching (dark only in v1)
- Deathbed-goals-to-Annual-OKR visual linkage diagram
