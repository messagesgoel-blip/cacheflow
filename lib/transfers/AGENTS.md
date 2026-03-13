# TRANSFERS — Quick Sheet

Scope: upload/download pipeline with chunking, resume, and progress reporting.

Key files: streamTransfer.ts (core), progressBridge.ts, chunkStateManager.ts, transferManager.ts, types.ts.

Rules: chunk large files; persist chunk state for resume; emit progress events; keep provider-agnostic surface while allowing adapter hooks; validate before committing file parts; clean up on interruption.

Branch policy note: For the next batch onward, use `CAC` issue prefix for new branches (e.g., `feat/CAC-{issue-id}-{short-description}`); do not create new `LIN-*` branches.
Worktree rule: each agent must use a dedicated git worktree path and never share the same worktree with another agent.
