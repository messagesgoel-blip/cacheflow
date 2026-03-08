# SSE Pattern

## Overview

Server-Sent Events (SSE) provides unidirectional server-to-client communication for real-time progress updates. CacheFlow uses SSE to deliver BullMQ job progress to connected clients.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   BullMQ Worker │────▶│ ProgressBridge  │────▶│   Redis Pub/Sub │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                  ┌─────────────────┐
                                                  │  Redis Channel  │
                                                  └─────────────────┘
                                                          │
                                                          ▼
                                                  ┌─────────────────┐
                                                  │  SSE Endpoint   │
                                                  └─────────────────┘
                                                          │
                                                          ▼
                                                  ┌─────────────────┐
                                                  │     Client      │
                                                  └─────────────────┘
```

## Components

### ProgressBridge

Location: `lib/transfers/progressBridge.ts`

The `ProgressBridge` class bridges BullMQ progress events to SSE streams:

- Subscribes to BullMQ job progress via Redis pub/sub
- Publishes progress updates to SSE-ready channels
- Manages subscriber lifecycle for connected clients

**Key Methods:**

| Method | Description |
|--------|-------------|
| `initialize()` | Set up Redis pub/sub connections |
| `publishProgress(update)` | Publish a progress update |
| `subscribe(subscriber)` | Subscribe to progress updates |
| `subscribeToJob(userId, jobId, onProgress)` | Subscribe to specific job |
| `subscribeToUser(userId, onProgress)` | Subscribe to all user jobs |

### Redis Channel Design

Progress updates use Redis DB 1 (SSE namespace) with channel prefixes:

| Channel | Purpose |
|---------|---------|
| `progress:transfer` | Transfer job progress |
| `progress:rate_limit` | Rate limit job progress |

### ProgressUpdate Schema

```typescript
interface ProgressUpdate {
  jobId: string;
  jobType: 'transfer' | 'rate_limit';
  userId: string;
  progress: number | Record<string, unknown>;
  status: 'progress' | 'completed' | 'failed';
  timestamp: number;
  data?: TransferJobData;
  result?: TransferJobResult;
  error?: string;
}
```

## Integration with BullMQ

Workers publish progress to the bridge:

```typescript
import { progressBridge } from 'lib/transfers/progressBridge';

worker.on('progress', async (job, progress) => {
  await progressBridge.publishTransferProgress(
    job.id,
    job.data.userId,
    progress,
    job.data
  );
});

worker.on('completed', async (job, result) => {
  await progressBridge.publishTransferComplete(
    job.id,
    job.data.userId,
    result
  );
});

worker.on('failed', async (job, error) => {
  await progressBridge.publishTransferFailed(
    job.id,
    job.data.userId,
    error.message
  );
});
```

## SSE Endpoint

Clients connect to receive real-time updates:

```typescript
// Client-side
const eventSource = new EventSource('/api/transfers/stream?jobId=123');

eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Progress:', update.progress);
};

eventSource.onerror = () => {
  console.error('SSE connection error');
};
```

## Gate Requirements

- **SSE-1**: All SSE streams must use Redis DB 1 (`sse` namespace)
- Progress updates MUST include `userId` for subscription filtering
- Clients MUST authenticate before connecting to SSE endpoints

## Error Handling

| Error | Handling |
|-------|----------|
| Redis connection lost | Auto-reconnect with exponential backoff |
| Client disconnects | Clean up subscriber from bridge |
| Invalid progress data | Log and skip message |

## Performance Considerations

1. **Channel multiplexing**: Multiple jobs can share channels by job type
2. **Subscriber cleanup**: Unsubscribe callbacks prevent memory leaks
3. **Message batching**: Consider batching for high-frequency updates

