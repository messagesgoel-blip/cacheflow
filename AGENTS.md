# CacheFlow — Agent Quick Sheet

Project: multi‑cloud file manager (Next.js frontend, Node API, Postgres + Redis). Prod host: cacheflow.goels.in.

Layout: web/ (Next.js), api/ (Express), worker/ (BullMQ), lib/ (shared adapters), docs/contracts/ (API contracts), docs/orchestration/ (sprint state).

Auth: HttpOnly cookies only; token vault in lib/vault/tokenVault.ts; never expose tokens or write them to client storage.

Providers: Google Drive, OneDrive, Box, Dropbox, Filen, WebDAV, VPS/SFTP; adapters live in lib/providers/; never return stored credentials.

Sprints & contracts: see logs/orchestrator-state.json and docs/orchestration/task-manifest.json. Every cross-agent output needs docs/contracts/{task-id}.md. Type-check before commit: cd web && npx tsc --noEmit.

Tests: Playwright in web/e2e (run from web/). Gate command: SPRINT_LIMIT=N npx ts-node scripts/orchestrate.ts --gate-only --sprint N.

Commits: pre-commit hook must pass before commit; `git commit --no-verify` is prohibited, no exceptions. If the gate is blocking incorrectly, fix the gate issue — do not bypass it. Do not commit .next/, node_modules/, coverage/, monitoring/*.yaml.

Definition of done: no change is considered done until it is tested, committed, and deployed from a clean git worktree in `/srv/storage/repo/cacheflow`. Do not treat uncommitted local changes or dirty-tree builds as done for live.
Worktree rule: each active agent must run in its own dedicated git worktree path.

## Branch Naming
All feature branches must follow: `feat/CAC-{issue-id}-{short-description}`
Example: `feat/CAC-42-oauth-token-fix`
This enables issue auto-tracking of commits against issues.
Effective immediately for the next batch onward: use `CAC` as the issue prefix and do not create new `LIN-*` branches.

## Pull Requests

## PR Policy
- All work must be on a branch following `feat/CAC-{id}-{description}`.
- A PR must be opened before any task is marked complete.
- Every PR branch must follow `feat/CAC-{issue-id}-{short-description}` so the issue tracker can associate commits with the issue.
- PR title should include the issue key when applicable.
- PR description must include:
  - linked issue
  - summary of scope
  - tests run
  - deploy impact
- On PR open, request CodeRabbit explicitly with:
  - `@coderabbitai review`
  - `@coderabbitai summary`
- CodeRabbit review must complete before the branch is eligible for merge.
- Codex must not merge a branch with unresolved CodeRabbit blocking comments.
- After requesting CodeRabbit review, lock all other follow-up work on that change until review is complete and findings are resolved or triaged.
- If behavior changes, update affected tests in the same PR.
- Do not treat a branch as done at PR open time; it is only done after tests pass, the change is committed, and it is deployed from a clean git worktree in `/srv/storage/repo/cacheflow`.

Agent scope: OpenCode → api/, lib/, worker/; ClaudeCode → web/; Gemini → tests/e2e/scripts; Sisyphus → orchestration only.

## Gate Surface Parity (Mandatory)

- Cacheflow does not implement its own gate engine/status-model stack.
- Authoritative staged gate implementation lives in Codero and is consumed by Cacheflow.
- For Cacheflow changes, integrate and display Codero gate outputs; do not fork/duplicate gate-engine logic locally.
- If Cacheflow UI/API renders Codero gate state, non-pass states (`DISABLED`, `SKIP`, `INFRA_BYPASS`) must preserve Codero reason codes and human-readable reasons.

## Orchestration Automation Compliance

- Canonical repo for live orchestration: `/srv/storage/repo/cacheflow` (do not run from stale copies).
- Start/stop/status commands:
  - `npm run orch:start`
  - `npm run orch:stop`
  - `npm run orch:status`
- `scripts/start-orchestration.sh` must run only on OCI primary. It exits when `DATACENTER=india`.
- Full enforced task sequence in `scripts/orchestrate.ts`:
  - dispatch task
  - agent completes and commits
  - run pre-push gate (`bash scripts/pre-push-review.sh`)
  - if clear: push + open PR
  - poll CodeRabbit webhook state (`monitoring/coderabbit-<pr>.yaml`)
  - blocked: requeue (max 3), do not advance
  - clear: mark done and advance to next task
- Linear lifecycle is best-effort and non-blocking:
  - `markTaskStarted`, `markTaskBlocked`, `markTaskDone`
  - regression issues can be created when blocked tasks have no `linearIssueId`
- Required env for automation (see `.env.example`):
  - `DATACENTER`
  - `GITHUB_WEBHOOK_SECRET`
  - `LINEAR_TEAM_KEY`
  - `GH_TOKEN`

## Codero Integration (Mandatory)

Codero is the orchestration control plane for this repo. It handles commit → review → merge.
`scripts/orchestrate.ts` is superseded by `codero-finish.sh` for the finish loop.

**Required env vars** (set in shell or `.env` before running):
```bash
CODERO_GITHUB_TOKEN=        # same as GH_TOKEN — GitHub PAT with repo + checks:write
CODERO_GITHUB_REPO=messagesgoel-blip/cacheflow
CODERO_LITELLM_URL=http://localhost:4000/v1/chat/completions
CODERO_LITELLM_MASTER_KEY=  # from LiteLLM config
CODERO_TASK_ID=             # set to current task ID before calling agent-finish-task
```

**Submit flow:**
```bash
# At the end of any agent task — replaces agent-finish-task manual commit flow
CODERO_TASK_ID=CAC-123 \
  /srv/storage/shared/agent-toolkit/bin/codero-finish.sh "feat(CAC-123): short description"
```

Exit codes: 0=merged, 1=CodeRabbit feedback (read .codero/finish-feedback.md), 2=CI fail, 3=gate blocked.

**Hook status:** Pre-commit hook requires `install-hooks` to replace the local `scripts/review/two-pass-review.sh`
wrapper (INT-002 — see codero task board). Until then, run `install-hooks` before your first commit:
```bash
/srv/storage/shared/agent-toolkit/bin/install-hooks
```
