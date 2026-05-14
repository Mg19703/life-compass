# Life Compass v2 — Epics & Stories

**4 Epics | 22 Stories | Base: v1 (STORY-001–029)**
**Stack:** React · Claude API · localStorage · Claude Code Desktop App
**Last updated:** 2026-05-14

---

## What v2 adds (decision log summary)

| Area | Change |
|---|---|
| Data model | New entities: `Habit`, `HabitLog`; `AppState` gains `habits[]`, `habitLogs[]` |
| New tab | Habits (6th tab) — full CRUD + daily check-in |
| Today tab | Streak summary section added beneath MITs |
| Coach tab | "Suggest MITs" button, "Weekly Review" button, tool-call proposal cards |
| Review tab | Monthly deathbed alignment section |
| Shell | Navigation updated from 5 to 6 tabs |

All v1 stories (STORY-001–029) remain in scope and are the assumed baseline. This document covers only net-new work.

---

## Epic Overview & Dependency Map

```
EPIC-008 Data Model — Habits
    └── depends_on: EPIC-001 (v1 data layer)
    └── blocks: EPIC-009, EPIC-010, EPIC-011 (streak summary)

EPIC-009 Habits Tab
    └── depends_on: EPIC-008, EPIC-007 (v1 shell/design system)

EPIC-010 Coach — Structured Actions
    └── depends_on: EPIC-005 (v1 Coach tab), EPIC-008

EPIC-011 Review — Deathbed Alignment
    └── depends_on: EPIC-006 (v1 Review tab), EPIC-001
```

---

## EPIC-008: Data Model — Habits & HabitLogs (EPIC-008)

**User value:** Habits and daily check-in data are persisted reliably so that streak math, the Habits tab, and the Today streak summary all draw from the same consistent source.
**Dependencies:** EPIC-001 (v1 data layer complete)
**Deferred:** Habit templates library, habit sharing, cloud sync.

---

### STORY-030: Define Habit and HabitLog types; extend AppState

- **Type:** Technical Story
- **Statement:** As a developer, I want canonical TypeScript types for `Habit` and `HabitLog`, and the `AppState` interface extended with `habits[]` and `habitLogs[]`, so that all v2 components read and write habit data in a consistent shape.

**Acceptance criteria:**
- [ ] `Habit` interface defined in `src/types.ts`:
  ```ts
  interface Habit {
    id: string;
    name: string;           // user-defined label, max 80 chars
    dimensionId: DimensionId;
    createdAt: ISODate;     // YYYY-MM-DD when habit was created
    archivedAt: ISODate | null; // null = active; date string = archived
  }
  ```
- [ ] `HabitLog` interface defined in `src/types.ts`:
  ```ts
  interface HabitLog {
    id: string;
    habitId: string;
    date: ISODate;          // YYYY-MM-DD
    completed: boolean;
  }
  ```
- [ ] `AppState` gains two new top-level fields:
  ```ts
  habits: Habit[];          // all habits (active and archived)
  habitLogs: HabitLog[];    // flat array, queried by .date and .habitId
  ```
- [ ] `schemaVersion` bumped to 2 in `src/defaults.ts`
- [ ] Default `AppState` includes `habits: []` and `habitLogs: []` so new sessions start with empty arrays
- [ ] All new types exported from `src/types.ts` alongside existing types
- [ ] `HabitLog` uses a flat array (not a date-keyed Record) for consistency with `dailyMITs`

**Size:** S | **Dependencies:** STORY-001 (v1 schema)

---

### STORY-031: Storage migration — v1 → v2 schema

- **Type:** Technical Story
- **Statement:** As a developer, I want the `useAppState` migration path to handle v1 localStorage payloads gracefully so that existing users do not lose data when v2 loads for the first time.

**Acceptance criteria:**
- [ ] Migration logic in `src/migrations.ts` (existing file): a `migrateV1toV2(state: AppState): AppState` function that adds `habits: []` and `habitLogs: []` if those keys are absent and upgrades `schemaVersion` from 1 to 2
- [ ] `useAppState` calls `migrateV1toV2` during `loadState` whenever the loaded `schemaVersion < 2`
- [ ] Migration is idempotent: calling `migrateV1toV2` on a v2 payload leaves it unchanged
- [ ] All existing v1 keys (`annualOKRs`, `dailyMITs`, etc.) are preserved verbatim — migration adds fields, never removes or rewrites
- [ ] Migration does not throw for any valid v1 payload; malformed payloads fall back to the existing corrupt-data path (already handled in STORY-002)
- [ ] After migration, `saveState` writes a v2 payload — the user will not be migrated again on next load

