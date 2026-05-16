---
name: feedback-bugs-fixed
description: Bugs caught and fixed in Life Compass v3 post-ship — useful patterns to avoid repeating
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b6cd2d7f-c414-4c32-9a19-d843bcaa61f5
---

**getMITAdded matched completed MITs** — `state.dailyMITs.some(m => m.text === mitText)` without status filter caused "Added ✓" to appear for already-complete MITs, blocking the user from adding a fresh pending one. Fix: add `&& m.status !== 'complete'` to the filter in `getMITAdded`.

**handleAddMIT stale closure** — used `state.dailyMITs` (React prop, potentially stale) for the array spread. On rapid "Add to Today" clicks, only the last MIT survived. Fix: use `getLatestState().dailyMITs` for the array read; `updateState` already uses `latestStateRef` internally so chaining is safe.

**Subtask panel chicken-and-egg** — the panel toggle button was gated on `showBadge` (total > 0), so there was no way to open the panel to add the first subtask. Fix: add `showToggle` = `total > 0 || (mit.status === 'pending' && !isPastDate)` to always show a chevron on today's pending MITs.

**Tab bar badge hidden when no MITs** — `showBadge = id === 'today' && todayTotal > 0` hid the badge entirely when today had 0 MITs, violating the spec ("always visible, show 0/0"). Fix: `showBadge = id === 'today'`.

**MIT confirm did not call sendToolResult for MIT tools** — after confirming `edit_mit` or `delete_mit`, the function returned early without calling `sendToolResult`, so the model never received a tool result and the conversation died. Fix: add sendToolResult call in the MIT branch of `handleToolConfirm`, same pattern as the OKR branch.

**OKR confirm passed stale state to sendToolResult** — `applyOKRTool(state, ...)` returned `next` but `sendToolResult` was called with `state` (pre-mutation). The model's follow-up saw outdated OKR data. Fix: pass `next` to `sendToolResult`.

**Card replaced before sendToolResult resolved** — ToolProposalCard was replaced with a summary bubble before `sendToolResult` completed, making it impossible to implement the "reset to cancelled state on error" AC. Fix: replace the card AFTER the await, not before.
