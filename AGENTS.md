# CacheFlow — Agent Context

## Project
Multi-cloud file management platform. Next.js/TypeScript 
frontend, Node.js API, PostgreSQL + Redis.
Hosted at cacheflow.goels.in. Admin: admin@cacheflow.goels.in.

## Repository Structure
- web/          Next.js frontend (port 3010 in dev, 3000 in Docker)
- api/          Express backend (port 8100)
- worker/       BullMQ job workers
- lib/          Shared utilities and provider adapters
- docs/contracts/  API shape contracts — READ BEFORE IMPLEMENTING
- docs/orchestration/  Sprint manifests and state
- logs/         Audit logs and task logs

## Auth Rules (CRITICAL)
- HttpOnly cookies ONLY. Never write tokens to localStorage.
- Token vault: lib/vault/tokenVault.ts
- Never expose raw tokens in API responses
- Client JS must never read or write auth tokens

## Storage Providers
Google Drive, OneDrive, Box, Dropbox, Filen, WebDAV, VPS/SFTP.
All provider adapters in lib/providers/.
Credentials never returned in API responses after save.

## Sprint System
- Current sprint: see logs/orchestrator-state.json
- Task manifest: docs/orchestration/task-manifest.json  
- Contracts: docs/contracts/{task-id}.md
- Always read the relevant contract before implementing a task
- Always run: cd web && npx tsc --noEmit before committing

## Testing
- Playwright E2E in web/e2e/
- Always run tests from web/ directory
- All E2E tests mock API calls — never hit real providers
- Run gate: SPRINT_LIMIT=N npx ts-node scripts/orchestrate.ts --gate-only --sprint N

## Commit Rules
- Use --no-verify flag: git commit --no-verify
- Never commit .next/, node_modules/, coverage/
- Monitoring files are gitignored (docs/sprints-task-dashboard.md, monitoring/*.yaml)

## Agent Roles in This Repo
- OpenCode/Hephaestus: backend API, lib/, worker/ tasks
- ClaudeCode: frontend web/ tasks, components, pages
- Gemini: QA, Playwright tests, infra
- Sisyphus: orchestration, planning, coordination
