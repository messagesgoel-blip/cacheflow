# Decisions

## YYYY-MM-DD — [title]
- decision:
- rationale:
- alternatives rejected:
- files:
- commit:
- agent:

## 2026-03-02 — Use `id@gate` as canonical task key for sprint tracking
- decision: Treat roadmap tasks as `task_id@gate` in metrics, task state, and lock operations.
- rationale: Numeric task IDs repeat across gates, and unique keys are required for accurate status, commit metadata, and lock ownership.
- alternatives rejected: Keep plain numeric IDs only; this causes collisions and ambiguous ownership in dashboards/automation.
- files: monitoring/cacheflow_task_state.yaml, monitoring/cacheflow_metrics.yaml, scripts/update_cacheflow_metrics.py
- commit: 6e25175
- agent: codex

## 2026-03-02 — Agent name alias: `claude` = `ClaudeCode`
- decision: Use `claude` as alias for `ClaudeCode` when claiming tasks via agent-coord.sh.
- rationale: Shorter alias for convenience; both map to same agent identity in task locks.
- alternatives rejected: Keep strict full-name only input and require manual correction on mismatch.
- files: agent-coord.sh, .context/task_locks/*
- commit: a24bcfb5ac1a
- agent: sanjay

## 2026-03-02 — Security baseline: remove defaults, harden secrets (SEC-1)
- decision: Require DB_PASSWORD and CREDENTIAL_ENCRYPTION_KEY environment variables; remove hardcoded defaults.
- rationale: Hardcoded default passwords and encryption keys are a critical security vulnerability. Production must explicitly configure secrets.
- alternatives rejected: Keep defaults with warnings - insufficient; defaults often remain in place in production.
- files: api/src/middleware/auth.js, api/src/routes/tokens.js
- commit: a083219
- agent: ClaudeCode

## 2026-03-03 — Add `OPS-QA-WATCH@QA-1` to keep Gemini productive during dependency blocks
- decision: Track a dedicated QA watcher task under gate `QA-1` for dependency-unblock monitoring, blocker triage, and immediate E2E pickup when prerequisites merge.
- rationale: Prevent idle agent time and keep continuous QA feedback while feature dependencies are unmerged.
- alternatives rejected: Passive wait-only mode for Gemini; this delays blocker visibility and slows handoff timing.
- files: docs/roadmap-v4.3.md, docs/sprints-task-dashboard.md, monitoring/cacheflow_task_state.yaml, monitoring/cacheflow_metrics.yaml
- commit: pending
- agent: codex

## 2026-03-03 — Use remotes-backed connections + remoteId hydration for QA-seeded accounts
- decision: Treat `/api/remotes` as canonical source for frontend connections, hydrate `tokenManager` entries with `remoteId`, and proxy provider requests with bearer auth against `/api/remotes/:id/proxy`.
- rationale: QA seeded accounts are stored in `user_remotes`; relying on `/api/tokens` and local token-only state left providers visible but file operations failing with empty views or `SESSION_EXPIRED`.
- alternatives rejected: Keep `/api/tokens`-based connection mapping; keep Next cookie-refresh proxy as primary path for seeded remotes.
- files: web/app/api/connections/route.ts, web/components/UnifiedFileBrowser.tsx, web/lib/apiClient.ts, web/lib/providers/StorageProvider.ts
- commit: pending
- agent: codex

## 2026-03-03 — Integrate March gap-analysis controls into roadmap baseline
- decision: Add task `0.9` (stateful deployment guard) and task `0.4a` (ErrorCode→UI action contract) as canonical roadmap tasks, and amend `2.6`, `2.7`, `4.7`, `4.10`, and `5.7` with CSP, proxy, 2FA-scope, and naming/disclaimer requirements.
- rationale: These gaps carry operational/security/legal risk if left implicit; codifying them in roadmap + sprint board + generated task state prevents drift across agents.
- alternatives rejected: Keep requirements only in ad-hoc prompt text; this would not propagate into monitoring/task-state or dispatch artifacts.
- files: docs/roadmap-v4.3.md, docs/sprints-task-dashboard.md, monitoring/cacheflow_task_state.yaml, monitoring/cacheflow_metrics.yaml, monitoring/cacheflow_sprint_tasks.yaml, monitoring/task_history.yaml
- commit: pending
- agent: codex

## 2026-03-03 — Keep TOTP secret server-side during setup response
- decision: `/api/auth/2fa/setup` sets `totpSecret` in an `httpOnly` cookie and returns only QR + backup codes (no raw secret in JSON).
- rationale: `withSecurityScan` rejects secret leakage in API payloads, which otherwise hard-fails setup and blocks 2FA UI flows.
- alternatives rejected: Returning raw secret to client; bypassing security scan.
- files: web/app/api/auth/2fa/setup/route.ts, web/components/settings/TwoFAPanel.tsx
- commit: pending
- agent: codex

## 2026-03-03 — Keep web API routes isolated from worker runtime modules
- decision: `/web/app/api/transfers` and `/web/app/api/rate-limits` now import queue adapters from `web/lib/transfer/*` rather than `../worker/queues/*`.
- rationale: The web container builds from `../web` context only, so cross-context imports into `worker/` cause module resolution failures and pull in unavailable worker-only dependencies.
- alternatives rejected: Keeping worker imports with corrected relative paths; adding worker queue dependencies to web/root build graph.
- files: web/app/api/transfers/route.ts, web/app/api/rate-limits/route.ts, web/lib/transfer/jobQueue.ts, web/lib/transfer/rateLimitQueue.ts
- commit: pending
- agent: codex

## 2026-03-03 — Worker completion protocol enforced via hook + finish script
- decision: Enforce Codex-owned dashboard/metrics files with a repo pre-commit hook for non-Codex agents, and standardize worker completion on `scripts/finish_task.sh`.
- rationale: Agents were applying completion steps inconsistently (commit/push/release/metrics updates), creating lock/status drift and duplicate dashboard edits.
- alternatives rejected: Prompt-only instructions without local guardrails; letting each agent update monitoring files directly.
- files: .githooks/pre-commit, scripts/finish_task.sh, scripts/start_sprint.sh, scripts/sync_status_running_sprint.py, scripts/agent-prompts/*
- commit: pending
- agent: codex

## 2026-03-03 — Add `done-task` shortcut as canonical worker finish entrypoint
- decision: Provide `done-task`/`dt` wrapper for worker completion, with optional task auto-detection from active lock metadata.
- rationale: `finish_task.sh` is reliable but still verbose; reducing it to one command increases protocol compliance without relaxing safeguards.
- alternatives rejected: Keep only `finish_task.sh` and rely on manual task-key entry every time.
- files: scripts/done_task.sh, scripts/start_sprint.sh, scripts/sync_status_running_sprint.py, scripts/agent-prompts/*, docs/prompts/sprint-1-startup-all-agents.md
- commit: pending
- agent: codex
