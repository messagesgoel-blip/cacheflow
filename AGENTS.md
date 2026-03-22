# Cacheflow Repo Policy

Global references live in `/srv/storage/AGENTS.md`. This file defines Cacheflow-specific policy.

## Canonical Path
`/srv/storage/repo/cacheflow/`

## Issue Prefix
`CAC`

## Service Ownership
Cacheflow owns the file-manager product runtime:
- `web/` Next.js frontend
- `api/` Express API
- `worker/` BullMQ workers
- `lib/` shared auth and provider adapters

Does NOT own:
- Codero control-plane implementation
- Mathkit runtime behavior
- Cross-repo direct code imports

## Product Constraints
- Auth uses HttpOnly cookies only.
- The token vault lives in `lib/vault/tokenVault.ts`; never expose provider tokens or persist them in client storage.
- Provider adapters live in `lib/providers/`; never return stored credentials in API responses.
- Contract-changing work must update `docs/contracts/{task-id}.md`.

## Repo Layout
- `web/`: Next.js app and Playwright E2E
- `api/`: Express API
- `worker/`: BullMQ jobs
- `lib/`: shared auth and provider adapters
- `docs/contracts/`: API and task contracts
- `docs/orchestration/`: orchestration and task state docs

## Directory Guidance
- `api/`: keep handlers short and non-blocking, validate inputs, use structured errors, sanitize responses, and keep secrets or vault data out of API payloads.
- `lib/`: keep TypeScript strict, avoid circular dependencies, keep credentials encrypted via the vault, and use atomic Redis counter operations where needed.
- `lib/providers/`: keep provider-specific logic inside adapters, enforce rate limiting and backoff, normalize errors, and preserve the shared adapter contracts and registry.
- `lib/transfers/`: keep transfers chunked and resumable, emit progress, validate before committing parts, and clean up interrupted state.
- `web/`: App Router only, proxy backend API calls to `http://127.0.0.1:8100`, keep auth cookie-based, avoid client token storage, and prefer Tailwind plus existing UI primitives.
- `web/app/`: default to server components, use client components only for interactivity, and keep sensitive data off the client.
- `web/components/`: keep accessibility intact, avoid unnecessary prop drilling, and keep render work light.
- `worker/`: require graceful shutdown, idempotent jobs, strong logging, provider-aware rate limiting, and timeouts around network or file operations.
- `scripts/`: keep automation idempotent, log clearly, and check process or port state before destructive actions.

## Ownership And Gatekeepers
| Path | Owns | Gatekeeper |
|---|---|---|
| `web/*` | frontend UI/runtime | self |
| `api/*` | backend/API logic | self |
| `worker/*` | background jobs | self |
| `lib/*` | shared runtime adapters | self |
| `docs/*` | contracts/runbooks/orchestration docs | self |
| `scripts/*` | automation and shipped runtime scripts | flag before editing |
| `monitoring/*` | review and ops state wiring | flag before editing |

## Repo-Specific Do-Not-Edit
- `**/generated/**` (generated artifacts)
- `**/*.lock` manual edits (tool-managed only)
- `.next/`
- `node_modules/`
- `coverage/`
- `monitoring/*.yaml`

## Git And PR Policy
- Branch naming: `feat/<ISSUE_PREFIX>-{issue-id}-{short-description}` using this repo's issue prefix.
- Do not commit directly to protected branches (`main`, `dev`).
- Pre-commit hook must pass before any commit.
- `git commit --no-verify` is prohibited except emergency-only use.
- Emergency bypass requires commit message prefix `[EMERGENCY]` and an immediate follow-up fix commit restoring hook compliance.
- One agent = one branch = one dedicated worktree path.
- PR required before task can be marked complete.
- PR title should include the issue key when applicable.
- PR must include: linked issue, scope summary, tests run, deploy impact, and env var changes.
- Request `@coderabbitai review` and `@coderabbitai summary` on PR open.
- Do not merge with unresolved CodeRabbit blocking comments.

## Codero Integration
- Codero is the control-plane authority for finish, review, and merge orchestration.
- Cacheflow must consume Codero gate outputs and must not re-implement a parallel gate engine locally.
- If Cacheflow renders Codero gate states, non-pass states must preserve Codero reason codes and human-readable reasons.
- When using the Codero finish loop, set `CODERO_TASK_ID` before invoking `/srv/storage/shared/agent-toolkit/bin/codero-finish.sh`.

## Testing Notes
- Playwright tests live in `web/e2e` and run from `web/`.
- Type-check frontend changes before commit with `cd web && npx tsc --noEmit`.
- If behavior changes, update affected tests in the same PR.
- Common local verification: `cd web && npx tsc --noEmit` and `cd web && npx playwright test`.

## Definition Of Done
A Cacheflow task is done when required tests and gates pass, the change is committed on a task branch, the PR is opened with required context, and live-complete work is deployed from a clean git worktree.
