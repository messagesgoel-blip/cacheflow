# Sprint 5 Tasks

| ID | Description | Files | Agent | Gates |
| --- | --- | --- | --- | --- |
| 5.1 | Scheduled job data model and Schedules management UI | /prisma/migrations/004_scheduled_jobs/, /app/api/jobs/route.ts, /lib/jobs/scheduledJobService.ts | ◈ OpenCode | SCHED-1 |
| 5.10 | Stale file detection + cleanup UI | /app/cleanup/page.tsx, /components/cleanup/DuplicateGroup.tsx, /components/cleanup/StaleFileList.tsx | ◆ ClaudeCode | SEARCH-1 |
| 5.11 | Global cross-provider search v1 — name/metadata, ephemeral cache | /app/api/search/route.ts, /lib/search/crossProviderSearch.ts | ◈ OpenCode | SEARCH-1 |
| 5.12 | Search UI + performance test | /components/search/GlobalSearchBar.tsx, /components/search/SearchResults.tsx | ◆ ClaudeCode | SEARCH-1 |
| 5.13 | E2E search + duplicate detection tests | /e2e/tests/search.spec.ts, /e2e/tests/duplicateCleanup.spec.ts | ◉ Gemini | SEARCH-1 |
| 5.2 | BullMQ cron worker — jobs run server-side, browser closed | /lib/queue/workers/scheduledJobWorker.ts, /lib/jobs/jobEngine.ts | ◈ OpenCode | SCHED-1 |
| 5.3 | Schedules page UI — create, edit, pause, delete jobs | /app/schedules/page.tsx, /components/schedules/JobCard.tsx, /components/schedules/CreateJobModal.tsx | ◆ ClaudeCode | SCHED-1 |
| 5.4 | E2E scheduled job test — runs with browser closed ⚠️ Human verify | /e2e/tests/scheduledJobs.spec.ts | ◉ Gemini | SCHED-1 |
| 5.5 | Vault data model and enable/disable API | /prisma/migrations/005_vault/, /app/api/vault/route.ts | ◈ OpenCode | VAULT-1 |
| 5.6 | Vault access gate — TOTP or PIN required to unlock | /app/api/vault/[id]/unlock/route.ts, /lib/vault/vaultSession.ts | ◈ OpenCode | VAULT-1 |
| 5.7 | Vault UI — lock icon in sidebar, hidden from All Files | /components/Sidebar/VaultFolderRow.tsx, /components/vault/UnlockVaultModal.tsx, /app/files/page.tsx (filter vault items) | ◆ ClaudeCode | VAULT-1 |
| 5.8 | E2E vault tests — enable, lock, unlock, auto-lock | /e2e/tests/vault.spec.ts | ◉ Gemini | VAULT-1 |
| 5.9 | Duplicate detection — filename + size cross-provider comparison | /lib/cleanup/duplicateDetector.ts, /app/api/cleanup/duplicates/route.ts | ◈ OpenCode | SEARCH-1 |

