# Redis Namespaces

## Overview

CacheFlow uses Redis for multiple distinct purposes. To prevent cross-contamination of data and ensure operational isolation, each concern uses a dedicated Redis database (db index).

## Database Allocation

| DB Index | Namespace     | Purpose                                    | Key Prefixes         |
|----------|---------------|--------------------------------------------|----------------------|
| 0        | `cache`       | General caching, session data             | `cache:`, `sess:`    |
| 1        | `sse`         | Server-Sent Events stream state            | `sse:`, `stream:`    |
| 2        | `transfer`    | Transfer queue, quota tracking             | `transfer:`, `quota:`|
| 3        | `rate_limit`  | Rate limiting counters and windows          | `ratelimit:`        |
| 4        | `workers`    | Background job state, worker coordination  | `worker:`, `queue:`  |

## Gate Requirements

- **SSE-1**: SSE streams must use DB 1 (`sse` namespace) exclusively
- **TRANSFER-1**: Transfer operations must use DB 2 (`transfer` namespace) exclusively

## Implementation

All Redis connections MUST be created through `lib/redis/client.ts` which enforces database selection:

```typescript
import { getRedisClient } from 'lib/redis/client';

const sseClient = getRedisClient('sse');    // DB 1
const transferClient = getRedisClient('transfer'); // DB 2
```

## Migration Notes

Existing direct Redis connections should be migrated to use the namespaced client. The client validates namespace selection and rejects invalid configurations in development.
