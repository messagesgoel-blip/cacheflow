# Sprint 0 Tasks

| ID | Description | Files | Agent | Gates |
| --- | --- | --- | --- | --- |
| 0.1 | Define and commit ProviderAdapter interface — all adapters implement this | /lib/providers/ProviderAdapter.interface.ts, /lib/providers/types.ts | ★ CODEX (Master) | AUTH-1, TRANSFER-1, ZERODISK-1 |
| 0.2 | Define AppError taxonomy and ErrorCode enum | /lib/errors/AppError.ts, /lib/errors/ErrorCode.ts | ◈ OpenCode | AUTH-1, TRANSFER-1 |
| 0.3 | Define complete Prisma schema baseline — all tables, all relationships | /prisma/schema.prisma, /docs/architecture/data-model.md | ◈ OpenCode | AUTH-2, TRANSFER-1, VAULT-1 |
| 0.4 | Allocate Redis namespaces — document and enforce db separation | /docs/architecture/redis-namespaces.md, /lib/redis/client.ts (per-db connections) | ◈ OpenCode | SSE-1, TRANSFER-1 |
| 0.5 | Define streaming pipeline pattern — pipeline() + backpressure strategy | /lib/transfers/streamPipeline.ts, /tests/unit/streamPipeline.test.ts | ◈ OpenCode | TRANSFER-1, ZERODISK-1 |
| 0.6 | Define singleton refresh promise pattern — prevent concurrent token refresh race | /lib/auth/refreshGuard.ts, /docs/architecture/auth-patterns.md, /tests/unit/refreshGuard.test.ts | ◈ OpenCode | AUTH-4 |
| 0.7 | Define BullMQ → SSE bridge via Redis pub/sub | /lib/transfers/progressBridge.ts, /docs/architecture/sse-pattern.md | ◈ OpenCode | SSE-1 |

