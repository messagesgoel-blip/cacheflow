# WORKER — Quick Sheet

Purpose: BullMQ workers for sync, recovery, and maintenance.

Layout: src/sync-worker.ts entrypoint; src/tasks/* individual jobs; src/utils/* helpers; tests/ for unit coverage.

Musts: graceful shutdown, idempotent tasks, strong logging, per-provider rate limiting/queues, timeouts around network/file ops.

Hot tasks: conflict-resolution, validation, maintenance cleanup; treat large transfers with chunked/resume logic.

Avoid: holding locks long, blocking calls without timeout, in-memory-only state for transfers.

Branch policy note: For the next batch onward, use `CAC` issue prefix for new branches (e.g., `feat/CAC-{issue-id}-{short-description}`); do not create new `LIN-*` branches.
Worktree rule: each agent must use a dedicated git worktree path and never share the same worktree with another agent.
