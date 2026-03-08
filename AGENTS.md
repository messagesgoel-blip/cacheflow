# CacheFlow — Agent Quick Sheet

Project: multi‑cloud file manager (Next.js frontend, Node API, Postgres + Redis). Prod host: cacheflow.goels.in.

Layout: web/ (Next.js), api/ (Express), worker/ (BullMQ), lib/ (shared adapters), docs/contracts/ (API contracts), docs/orchestration/ (sprint state).

Auth: HttpOnly cookies only; token vault in lib/vault/tokenVault.ts; never expose tokens or write them to client storage.

Providers: Google Drive, OneDrive, Box, Dropbox, Filen, WebDAV, VPS/SFTP; adapters live in lib/providers/; never return stored credentials.

Sprints & contracts: see logs/orchestrator-state.json and docs/orchestration/task-manifest.json. Every cross-agent output needs docs/contracts/{task-id}.md. Type-check before commit: cd web && npx tsc --noEmit.

Tests: Playwright in web/e2e (run from web/). Gate command: SPRINT_LIMIT=N npx ts-node scripts/orchestrate.ts --gate-only --sprint N.

Commits: git commit --no-verify; do not commit .next/, node_modules/, coverage/, monitoring/*.yaml.

Definition of done: no change is considered done until it is tested, committed, and deployed from a clean git worktree in `/opt/docker/apps/cacheflow`. Do not treat uncommitted local changes or dirty-tree builds as done for live.

## Branch Naming
All feature branches must follow: `feat/LIN-{issue-id}-{short-description}`
Example: `feat/LIN-42-oauth-token-fix`
This enables Linear auto-tracking of commits against issues.

## Pull Requests
- Open a PR for feature work before it is considered ready for review or merge.
- Every PR branch must follow `feat/LIN-{issue-id}-{short-description}` so Linear can associate commits with the issue.
- PR title should include the Linear key when applicable.
- PR description must include:
  - linked Linear issue
  - summary of scope
  - tests run
  - deploy impact
- If behavior changes, update affected tests in the same PR.
- Do not treat a branch as done at PR open time; it is only done after tests pass, the change is committed, and it is deployed from a clean git worktree in `/opt/docker/apps/cacheflow`.

Agent scope: OpenCode → api/, lib/, worker/; ClaudeCode → web/; Gemini → tests/e2e/scripts; Sisyphus → orchestration only.
