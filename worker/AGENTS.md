# WORKER KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
Background sync workers for CacheFlow. Handles file synchronization between local cache and cloud providers, conflict resolution, and maintenance tasks.

## STRUCTURE
```
./worker/
├── src/
│   ├── sync-worker.js    # Main sync worker process
│   ├── tasks/           # Individual worker tasks
│   ├── utils/           # Worker utilities
│   └── config/          # Worker configuration
├── tests/               # Worker unit tests
├── Dockerfile           # Container configuration
└── package.json         # Worker dependencies
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Sync Logic | sync-worker.js | Main synchronization algorithm |
| Scheduled Tasks | tasks/ | Periodic maintenance operations |
| Conflict Resolution | tasks/conflict-resolution.js | Handle sync conflicts |
| File Validation | tasks/validation.js | Verify file integrity |
| Maintenance | tasks/maintenance.js | Cleanup and optimization tasks |

## CONVENTIONS
- Long-running processes with graceful shutdown
- Event-driven architecture for task coordination
- Idempotent operations for fault tolerance
- Comprehensive logging for debugging
- Rate limiting for provider API calls

## ANTI-PATTERNS (THIS PROJECT)
- Never perform blocking operations without timeouts
- Don't hold locks for extended periods
- Avoid memory leaks in long-running processes

## UNIQUE STYLES
- Provider-specific rate limiting queues
- Chunked upload handling for large files
- Stale sync recovery mechanisms
- Atomic file operations to prevent corruption