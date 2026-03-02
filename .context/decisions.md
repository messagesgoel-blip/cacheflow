# Decisions

## YYYY-MM-DD — [title]
- decision:
- rationale:
- alternatives rejected:
- agent:

## 2026-03-02 — Use `id@gate` as canonical task key for sprint tracking
- decision: Treat roadmap tasks as `task_id@gate` in metrics, task state, and lock operations.
- rationale: Numeric task IDs repeat across gates, and unique keys are required for accurate status, commit metadata, and lock ownership.
- alternatives rejected: Keep plain numeric IDs only; this causes collisions and ambiguous ownership in dashboards/automation.
- agent: codex
