# Decisions

## YYYY-MM-DD — [title]
- decision:
- rationale:
- alternatives rejected:
- files:
- commit:
- agent:

## 2026-03-02 — Use `id@gate` as canonical task key for sprint tracking
- decision: Treat roadmap tasks as `task_id@gate` in metrics, task state, and lock operations.
- rationale: Numeric task IDs repeat across gates, and unique keys are required for accurate status, commit metadata, and lock ownership.
- alternatives rejected: Keep plain numeric IDs only; this causes collisions and ambiguous ownership in dashboards/automation.
- files: monitoring/cacheflow_task_state.yaml, monitoring/cacheflow_metrics.yaml, scripts/update_cacheflow_metrics.py
- commit: 6e25175
- agent: codex

## 2026-03-02 — Agent name alias: `claude` = `ClaudeCode`
- decision: Use `claude` as alias for `ClaudeCode` when claiming tasks via agent-coord.sh.
- rationale: Shorter alias for convenience; both map to same agent identity in task locks.
- alternatives rejected: Keep strict full-name only input and require manual correction on mismatch.
- files: agent-coord.sh, .context/task_locks/*
- commit: a24bcfb5ac1a
- agent: sanjay

## 2026-03-02 — Security baseline: remove defaults, harden secrets (SEC-1)
- decision: Require DB_PASSWORD and CREDENTIAL_ENCRYPTION_KEY environment variables; remove hardcoded defaults.
- rationale: Hardcoded default passwords and encryption keys are a critical security vulnerability. Production must explicitly configure secrets.
- alternatives rejected: Keep defaults with warnings - insufficient; defaults often remain in place in production.
- files: api/src/middleware/auth.js, api/src/routes/tokens.js
- commit: a083219
- agent: ClaudeCode

## 2026-03-03 — Add `OPS-QA-WATCH@QA-1` to keep Gemini productive during dependency blocks
- decision: Track a dedicated QA watcher task under gate `QA-1` for dependency-unblock monitoring, blocker triage, and immediate E2E pickup when prerequisites merge.
- rationale: Prevent idle agent time and keep continuous QA feedback while feature dependencies are unmerged.
- alternatives rejected: Passive wait-only mode for Gemini; this delays blocker visibility and slows handoff timing.
- files: docs/roadmap-v4.3.md, docs/sprints-task-dashboard.md, monitoring/cacheflow_task_state.yaml, monitoring/cacheflow_metrics.yaml
- commit: pending
- agent: codex