**Size:** S | **Dependencies:** STORY-030, STORY-003 (v1 useAppState)

---

### STORY-032: Streak calculation utility

- **Type:** Technical Story
- **Statement:** As a developer, I want a pure `calculateStreak(habitId, habitLogs, today): number` function so that streak counts are computed consistently everywhere they appear (Habits tab and Today tab).

**Acceptance criteria:**
- [ ] `calculateStreak(habitId: string, habitLogs: HabitLog[], today: ISODate): number` exported from `src/coach/habitUtils.ts` (new file)
- [ ] Streak = the longest consecutive run of days ending on or before `today` where `HabitLog.completed === true` for the given `habitId`
- [ ] A day with no `HabitLog` entry counts as not completed (breaks the streak)
- [ ] `today` is the anchor: if the habit was not logged today, the streak counts consecutive completed days ending on `today - 1`; if today is completed, it counts from today backward
- [ ] Returns 0 if there are no completed logs
- [ ] Function is pure (no side effects, no API calls, deterministic for same inputs)
- [ ] Unit tests cover: zero logs → 0; single day completed → 1; three-day run → 3; gap in middle breaks streak; streak anchored to today vs. today-1 correctly
- [ ] `calculateStreak` is re-exported from a barrel `src/coach/index.ts` alongside existing coach exports (or added to the existing barrel if one exists)

**Size:** S | **Dependencies:** STORY-030

---

## EPIC-009: Habits Tab (EPIC-009)

**User value:** The user can define personal habits tied to a life dimension, check them off daily, and see current streaks — creating a lightweight accountability layer beneath the OKR structure.
**Dependencies:** EPIC-008, EPIC-007 (v1 shell and design system)
**Deferred:** Habit reordering, habit templates, habit-to-initiative linkage, reminders/notifications, habit analytics beyond streak.

---

### STORY-033: App shell — add Habits as 6th tab

- **Type:** Technical Story
- **Statement:** As a developer, I want the app navigation bar updated from 5 to 6 tabs so that the Habits tab is accessible from every other tab.

**Acceptance criteria:**
- [ ] `TabId` type in `src/types.ts` updated: `'setup' | 'today' | 'plan' | 'coach' | 'review' | 'habits'`
- [ ] Tab order in the nav bar: Setup | Today | Plan | Coach | Review | **Habits**
- [ ] Habits tab renders `<HabitsTab state={state} updateState={updateState} />` — stub component acceptable until STORY-034
- [ ] Active tab styling (amber underline) applies to Habits tab correctly
- [ ] Tab bar does not overflow or wrap at 1280px with 6 tabs
- [ ] First-load default tab logic unchanged: still opens Setup if `profile` is null

**Size:** S | **Dependencies:** STORY-026 (v1 shell), STORY-030

---

### STORY-034: Habits tab — habit CRUD

- **Type:** User Story
- **Statement:** As Moe, I want to create, edit, archive, and delete habits so that my habit list stays relevant as my goals evolve.

**Acceptance criteria:**
- [ ] Add form: Name (text input, required, 80 char max with live counter) + Dimension (dropdown, 6 options from `LIFE_DIMENSIONS`)
- [ ] "Add Habit" button writes a new `Habit` to `AppState.habits` via `updateState`; `id` = `crypto.randomUUID()`, `createdAt` = today's ISO date, `archivedAt` = null
- [ ] Habits list rendered as a table: Name | Dimension | Streak | Created | Actions (Edit / Archive / Delete)
- [ ] Streak column: calls `calculateStreak` for each active habit; displays as "N days" or "—" if 0
- [ ] Edit: inline editing of `name` and `dimensionId`, confirmed with checkmark, cancelled with X; saves via `updateState`
- [ ] Archive: sets `archivedAt` to today's ISO date; habit disappears from the active list; no confirmation required
- [ ] Delete: removes the habit and all its `HabitLog` entries from `AppState`; requires a confirmation modal — "Delete [habit name]? This will permanently remove N days of log history." — user must click "Delete anyway"
- [ ] Archived habits shown in a collapsed "Archived" section below the active table; can be unarchived (sets `archivedAt` back to null)
- [ ] Empty state (no active habits): "No habits yet — add one above."
- [ ] Archived section hidden entirely if no archived habits exist

