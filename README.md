# Life Compass

A personal life planning and coaching tool built with React + TypeScript. Implements the full OKR hierarchy from EWMBA 258 (Becoming Superhuman) — from deathbed goals down to daily MITs — with an AI coach grounded in the class frameworks.

Built entirely using Claude Code and a team of specialized AI agents.

---

## What it does

- **Setup** — define your life dimensions, deathbed goals, and annual OKRs
- **Plan** — build your full OKR tree: Annual → Quarterly → Monthly KRs → Weekly Initiatives
- **Today** — surface your 3 Most Important Tasks daily, linked to your initiatives. Mark each as Done, Carry Forward, or Drop at end of day. Log mood, exercise, and a daily reflection.
- **Coach** — AI coach with full context of your goals, MITs, and OKR tree. Grounded in 7 frameworks from EWMBA 258: MIT, FOCUS Protocol, Mental Contrasting, Yerkes-Dodson, Type 1 vs Type 2 decisions, MVOs, and anti-perfectionism.
- **Review** — weekly MIT completion, mood trends, monthly OKR progress, and dimension weight vs actual time distribution.

---

## Frameworks baked in

From EWMBA 258 — Becoming Superhuman:

- **OKR Hierarchy** — Annual → Quarterly → Monthly → Weekly → Daily. Every MIT traces back to a deathbed goal.
- **MIT Framework** — 1-3 Most Important Tasks daily. Incomplete MITs carry over (Zeigarnik Effect).

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
3. Fill in your deathbed goals (the 7 priorities exercise from class)
4. Enter your Anthropic API key
5. Go to **Plan** and build your OKR tree
6. Come back to **Today** and add your first MITs

---

## Stack

- React + TypeScript + Vite
- localStorage for persistence
- Anthropic Claude API for the Coach tab
- No backend, no database, no auth — runs entirely in your browser

---

## Built with

Claude Code + a team of specialized AI agents.

---

## Status

v2 complete. 43 stories shipped across 11 epics.

**v1 features:** Setup, Plan (full OKR tree), Today (MITs, carryover, daily log), Coach (context-aware AI grounded in 7 class frameworks), Review (weekly MIT completion, mood trends, monthly OKR progress, dimension weight distribution).

**v2 features:** Habits tab (daily habit tracking, streaks, archive), streak summary on Today tab, coach tool-calling (Suggest MITs, Weekly Review, confirm-before-apply proposal cards), deathbed goal alignment in Review tab, UI polish (shared DateNavBar, plan nesting levels, mood labels, progress bars, prompt chips).

v3 in progress: hierarchical initiative dropdown, MIT initiative editing, tab bar MIT count, coach OKR management, coach MIT edit/delete, MIT subtasks.

---

## Note on API keys

Your Anthropic API key is stored in your browser's localStorage only. It is never sent anywhere except directly to the Anthropic API. Do not commit it to any file.
