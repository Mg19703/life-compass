---
name: project-life-compass-architecture
description: "Key files, patterns, and architecture decisions in Life Compass"
metadata: 
  node_type: memory
  type: project
  originSessionId: b6cd2d7f-c414-4c32-9a19-d843bcaa61f5
---

**Key source files:**
- `src/types.ts` — all data model types (`AppState`, `DailyMIT`, `Subtask`, `DimensionId`, etc.)
- `src/defaults.ts` — `LIFE_DIMENSIONS` array (6 fixed dimensions, canonical order), `DEFAULT_APP_STATE`, `SCHEMA_VERSION`
- `src/migrations.ts` — schema migration dispatcher; each step wrapped in try/catch, returns `DEFAULT_APP_STATE` on failure
- `src/hooks/useAppState.ts` — single state source; `updateState` uses `latestStateRef` for synchronous chaining (avoids stale closure on rapid updates); arrays replace entirely, plain objects shallow-merge
- `src/coach/callCoach.ts` — `callCoach` (original, returns `CoachResponse`), `callCoachWithTools` (tool-use entry point), `sendToolResult` (continues multi-turn chain)
- `src/coach/coachContext.ts` — `buildCoachContext(state, now?)` pure function; injectable `now` for testability
- `src/coach/coachPrompt.ts` — `SYSTEM_PROMPT` with `{{CONTEXT}}` placeholder; Tools section appended in v3
- `src/coach/tools.ts` — `OKR_TOOLS`, `MIT_TOOLS`, `DESTRUCTIVE_TOOL_NAMES`
- `src/coach/applyOKRTool.ts` — pure OKR mutation function; imports cascade helpers from `src/utils/okrMutations.ts`
- `src/utils/okrMutations.ts` — `execDeleteAnnual`, `execDeleteQuarterly`, `execDeleteMonthly`, `execDeleteInitiative`; shared between PlanTab and applyOKRTool
- `src/components/InitiativeDropdown.tsx` — custom popover picker (not native select); grouped by Dimension → KR → Initiative; `position: fixed` via `getBoundingClientRect` at open time
- `src/components/ToolProposalCard.tsx` — purely presentational; two-step confirm for destructive tools
- `src/tabs/CoachTab.tsx` — coach chat, Suggest MITs, Weekly Review, tool confirm/cancel handlers

**Design tokens (index.css):**
```
--color-bg: #1e2130
--color-surface: #252836
--color-border: #333650
--color-text-primary: #e8eaf0
--color-text-muted: #8a8fa8
--color-accent: #f59e0b  (amber)
--color-danger: #ef4444
--color-success: #22c55e
font-family: ui-monospace (monospace stack)
```

**Patterns:**
- `TabProps` = `{ state: AppState, updateState: (partial) => void }` — shared by all tab sub-components
- `CoachTabProps` extends `TabProps` and adds `getLatestState: () => AppState` (needed for stale-closure-safe rapid updates in `handleAddMIT`)
- `updateState` uses `shallowMerge` against `latestStateRef.current` — sequential calls chain correctly without batching issues
- Tab bar uses conditional rendering (`&&`) not CSS show/hide — CoachTab unmounts on tab switch, losing pending tool state intentionally
- MIT status machine: `'pending' | 'complete' | 'carried' | 'dropped'`; restore to pending supported for complete and dropped (not carried — complex cascade)

**MIT cap:** 10 (raised from 3 in v3 post-ship). Cap counts all non-carried MITs regardless of status.
