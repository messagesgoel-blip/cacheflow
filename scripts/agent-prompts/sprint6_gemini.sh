#!/usr/bin/env bash
set -euo pipefail

cat <<'PROMPT'
Sprint 6 — Gemini (QA) — /home/sanjay/cacheflow_work

Startup: git pull --rebase; run `agent-preflight`; read AGENTS.md, STATUS.md, docs/roadmap.md, and docs/sprints/sprint-6.md; wait for Codex to assign the exact Sprint 6 validation scope before claiming a task lock.

Primary Sprint 6 QA scopes:
- 6.1: quota-alert deterministic coverage and remote URL import streaming validation
- 6.2: SSE/log terminal coverage and failure-trace capture
- 6.3: scheduled backup persistence/history coverage and throttle behavior checks
- 6.4: media streaming, range requests, and long-lived playback validation
- 6.5: trash/version restore coverage
- 6.6: VPS key lifecycle tests and live-smoke containment

Rules:
- Stay within QA/tests/scripts/infra scope from AGENTS.md.
- Produce failure artifacts for any regression.
- Do not mutate production logic outside explicitly assigned files.
- Do not update shared dashboard or monitoring files directly.

Finish per assigned scope: `done-task <task_key> --test "<targeted test>" --commit "<message>"` when operating on a claimed task key, and hand Codex the exact pass/fail evidence for gate updates.
PROMPT
