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
