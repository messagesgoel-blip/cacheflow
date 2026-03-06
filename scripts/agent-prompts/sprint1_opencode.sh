#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
Sprint 1 — OpenCode — /home/sanjay/cacheflow_work

Startup: git pull --rebase; run `agent-preflight`; skim STATUS.md and docs/sprints/sprint-1.md; claim tasks via `./agent-coord.sh claim_task <task_key> OpenCode "$(hostname)"`.

Tasks: 1.1@AUTH-1, 1.5@AUTH-1, 1.2@AUTH-2, 1.4@AUTH-2, 1.18@AUTH-2, 1.3@AUTH-3, 1.1@AUTH-4, 1.13@UUID-1, 1.14@UUID-1, 1.16@SYNC-1, 1.4@SEC-1, 1.18@SEC-1.

Rules: stay within assigned keys; follow AGENTS.md; write contracts for outputs consumed by ClaudeCode/Gemini; avoid production changes; keep API shapes aligned to contracts.

Finish per task: stage relevant files, `done-task <task_key> --test "<targeted test>" --commit "<message>"`; Codex handles shared dashboard/metrics. Update STATUS.md and push.
PROMPT
