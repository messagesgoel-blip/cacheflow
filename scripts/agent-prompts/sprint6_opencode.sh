#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
Sprint 6 — OpenCode — /home/sanjay/cacheflow_work

Startup: git pull --rebase; run `agent-preflight`; read AGENTS.md, STATUS.md, docs/roadmap.md, and docs/sprints/sprint-6.md; coordinate with Codex before touching files under Sprint 6 umbrella tasks.

Primary Sprint 6 backend scopes:
- 6.1 backend: quota thresholds/notification plumbing and streaming remote import
- 6.2 backend: SSE event sources, worker/log routing, transfer activity APIs
- 6.3 backend: durable scheduled jobs, history persistence, bandwidth-throttle enforcement
- 6.4 backend: range handling and stream stability
- 6.5 backend: provider trash/version adapters and restore semantics
- 6.6 backend: VPS key vault, rotate/test flows, node keep-alive controls

Rules:
- Sprint 6 task keys remain cross-agent; do not claim a Sprint 6 lock unless Codex has assigned the exact task key or updated task-state.
- Stay within backend/API/DB scope from AGENTS.md.
- Write contracts for outputs consumed by ClaudeCode/Gemini.
- Do not update shared dashboard or monitoring files directly.

Finish per assigned scope: run targeted backend/test validation, stage only relevant files, then use `done-task <task_key> --test "<targeted test>" --commit "<message>"` when operating on a claimed task key.
PROMPT
