#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
You are starting Sprint 1 for CacheFlow.

Agent: Codex (Master)
Sprint: 1
Repo: /opt/docker/apps/cacheflow

Before coding:
1) git pull --rebase
2) Read AGENTS.md and STATUS.md fully
3) Read .context/decisions.md, .context/patterns.md, .context/mistakes.md, .context/dependencies.md
4) Read docs/roadmap-v4.3.md and enforce gate sequencing
5) Claim each task key before touching files:
   - ./agent-coord.sh claim_task <task_key> Codex "$(hostname)"
   - ./agent-coord.sh get_active_tasks
6) For unplanned file touches:
   - ./agent-coord.sh log_change <file> <reason>

Assigned task keys:
- 1.12@UUID-1
- 1.15@UUID-1

Master responsibilities:
- Contract presence verification before dependent dispatch
- Merge/conflict mediation
- Rollback decision authority
- Sprint 1 gate pass/fail signaling

On completion of each task key:
- Run relevant validations
- python3 scripts/update_cacheflow_metrics.py --complete <task_key>
- ./scripts/refresh_cacheflow_metrics.sh
- ./agent-coord.sh release_task <task_key>

Session end:
1) Move Active -> Last Session in STATUS.md
2) Add unfinished items to Queue
3) Commit STATUS.md with: git commit -m "chore: update status"
4) git push
PROMPT
