---
name: project-life-compass
description: "Life Compass app — current state, repo location, tech stack, and what has shipped"
metadata: 
  node_type: memory
  type: project
  originSessionId: b6cd2d7f-c414-4c32-9a19-d843bcaa61f5
---

Life Compass is a React + TypeScript + Vite personal planning app with localStorage (no backend). Dark monospace "command-center" design system.

**Repo:** `projects/life-compass/` within the pm-os working directory. Git remote: `github.com/Mg19703/life-compass`, branch `main`.

**Tech stack:** React 18, TypeScript, Vite, localStorage only. No backend, no database.

**Spec files:**
- `projects/life-compass/epics-and-stories.md` — v1 (STORY-001–029)
- `projects/life-compass/epics-and-stories-v2.md` — v2 (STORY-030–043)
- `projects/life-compass/epics-and-stories-v3.md` — v3 (STORY-044–065)

**Current schema version:** 3

**What has shipped (as of commit 5657938, 2026-05-16):**

v1 + v2: Full OKR hierarchy (Annual Goal → Quarterly Objective → Monthly KR → Weekly Initiative → Daily MIT), coach tab with Claude API, habits tab, streak tracking, review tab with deathbed alignment, weekly review, MIT suggestions.

v3 (all 22 stories complete):
- MIT subtasks: collapsible panel per card, add/delete/checkbox, X/Y badge, past-date read-only
- Initiative hierarchy dropdown: custom popover replacing native `<select>`, grouped Dimension → KR → Initiative, keyboard nav, ARIA listbox, `position: fixed` via getBoundingClientRect
- Initiative association on MIT creation + inline edit
- Tab bar MIT count badge (always visible, 0/0 baseline)
- Coach tool-calling: `callCoachWithTools`, `sendToolResult`, 8-call cap, multi-turn loop
- 11 OKR + MIT tool schemas in `src/coach/tools.ts`
- `ToolProposalCard` with two-step destructive confirm
- `applyOKRTool` pure function in `src/coach/applyOKRTool.ts`
- Coach confirm/cancel handlers: threads fresh post-mutation state to sendToolResult
- Coach system prompt: Tools section (11 tools, 5 rules)
- Coach context: Tool IDs JSON block, 30-day MIT log with IDs, 2000-token cap
- Deathbed-to-dimension mapping picker in Setup tab
- Review tab deathbed alignment reads explicit mappings
- `.btn-row` CSS class (PlanTab, HabitsTab, ReviewTab)

Post-ship additions (same session):
- MIT cap raised from 3 to 10
- Undo MITs: checked checkbox restores complete → pending; ↩ button restores dropped → pending
- Initiative picker: stale initiative silently nulled on save
- Bug fixes (see [[feedback-bugs-fixed]])

**Why:** Personal productivity tool Moe built to track his OKRs, daily MITs, habits, and use AI coaching aligned with the EWMBA 258 behavioral frameworks from Haas.
