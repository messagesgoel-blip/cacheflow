#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
Sprint 1 — Codex (Master) — /home/sanjay/cacheflow_work

Startup: git pull --rebase; run `agent-preflight`; skim STATUS.md and docs/sprints/sprint-1.md for gate order; claim each task with `./agent-coord.sh claim_task <task_key> Codex "$(hostname)"`.

Tasks: 1.12@UUID-1, 1.15@UUID-1.

Guardrails: stay in scope; verify contracts exist before dependent dispatch; mediate merges/conflicts; do not touch production; read AGENTS.md for domain rules.

Finish per task: run validations, `python3 scripts/update_cacheflow_metrics.py --complete <task_key>`, `./scripts/refresh_cacheflow_metrics.sh`, then `./agent-coord.sh release_task <task_key>`. Update STATUS.md (Active → Last Session, Queue) and push.
PROMPT
