# Mistakes & Dead Ends

## YYYY-MM-DD — [title]
- what was tried:
- why it failed:
- do not attempt:
- agent:

## 2026-03-02 — Plain task IDs in state files
- what was tried: Persisting task state with only numeric IDs (for example `1.1`) without gate context.
- why it failed: IDs are reused in multiple gates, causing collisions and incorrect status/commit attribution.
- do not attempt: Do not key state/history by numeric ID alone; always use `id@gate`.
- agent: codex

## 2026-03-03 — Missing `.context/task_locks` reported as "already claimed"
- what was tried: Running `./agent-coord.sh claim_task <id@gate>` before `.context/task_locks` existed.
- why it failed: `mkdir` failed on missing parent path, but script mapped all failures to "already claimed", causing false lock conflicts.
- do not attempt: Do not assume claim failures are real conflicts unless lock directory and `meta.json` exist; initialize lock directories first.
- agent: codex

## 2026-03-03 — Stale local roadmap view caused false "task not found" on UI hold IDs
- what was tried: Claiming `UI-P1-T02@HOLD-UI-2026-03-02` and `UI-P1-T05@HOLD-UI-2026-03-02` from a node that had not pulled latest roadmap/task-state updates.
- why it failed: Local task parser only recognized prior `sprint.task@gate` set and lacked newly added hold-task IDs.
- do not attempt: Do not claim tasks before `git pull --rebase` and re-reading `docs/roadmap-v4.3.md` + `docs/sprints-task-dashboard.md`.
- agent: codex

## 2026-03-03 — SSH heredoc quoting corrupted TypeScript edits
- what was tried: Rewriting TS files over SSH with nested quote-sensitive heredocs inside shell one-liners.
- why it failed: Shell interpolation stripped string literals/template markers, producing invalid TypeScript and duplicated blocks.
- do not attempt: Do not use nested/partially quoted heredocs for TS edits over SSH; use fully single-quoted heredocs piped to SSH or direct patch tooling.
- agent: codex

## 2026-03-03 — 2FA task state falsely marked done from metrics bookkeeping
- what was tried: Marking roadmap/metrics updates in a separate commit while 2FA locks were transitioning caused `2.13@2FA-1` and `2.14@2FA-1` to inherit done state in generated monitoring files.
- why it failed: Task completion metadata was recorded without corresponding implementation completion commits for those task keys.
- do not attempt: Do not close unrelated running tasks during bulk metrics/roadmap refresh; explicitly pass `--planned/--running` for protected in-flight tasks.
- agent: codex

## 2026-03-03 — claim_task used free-text agent field instead of canonical agent name
- what was tried: Claiming tasks with descriptive text in the `<agent>` position (for example `BullMQ background job queue for async transfers`) instead of canonical agent IDs.
- why it failed: Lock metadata no longer maps cleanly to agent dashboards/ownership attribution and complicates compliance reporting.
- do not attempt: Always pass canonical agent names (`OpenCode`, `ClaudeCode`, `Gemini`, `Codex`) in `claim_task`; put descriptions in commit/note text instead.
- agent: codex

## 2026-03-03 — 2FA setup route failed from broken API import paths + secret scan
- what was tried: Calling `/api/auth/2fa/setup` from settings UI while routes imported auth libs using deep relative paths and returned raw `secret` in response.
- why it failed: Relative paths from `app/api/auth/2fa/*` did not resolve consistently, and `withSecurityScan` flagged the raw secret and threw in non-production, causing setup `500` and no QR render.
- do not attempt: Do not use brittle deep relative imports in API routes (`../../../../...`); prefer `@/` aliases. Do not include raw TOTP secrets in scanned JSON responses.
- agent: codex

## 2026-03-03 — Context Lint workflow assumed `rg` exists on runner
- what was tried: Running `lint-context.sh` in GitHub Actions without an explicit `ripgrep` install step.
- why it failed: The script shells out to `rg` for every validation rule; on runners missing `rg`, the job fails before checks run.
- do not attempt: Do not rely on preinstalled runner tooling for required shell dependencies; install `ripgrep` explicitly in workflow.
- agent: codex

## 2026-03-03 — Web app routes imported worker queue modules outside web build context
- what was tried: Importing `../../../../worker/queues/*` directly from `web/app/api/transfers` and `web/app/api/rate-limits`.
- why it failed: The web image builds with Docker context `../web`, so sibling `worker/` files and worker-only deps (`bullmq`) are not available during `next build`.
- do not attempt: Do not import `../worker` runtime modules from web routes; keep web route dependencies inside `web/` (or proxy to API service).
- agent: codex

## 2026-03-03 — Playwright preflight assumed `/api/health` must return 2xx
- what was tried: Global setup only checked `${API_BASE_URL}/api/health` and required `response.ok`.
- why it failed: Current API auth behavior returns `401` for `/api/health` without credentials even when API is healthy, causing false startup failures.
- do not attempt: Do not gate API readiness on 2xx from auth-protected health endpoints; probe `/health` first and treat `/api/health` 401 as reachability.
- agent: codex
