# TRANSFERS — Quick Sheet

Scope: upload/download pipeline with chunking, resume, and progress reporting.

Key files: streamTransfer.ts (core), progressBridge.ts, chunkStateManager.ts, transferManager.ts, types.ts.

Rules: chunk large files; persist chunk state for resume; emit progress events; keep provider-agnostic surface while allowing adapter hooks; validate before committing file parts; clean up on interruption.
