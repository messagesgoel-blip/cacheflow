#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
Sprint 1 — Gemini (QA) — /home/sanjay/cacheflow_work

Startup: git pull --rebase; run `agent-preflight`; skim STATUS.md and docs/sprints/sprint-1.md; claim tasks with `./agent-coord.sh claim_task <task_key> Gemini "$(hostname)"`.

Tasks: 1.7@AUTH-1, 1.19@AUTH-2, 1.11@MODAL-1.

Rules: stay in QA scope; follow AGENTS.md; produce failure artifacts (screenshots/logs); no production systems; keep within assigned keys.

Finish per task: `done-task <task_key> --test "<targeted test>" --commit "<message>"`; Codex handles shared dashboard/metrics. Update STATUS.md and push.
PROMPT
