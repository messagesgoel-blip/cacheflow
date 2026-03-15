# SCRIPTS — Quick Sheet

Scope: orchestration and utility scripts in scripts/.

Key files: orchestrate.ts (gate + sprint automation), recover.ts (rollback), lib/ (shared helpers), agent-prompts/ (prompt templates), update_cacheflow_metrics.py.

Rules: keep scripts idempotent; log clearly; check port/process state before destructive actions; prefer small patch updates over rewrites.

Branch policy note: For the next batch onward, use `CAC` issue prefix for new branches (e.g., `feat/CAC-{issue-id}-{short-description}`); do not create new `LIN-*` branches.
Worktree rule: each agent must use a dedicated git worktree path and never share the same worktree with another agent.
