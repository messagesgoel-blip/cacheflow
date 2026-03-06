#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
Sprint 1 — ClaudeCode — /home/sanjay/cacheflow_work

Startup: git pull --rebase; run `agent-preflight`; skim STATUS.md and docs/sprints/sprint-1.md; claim tasks via `./agent-coord.sh claim_task <task_key> ClaudeCode "$(hostname)"`.

Tasks: 1.17@AUTH-1, 1.6@AUTH-3, 1.8@MODAL-1, 1.9@MODAL-1, 1.10@MODAL-1.

Rules: stay within assigned keys; read AGENTS.md; read OpenCode contracts before dependent work; keep modal actions/state consistent; no production changes.

Finish per task: stage relevant files, `done-task <task_key> --test "<targeted test>" --commit "<message>"`; Codex will handle shared dashboard/metrics. Update STATUS.md and push.
PROMPT
