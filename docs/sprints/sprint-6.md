# Sprint 6 Plan

- Status: Ready
- Version: 1
- Stage: V1-2 Power User Essentials and V1-3 Power User Completion
- Entry gate: Cleared on 2026-03-07; deterministic gate is green and live smoke is isolated

| ID | Description | Files | Agent | Gates |
| --- | --- | --- | --- | --- |
| 6.1 | Version 1 essentials - quota alerts + remote URL import | /lib/transfers/remoteUpload.ts, /api/src/routes/remoteUpload.js, /api/src/services/remoteUploadService.js, /web/components/files/RemoteUploadModal.tsx, /web/components/dashboard/StorageHero.tsx, /web/components/dashboard/ProviderCapacityBar.tsx, /web/components/Sidebar.tsx | ★ CODEX (Cross-agent) | QUOTA-1, RIMPORT-1 |
| 6.2 | Version 1 essentials - real-time terminal + log view | /lib/transfers/progressBridge.ts, /web/context/TransferContext.tsx, /api/src/routes/transfer.js, /api/src/routes/activity.js, /web/components/TransferQueuePanel.tsx | ★ CODEX (Cross-agent) | LOGS-1 |
| 6.3 | Version 1 essentials - scheduled backups + bandwidth throttle | /web/app/api/jobs/route.ts, /web/lib/jobs/scheduledJobService.ts, /lib/jobs/scheduledJobService.ts, /lib/queue/workers/scheduledJobWorker.ts, /web/app/schedules/page.tsx, /web/components/schedules/CreateJobModal.tsx, /web/components/schedules/JobCard.tsx | ★ CODEX (Cross-agent) | SCHED-2, THROTTLE-1 |
| 6.4 | Version 1 completion - media streaming polish | /lib/transfers/streamTransfer.ts, /web/components/PreviewPanel.tsx, /web/app/api/remotes/[uuid]/upload/route.ts | ★ CODEX (Cross-agent) | MEDIA-1, STREAM-1 |
| 6.5 | Version 1 completion - file versioning + trash bin | /lib/providers/*/trash.ts, /web/app/trash/page.tsx, /web/components/files/VersionHistoryPanel.tsx, /web/components/cleanup/StaleFileList.tsx | ★ CODEX (Cross-agent) | VERSION-1, TRASH-1 |
| 6.6 | Version 1 completion - VPS/SFTP key lifecycle | /api/src/routes/providers.js, /lib/vault/credentialVault.ts, /lib/providers/vps/sshConnectionManager.ts, /web/components/modals/VPSModal.tsx, /web/app/providers/vps/[id]/page.tsx | ★ CODEX (Cross-agent) | KEYS-1, NODE-1 |

## Notes

- Wave 1: 6.1, 6.2, 6.3
- Wave 2: 6.4, 6.5, 6.6
- Wave 2 remains pending until the Version 1 essentials block is green.
