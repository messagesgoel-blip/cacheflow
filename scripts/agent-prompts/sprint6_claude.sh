#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
Sprint 6 — ClaudeCode — /home/sanjay/cacheflow_work

Startup: git pull --rebase; run `agent-preflight`; read AGENTS.md, STATUS.md, docs/roadmap.md, and docs/sprints/sprint-6.md; coordinate with Codex before touching files under Sprint 6 umbrella tasks.

Primary Sprint 6 frontend scopes:
- 6.1 UI surfaces: quota alert banners, provider-capacity messaging, remote import UX polish
- 6.2 UI surfaces: terminal/log panel, activity stream presentation, SSE-fed transfer visibility
- 6.3 UI surfaces: schedules page hardening, throttle controls, history/status presentation
- 6.4 UI surfaces: media preview playback, range-aware UX, stream-state recovery
- 6.5 UI surfaces: trash page, version history panel, restore/delete flows
- 6.6 UI surfaces: VPS key-manager and lifecycle screens

Rules:
- Sprint 6 task keys remain cross-agent; do not claim a Sprint 6 lock unless Codex has assigned the exact task key or updated task-state.
- Stay within frontend/auth/UX scope from AGENTS.md.
- Read OpenCode contracts before dependent UI work.
- Do not update shared dashboard or monitoring files directly.

Finish per assigned scope: run targeted UI/Playwright validation, stage only relevant files, then use `done-task <task_key> --test "<targeted test>" --commit "<message>"` when operating on a claimed task key.
PROMPT

