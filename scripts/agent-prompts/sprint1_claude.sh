#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
You are starting Sprint 1 for CacheFlow.

Agent: ClaudeCode
Sprint: 1
Repo: /home/sanjay/cacheflow_work

Fast session start (compact):
1) git pull --rebase
2) Run `agent-preflight`
3) Read STATUS.md fully
4) Check `git log --oneline -10`
5) Read AGENTS.md; load `.context/decisions.md`, `.context/patterns.md`, `.context/mistakes.md`, `.context/dependencies.md` lazily only when relevant to files being touched
6) Read `docs/sprints/sprint-1.md` and work only assigned task keys below
7) Claim each task key before touching files:
   - ./agent-coord.sh claim_task <task_key> ClaudeCode "$(hostname)"
   - ./agent-coord.sh get_active_tasks
8) For unplanned file touches:
   - ./agent-coord.sh log_change <file> <reason>

Assigned task keys:
- 1.17@AUTH-1
- 1.6@AUTH-3
- 1.8@MODAL-1
- 1.9@MODAL-1
- 1.10@MODAL-1

Execution rules:
- Do not touch production systems.
- No scope creep outside assigned task keys.
- Read contracts from OpenCode before dependent implementation.
- Keep action/state behavior consistent across all modal entry points.
- If interface/architecture changes are needed, read relevant `.context/*` entries first, then append updates.

On completion of each task key:
- Stage only task-related files (`git add <files>`)
- Run:
  done-task <task_key> --test "<targeted test command>" --commit "<commit message>"
- If only one active lock exists, task key may be omitted:
  done-task --test "<targeted test command>" --commit "<commit message>"
- Codex finalizes shared status/dashboard/metrics updates after release.

Session end:
1) Move Active -> Last Session in STATUS.md
2) Add unfinished items to Queue
3) Commit STATUS.md with: git commit -m "chore: update status"
4) git push
PROMPT
