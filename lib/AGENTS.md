# LIB — Quick Sheet

Purpose: shared TS utilities for web/api/worker.

Layout highlights: auth/ (JWT + verification), errors/ (AppError + codes), providers/ (adapters), transfers/ (chunked IO), vault/ (encrypted creds), redis/ + queue/, apiClient.ts, types.ts.

Rules: strict TS; avoid cross-module leaks and circular deps; encryption via AES-256-GCM; Redis counters with atomic INCRBY/DECRBY; never store plaintext credentials (always vault).

Patterns: adapter-based providers, centralized error codes, singleton-style utilities where appropriate.