**Size:** M | **Dependencies:** STORY-031, STORY-032, STORY-033

---

### STORY-035: Habits tab — daily check-in

- **Type:** User Story
- **Statement:** As Moe, I want to check off each of my active habits for today so that I build a consistent daily log and can track my streaks over time.

**Acceptance criteria:**
- [ ] Daily check-in section shows all active habits (archivedAt === null) as a checklist for the viewed date
- [ ] Date defaults to today; left/right chevrons navigate to prior days (up to 30 days back, no future navigation) — same UX pattern as Today tab date nav
- [ ] Each row: Habit name | Dimension badge | Streak (days) | Checkbox
- [ ] Checking the checkbox: upserts a `HabitLog` for `{habitId, date, completed: true}` — if a log already exists for that habit+date, updates `completed` to true; if not, creates a new log with `id = crypto.randomUUID()`
- [ ] Unchecking the checkbox: updates the existing log's `completed` to false (does not delete the log record)
- [ ] On first render for a given date, checkboxes reflect the existing `HabitLog` records for that date
- [ ] Streak count updates immediately after check/uncheck without page reload
- [ ] Historical dates labeled "(Past)" in muted text beside the date header
- [ ] Empty state (no active habits): "Add habits above to start your daily check-in."

**Size:** M | **Dependencies:** STORY-034

---

### STORY-036: Habits tab — layout and section assembly

- **Type:** Technical Story
- **Statement:** As a developer, I want the Habits tab to assemble the CRUD section and daily check-in section in a coherent two-section layout so that the tab is complete and navigable.

**Acceptance criteria:**
- [ ] Two labeled sections: "My Habits" (CRUD — STORY-034) and "Today's Check-In" (check-in — STORY-035), separated by an amber titled divider (consistent with v1 design system)
- [ ] "My Habits" section appears above "Today's Check-In"
- [ ] Tab fully scrollable; no horizontal overflow at 1280px
- [ ] Dimension badges use the amber accent color with muted text on top
- [ ] Empty-state messages from STORY-034 and STORY-035 render inside their respective sections; tab-level empty state not needed

**Size:** S | **Dependencies:** STORY-034, STORY-035

---

### STORY-037: Today tab — streak summary section

- **Type:** User Story
- **Statement:** As Moe, I want to see a compact streak summary on the Today tab so that I have a quick pulse on my active habits without switching to the Habits tab.

**Acceptance criteria:**
- [ ] Streak summary section rendered below the MIT slots and above the end-of-day resolution section on the Today tab
- [ ] Shows only active habits (archivedAt === null); if no active habits exist, section is hidden entirely (no empty state message on Today tab — that belongs in the Habits tab)
- [ ] Each row: Habit name | Streak badge ("N days") | Today's status (checked circle if completed today, empty circle if not)
- [ ] Clicking the checked/unchecked circle toggles today's `HabitLog` for that habit — same upsert logic as STORY-035; state updates are reflected immediately in both Today tab and Habits tab
- [ ] Section header: "Habit Streaks"
- [ ] Streak counts computed via `calculateStreak`; anchored to today's date
- [ ] Section is read-only for habit management — no add/edit/archive controls; "Manage habits →" link navigates to Habits tab

**Size:** M | **Dependencies:** STORY-032, STORY-035, STORY-017 (Today tab layout)

---

## EPIC-010: Coach — Structured Actions (EPIC-010)

**User value:** The user can trigger structured coaching workflows — MIT suggestion and weekly review — with a single button, and receive actionable proposals rather than open-ended chat responses.
**Dependencies:** EPIC-005 (v1 Coach tab complete), EPIC-008 (habit data available in context)
**Deferred:** Streaming responses, auto-apply of Coach suggestions, additional structured workflows (quarterly review, deathbed check-in).

