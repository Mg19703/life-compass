---
name: project-coach-tab-sprint
description: Privacy and security review for Life Compass Coach tab — first network-connected feature. Reviewed pre-build May 2026.
metadata:
  type: project
---

Coach tab sprint introduces direct fetch() to Anthropic API (api.anthropic.com/v1/messages). Sends full AppState-derived context: name, role, bio, deathbedGoals (7 strings), 30-day MIT history, 30-day mood/exercise logs, free-text reflections, task history. API key in localStorage (known, accepted risk for single-user personal desktop app).

Key facts established at review:
- No server, no accounts, no analytics, no third-party SDKs
- Chat history is component-local state only — never persisted
- Request body logged at debug level with key redacted (per spec)
- API key never logged (per spec)
- Data flow: user device → Anthropic API only

**Why:** First and only network egress in the app. All prior features were fully local. Anthropic receives sensitive personal data (mental health indicators via mood scores, deathbed goals, reflections).

**How to apply:** Any future feature adding network calls must get a fresh review. The localStorage API key risk is pre-accepted — do not re-flag unless distribution scope changes (e.g., if app moves from personal to multi-user or packaged for distribution).

Blockers identified at review:
1. No pre-flight user disclosure that personal data (including mood/health data) leaves the device
2. No request timeout — hung fetch blocks the UI indefinitely
3. Error messages rendered inline risk exposing raw API error bodies (which may echo back request fragments)
4. Debug-level logging of request body needs enforcement, not just spec intent — verify no production logger captures it

Suggestions (non-blocking):
- Truncate 30-day windows to reduce data minimization exposure
- Show Anthropic's data retention terms to user before first use
- Add abort controller for user-cancellable requests
