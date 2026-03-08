# WORKER — Quick Sheet

Purpose: BullMQ workers for sync, recovery, and maintenance.

Layout: src/sync-worker.ts entrypoint; src/tasks/* individual jobs; src/utils/* helpers; tests/ for unit coverage.

Musts: graceful shutdown, idempotent tasks, strong logging, per-provider rate limiting/queues, timeouts around network/file ops.

Hot tasks: conflict-resolution, validation, maintenance cleanup; treat large transfers with chunked/resume logic.

Avoid: holding locks long, blocking calls without timeout, in-memory-only state for transfers.