---

### STORY-038: Coach context — add habit data to payload

- **Type:** Technical Story
- **Statement:** As a developer, I want `buildCoachContext` extended to include active habits and recent HabitLog data so that structured Coach workflows can reference the user's habit state.

**Acceptance criteria:**
- [ ] `buildCoachContext` in `src/coach/coachContext.ts` updated to include a new "Active Habits & Streaks" section in the context payload
- [ ] Section format: markdown table with columns — Habit Name | Dimension | Current Streak (days) | Completed Today (yes/no)
- [ ] Only active habits included (archivedAt === null)
- [ ] Streak computed via `calculateStreak`; "Completed Today" derived from today's HabitLog records
- [ ] "Today" for this section uses the same `now` parameter already in `buildCoachContext` — no new clock dependency
- [ ] If `habits` is empty or all habits are archived, section reads: "No active habits configured."
- [ ] Section added after the Dimension Distribution section (last in payload) to preserve token order
- [ ] Estimated payload increase: ≤200 tokens for 10 active habits — acceptable within the 8,000-token budget

**Size:** S | **Dependencies:** STORY-018 (v1 buildCoachContext), STORY-032

---

### STORY-039: Coach tab — "Suggest MITs" structured action

- **Type:** User Story
- **Statement:** As Moe, I want to click "Suggest MITs" and receive a proposal of three MITs for today so that I can get a grounded starting point without writing a freeform prompt.

**Acceptance criteria:**
- [ ] "Suggest MITs" button rendered in the Coach tab header, above the chat thread
- [ ] Clicking the button sends a pre-written prompt to the Claude API via the existing `callCoach` function: "Based on my current weekly initiatives, habit streaks, and today's context, suggest exactly 3 MITs for today. Format your response as a numbered list with one MIT per line and a brief rationale (1 sentence) for each."
- [ ] While loading, button disabled and shows "Thinking..." (same pattern as STORY-021 send button)
- [ ] Response renders as a **proposal card** in the chat thread (not a plain chat bubble): card has a light amber border, a "Proposed MITs" header, and three numbered rows
- [ ] Each row has an "Add to Today" button; clicking it adds that MIT text to `AppState.dailyMITs` for today's date with `status: 'pending'` and `initiativeId: null` via `updateState`
- [ ] "Add to Today" is disabled if today already has 3 manually-created MITs (the 3-MIT cap applies here too)
- [ ] After clicking "Add to Today", the button changes to "Added" (disabled, green text); clicking a different row's "Add to Today" is still allowed
- [ ] If the API returns text that cannot be parsed into exactly 3 numbered items, the response is rendered as a plain chat bubble (graceful fallback, no crash)
- [ ] API key absent or setup incomplete: button disabled with tooltip "Complete Setup first"

**Size:** M | **Dependencies:** STORY-020 (callCoach), STORY-021 (Coach UI), STORY-038, STORY-014 (DailyMIT write)

---

### STORY-040: Coach tab — "Weekly Review" structured action

- **Type:** User Story
- **Statement:** As Moe, I want to click "Weekly Review" and receive a structured coaching analysis of my week so that I get a synthesized perspective without writing a prompt from scratch.

**Acceptance criteria:**
- [ ] "Weekly Review" button rendered in the Coach tab header alongside "Suggest MITs"
- [ ] Clicking the button sends a pre-written prompt to the Claude API: "Review my week. Analyze: (1) MIT completion rate and patterns, (2) habit streak performance, (3) alignment between my dimension weights and actual completed MITs, (4) one key adjustment to make next week. Be concise — no more than 250 words total."
- [ ] While loading, button disabled and shows "Thinking..."
- [ ] Response renders as a **proposal card** in the chat thread with a "Weekly Review" header and four labeled sub-sections matching the four prompt points: "MIT Completion", "Habit Streaks", "Dimension Alignment", "Next Week Adjustment"
- [ ] If the API response cannot be parsed into 4 labeled sections, it is rendered as a plain chat bubble (graceful fallback)
- [ ] Proposal card is read-only — no "Add to Today" or apply actions
- [ ] API key absent or setup incomplete: button disabled with tooltip "Complete Setup first"
- [ ] Both "Suggest MITs" and "Weekly Review" buttons fit in the Coach tab header at 1280px without wrapping

