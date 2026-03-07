#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
Sprint 6 — Codex (Cross-agent) — /home/sanjay/cacheflow_work

Startup: git pull --rebase; run `agent-preflight`; read AGENTS.md, STATUS.md, docs/roadmap.md, docs/sprints/sprint-6.md, and docs/sprints-task-dashboard.md; sync the running queue before dispatch.

Sprint 6 umbrella task keys:
- 6.1@QUOTA-1+RIMPORT-1
- 6.2@LOGS-1
- 6.3@SCHED-2+THROTTLE-1
- 6.4@MEDIA-1+STREAM-1
- 6.5@VERSION-1+TRASH-1
- 6.6@KEYS-1+NODE-1

Codex responsibilities:
- Claim and sequence Sprint 6 umbrella task locks.
- Split implementation by file scope across OpenCode, ClaudeCode, and Gemini.
- Verify dependency contracts before worker dispatch.
- Keep the release blocker green before advancing Sprint 6 execution.
- Own dashboard, task-state, and metrics finalization after worker completion.

Finish per task key: run validations, `python3 scripts/update_cacheflow_metrics.py --complete <task_key>`, `./scripts/refresh_cacheflow_metrics.sh`, then release the lock after merge/verification.
PROMPT
