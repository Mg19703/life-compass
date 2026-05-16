# Life Compass

A personal life planning and coaching tool built with React + TypeScript. Implements the full OKR hierarchy from EWMBA 258 (Becoming Superhuman) — from deathbed goals down to daily MITs — with an AI coach grounded in the class frameworks.

Built entirely using Claude Code and a team of specialized AI agents.

---

## What it does

- **Setup** — define your life dimensions, deathbed goals mapped to specific dimensions, and annual OKRs
- **Plan** — build your full OKR tree: Annual → Quarterly → Monthly KRs → Weekly Initiatives
- **Today** — add up to 10 Most Important Tasks daily, each optionally linked to a weekly initiative. Break any MIT into subtasks. Mark each as Done (and undo it), Carry Forward, or Drop. Log mood, exercise, and a daily reflection.
- **Coach** — AI coach with full context of your goals, MITs, OKR tree, and habits. Ask questions in natural language or use structured actions: Suggest MITs, Weekly Review, or ask the coach to directly create, edit, or delete OKRs and MITs — each proposed change is shown as a reviewable card before anything is applied.
- **Habits** — track daily recurring habits, organized by life dimension, with streak calculations.
- **Review** — weekly MIT completion, mood trends, monthly OKR progress, dimension weight vs actual time distribution, and deathbed goal alignment by dimension.

---

## Frameworks baked in

From EWMBA 258 — Becoming Superhuman:

- **OKR Hierarchy** — Annual → Quarterly → Monthly → Weekly → Daily. Every MIT traces back to a deathbed goal.
- **MIT Framework** — Most Important Tasks daily, each traceable to a weekly initiative and OKR. Incomplete MITs carry forward (Zeigarnik Effect).
- **FOCUS Protocol**, **Mental Contrasting**, **Yerkes-Dodson**, **Type 1 vs Type 2 decisions**, **MVOs**, **Anti-perfectionism** — surfaced by the coach when contextually relevant.

---

## Setup

### Prerequisites
- Node.js 18+
- An Anthropic API key (for the Coach tab) — get one at [console.anthropic.com](https://console.anthropic.com)

### Run locally

```bash
git clone https://github.com/Mg19703/life-compass.git
cd life-compass
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### First run
1. Go to the **Setup** tab
2. Enter your name and role
3. Fill in your deathbed goals and map each to a life dimension
4. Enter your Anthropic API key
5. Go to **Plan** and build your OKR tree down to weekly initiatives
6. Come back to **Today** and add your first MITs

---

## Stack

- React + TypeScript + Vite
- localStorage for persistence (schema versioned with migrations)
- Anthropic Claude API for the Coach tab (direct browser fetch, no proxy)
- No backend, no database, no auth — runs entirely in your browser

---

## Status

**v3 complete. 65 stories shipped across 18 epics.**

**v1:** Setup, Plan (full OKR tree), Today (MITs, carryover, daily log), Coach (context-aware AI, 7 frameworks), Review (weekly completion, mood trends, OKR progress, dimension distribution).

**v2:** Habits tab (daily tracking, streaks, archive), streak summary on Today tab, Coach structured actions (Suggest MITs, Weekly Review, confirm-before-apply proposal cards), deathbed goal alignment in Review tab, UI polish.

**v3:**
- **MIT subtasks** — break any MIT into up to 10 checkbox sub-items; badge shows X/Y progress; panel collapses per card; subtasks carry forward with the MIT (completed ones left behind)
- **Initiative picker** — custom popover replaces native select; grouped by Dimension → KR → Initiative with sticky headers, keyboard navigation, and ARIA listbox; links MITs to weekly initiatives at creation and edit time
- **Tab bar MIT count** — live completed/total badge on the Today tab
- **Coach tool-calling** — ask the coach to create, edit, or delete OKRs (Annual Goals, Quarterly Objectives, Monthly KRs) and today's MITs; each proposed action surfaces as a reviewable card with a two-step confirm for destructive operations; coach receives stable IDs for all current-period OKRs and today's MITs
- **Deathbed mapping** — explicitly assign each deathbed goal to a life dimension in Setup; Review tab computes alignment from explicit mappings rather than positional defaults
- **MIT cap raised to 10** — up from 3
- **Undo MITs** — click a checked MIT to restore it to pending; dropped MITs get an ↩ button

---

## Note on API keys

Your Anthropic API key is stored in your browser's localStorage only. It is never sent anywhere except directly to the Anthropic API. Do not commit it to any file.
