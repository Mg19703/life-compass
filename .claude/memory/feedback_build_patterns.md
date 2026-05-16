---
name: feedback-build-patterns
description: "How Moe likes builds run, what to avoid, and confirmed approaches"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b6cd2d7f-c414-4c32-9a19-d843bcaa61f5
---

Use the `/sprint-plan` skill for any new story work — it runs a full pipeline (spec validation → file mapping → parallel reviews → build → QA). Never skip Phase 0 or Phase 2.

Always run `npx tsc --noEmit` after each story completes. Never batch type errors. Run `npm run build` before closing any sprint.

**Why:** Moe confirmed this workflow explicitly and re-invoked it multiple times in the v3 session. It catches ~80% of rework before build.

**How to apply:** Any time Moe says "build [stories]", invoke `/sprint-plan` rather than building ad-hoc.

Do NOT commit `.claude/` files to the Life Compass git repo. That directory contains Claude Code internal agent memory and is not app source code.

**Why:** Moe asked why it was excluded — agreed with the reasoning once explained. Keep `.claude/` out of git.

**How to apply:** When staging files for a commit in life-compass, only stage `src/`, spec `.md` files, and config files. Skip anything under `.claude/`.

When making changes across multiple stories in a sprint, build in story dependency order. Run tsc after each story, not at the end.
