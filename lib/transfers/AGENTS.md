# TRANSFERS KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
File transfer operations including uploads, downloads, and progress tracking. Handles chunked transfers and resume capability.

## STRUCTURE
```
./lib/transfers/
├── streamTransfer.ts        # Core transfer implementation
├── progressBridge.ts        # Progress tracking and notification
├── chunkStateManager.ts     # Chunk upload/download state management
├── transferManager.ts       # Transfer orchestration
└── types.ts                 # Transfer-related type definitions
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Core Logic | streamTransfer.ts | Main transfer implementation |
| Progress Tracking | progressBridge.ts | Real-time progress updates |
| Chunk Management | chunkStateManager.ts | Resume capability for large files |
| Orchestration | transferManager.ts | Transfer lifecycle management |

## CONVENTIONS
- Chunked transfers for files >100MB
- Resumable uploads with state persistence
- Real-time progress updates via event emitters
- Provider-agnostic transfer interface
- Atomic operations to prevent corruption

## ANTI-PATTERNS (THIS PROJECT)
- Never interrupt transfers without cleanup
- Don't store transfer state in memory only
- Avoid partial file commits without validation

## UNIQUE STYLES
- State machine pattern for transfer lifecycle
- Progress bridge for real-time UI updates
- Chunked upload with resume capability
- Provider-agnostic interface with provider-specific implementations