# SCRIPTS — Quick Sheet

Scope: orchestration and utility scripts in scripts/.

Key files: orchestrate.ts (gate + sprint automation), recover.ts (rollback), lib/ (shared helpers), agent-prompts/ (prompt templates), update_cacheflow_metrics.py.

Rules: keep scripts idempotent; log clearly; check port/process state before destructive actions; prefer small patch updates over rewrites.