**Size:** M | **Dependencies:** STORY-039 (proposal card component established in prior story)

---

### STORY-041: Proposal card — shared component

- **Type:** Technical Story
- **Statement:** As a developer, I want a reusable `ProposalCard` component so that both "Suggest MITs" and "Weekly Review" render with a consistent visual treatment.

**Acceptance criteria:**
- [ ] `ProposalCard` component in `src/components/ProposalCard.tsx` accepts: `title: string`, `sections: { label: string; content: string; action?: ReactNode }[]`
- [ ] Rendered with: amber left border (4px), slightly elevated surface (`--color-surface`), title in amber text, each section as a labeled block
- [ ] `action` slot (optional) renders to the right of the section content — used for "Add to Today" buttons in STORY-039
- [ ] If no `sections` prop is provided or array is empty, component renders nothing (not an error)
- [ ] Component is used in STORY-039 and STORY-040; any future structured workflow uses this component
- [ ] No external component library used

**Size:** S | **Dependencies:** STORY-027 (v1 design system)

Note: STORY-041 should be built before STORY-039 and STORY-040; both depend on it. Sequence: 041 → 039 → 040.

---

## EPIC-011: Review — Deathbed Alignment (EPIC-011)

**User value:** The user can see, once a month, an explicit map between their completed MITs and their seven deathbed goals so that planning stays anchored to what matters most, not just what was urgent.
**Dependencies:** EPIC-006 (v1 Review tab complete), EPIC-001 (v1 data layer)
**Deferred:** Trend across months, automated deathbed alignment score, coach-generated alignment narrative (could be a future structured action).

---

### STORY-042: Review tab — monthly deathbed alignment section

- **Type:** User Story
- **Statement:** As Moe, I want a monthly deathbed alignment section in the Review tab so that I can see whether the OKRs I'm executing actually map to my end-of-life goals.

**Acceptance criteria:**
- [ ] New section "Deathbed Alignment" added to the Review tab below the existing "Monthly OKR Progress" section
- [ ] Section uses the same month selector as "Monthly OKR Progress" (STORY-024) — not a separate selector
- [ ] Section heading styled with amber titled divider (consistent with v1 design)
- [ ] Content: a table with columns — Deathbed Goal (text, up to 60 chars, truncated with ellipsis; full text on hover) | Related Monthly KRs (count of this month's KRs that are children of an Annual OKR in that dimension, displayed as "N KRs") | Related Completed MITs (count of completed MITs in the selected month that are linked to an initiative under any KR whose chain traces back to that goal's dimension) | Alignment Status
- [ ] Alignment Status logic:
  - "Active" (green dot): ≥1 completed MIT traces back to a KR in this goal's dimension for the selected month
  - "Planned" (amber dot): ≥1 KR exists in this goal's dimension for the selected month, but 0 completed MITs trace back
  - "Absent" (red dot): 0 KRs exist in this goal's dimension for the selected month
- [ ] Dimension mapping for alignment: each deathbed goal slot (1–7) is mapped to a life dimension by the user — but since v1 has no explicit goal-to-dimension mapping, use a fallback: display all 6 dimensions as rows, each showing its deathbed goal text if the user has filled it in (Goal 1 → Inner Life, Goal 2 → Relationships, Goal 3 → Health, Goal 4 → Financial Security, Goal 5 → Service, Goal 6 → Learning & Growth, Goal 7 → "Uncategorized / Other")
- [ ] If deathbed goal slot is empty (empty string), the row still appears but "Deathbed Goal" cell shows "(not set)" in muted gray italic
- [ ] If no deathbed goals have been set at all, section shows: "Set your deathbed goals in Setup to see alignment."
- [ ] Table is read-only; "Edit goals →" link navigates to Setup tab
- [ ] Section hidden entirely if selected month has no KRs and no MITs (no data = no alignment to show)

**Size:** M | **Dependencies:** STORY-005 (deathbed goals), STORY-024 (monthly OKR progress + month selector), STORY-014 (DailyMIT with initiativeId for tracing)

---

### STORY-043: Review tab — layout update for deathbed alignment

