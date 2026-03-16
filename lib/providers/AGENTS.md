# PROVIDERS — Quick Sheet

Purpose: provider adapters implementing ProviderAdapter interface (20+ providers).

Key files: types.ts + ProviderAdapter.interface.ts (contract), rateLimitQueue.ts, index.ts registry, googleDrive.ts, oneDrive.ts, dropbox.ts, box/*, utils/*.

Rules: enforce rate limiting/backoff on all outbound calls; OAuth2 with refresh handling; chunked uploads for large files; normalize errors to standard codes; credentials always via vault, never returned raw.

Avoid provider-specific logic outside adapters; keep new providers conformant to interfaces and registry.

Branch policy note: For the next batch onward, use `CAC` issue prefix for new branches (e.g., `feat/CAC-{issue-id}-{short-description}`); do not create new `LIN-*` branches.
Worktree rule: each agent must use a dedicated git worktree path and never share the same worktree with another agent.
