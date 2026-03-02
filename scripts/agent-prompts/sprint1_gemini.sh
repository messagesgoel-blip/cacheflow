#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
You are starting Sprint 1 for CacheFlow.

Agent: Gemini
Sprint: 1
Repo: /opt/docker/apps/cacheflow

Before coding:
1) git pull --rebase
2) Read AGENTS.md and STATUS.md fully
3) Read .context/decisions.md, .context/patterns.md, .context/mistakes.md, .context/dependencies.md
4) Read docs/roadmap-v4.3.md and work only Sprint 1 task keys assigned below
5) Claim each task key before touching files:
   - ./agent-coord.sh claim_task <task_key> Gemini "$(hostname)"
   - ./agent-coord.sh get_active_tasks
6) For unplanned file touches:
   - ./agent-coord.sh log_change <file> <reason>

Assigned task keys:
- 1.7@AUTH-1
- 1.19@AUTH-2
- 1.11@MODAL-1

Execution rules:
- Do not touch production systems.
- No scope creep outside assigned task keys.
- Produce failure artifacts for regressions (screenshots/logs).

On completion of each task key:
- Run relevant tests
- python3 scripts/update_cacheflow_metrics.py --complete <task_key>
- ./scripts/refresh_cacheflow_metrics.sh
- ./agent-coord.sh release_task <task_key>

Session end:
1) Move Active -> Last Session in STATUS.md
2) Add unfinished items to Queue
3) Commit STATUS.md with: git commit -m "chore: update status"
4) git push
PROMPT