- **Type:** Technical Story
- **Statement:** As a developer, I want the Review tab layout updated to accommodate the new deathbed alignment section without breaking the existing two-section layout.

**Acceptance criteria:**
- [ ] Review tab now has three labeled sections: "Weekly Review" | "Monthly OKR Progress" | "Deathbed Alignment" — in that order, top to bottom
- [ ] "Deathbed Alignment" section shares the month selector from "Monthly OKR Progress" — month selector component not duplicated; the selected month state is lifted or passed down
- [ ] All three sections scroll independently within fixed-height containers (`overflow-y: auto`) — same pattern as STORY-025
- [ ] No horizontal overflow at 1280px
- [ ] Amber titled divider separates each section (consistent with v1 design)
- [ ] Existing STORY-025 layout behavior preserved for the first two sections

**Size:** S | **Dependencies:** STORY-042, STORY-025 (v1 Review tab layout)

---

## Recommended Execution Order

```
Phase 1 — Data foundation (sequential):
  030 → 031 → 032

Phase 2 — Shell (unblocks all UI):
  033

Phase 3 — Habits tab (sequential within stream):
  034 → 035 → 036

Phase 4 — Today tab update (after Phase 3):
  037

Phase 5 — Coach additions (parallel with Phase 3):
  038 → 041 → 039 → 040

Phase 6 — Review additions (parallel with Phase 5, after Phase 2):
  042 → 043
```

**Critical path:** 030 → 031 → 032 → 033 → 034 → 035 → 037
(Habits tab CRUD must land before Today streak summary; schema migration must land before any habit UI)

---

## MVP vs. Deferred

| Story | MVP? | Note |
|---|---|---|
| STORY-030 | MVP | Blocks everything |
| STORY-031 | MVP | Migration required before any v2 data write |
| STORY-032 | MVP | Streak math needed in both tabs |
| STORY-033 | MVP | 6th tab required before Habits tab renders |
| STORY-034 | MVP | Core habits CRUD |
| STORY-035 | MVP | Core daily check-in |
| STORY-036 | MVP | Tab layout |
| STORY-037 | MVP | Today tab integration |
| STORY-038 | MVP | Context update needed for Coach workflows |
| STORY-039 | MVP | Suggest MITs is the highest-value Coach addition |
| STORY-040 | MVP | Weekly Review structured action |
| STORY-041 | MVP | ProposalCard is a dependency of 039 and 040 |
| STORY-042 | MVP | Deathbed alignment is a v2 differentiator |
| STORY-043 | MVP | Layout plumbing for STORY-042 |

**All 14 v2 stories are MVP scope.**

**Explicitly deferred:**
- Habit templates library
- Habit-to-weekly-initiative linkage
- Habit reordering (drag-and-drop)
- Habit analytics (completion rate graph, longest streak ever)
- Explicit deathbed-goal-to-dimension mapping UI (v2 uses positional fallback)
- Deathbed alignment trend across months
- Coach-generated alignment narrative (structured action)
- Coach: additional structured workflows (quarterly review, deathbed check-in)
- Streaming Coach responses

---

## Risk & Dependency Summary

| Risk | Affected Stories | Mitigation |
|---|---|---|
| Schema migration corrupts v1 data on first v2 load | 031 | Migration must be additive only; unit test with a frozen v1 payload snapshot |
| `calculateStreak` called N times on Today tab for N habits — perf on large datasets | 032, 037 | Memoize per habitId+today in the Today tab component; acceptable up to ~50 habits |
| "Add to Today" in Suggest MITs bypasses the 3-MIT cap if user spams button | 039 | Check current MIT count at click time (after any prior adds in this session), not at render time |
| Month selector state shared between Monthly OKR Progress and Deathbed Alignment — prop drilling risk | 042, 043 | Lift month selector state to the Review tab parent (not a new Context); pass via props, consistent with v1's no-Context rule (Decision E) |
| Proposal card parse failure silently degrades to plain chat bubble — user may not know why | 039, 040 | Acceptable in MVP; add a small "Could not parse structured response" label to the fallback bubble so the user is not confused |
| `buildCoachContext` token budget: adding habit section may push near 8,000-token limit for power users | 038 | Cap habit table at 20 active habits in context payload; log a console.warn if truncated |
