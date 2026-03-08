# Provider Parity Checklist (Task 4.1)

Gate: `AUTH-1`  
Scope: server-side provider adapters implementing `ProviderAdapter`.

## Pass Rule

A provider is parity-complete only if it passes **all 5 checks** below.  
If any single check fails, parity fails.

## The 5 Required Checks

| Check ID | Check | Required Adapter Methods | Pass Criteria |
| --- | --- | --- | --- |
| `auth_lifecycle` | Auth lifecycle parity | `connect`, `validateAuth`, `refreshAuth`, `disconnect` | Connect returns stable `accountId`; validate reports token state correctly; refresh rotates/extends auth without account drift; disconnect invalidates session. |
| `file_discovery` | File discovery parity | `listFiles`, `searchFiles`, `getFile` | Root and nested listing work with deterministic pagination (`hasMore`/`nextCursor`); search returns provider-consistent results; `getFile` resolves metadata for IDs returned by listing. |
| `file_mutation` | File mutation parity | `createFolder`, `moveFile`, `copyFile`, `renameFile`, `deleteFile` | CRUD-style mutations complete with consistent metadata; conflicts and missing IDs map to canonical error codes. |
| `stream_transfer` | Stream transfer parity | `downloadStream`, `uploadStream` | Transfers are stream-only (no temp disk paths), preserve file bytes, and honor cancellation via `abortSignal`. |
| `resumable_transfer` | Resumable transfer parity | `createResumableUpload`, `uploadResumableChunk`, `getResumableUploadStatus`, `finalizeResumableUpload`, `abortResumableUpload` | Sessions can be created, resumed from committed offsets, finalized, and aborted with deterministic state transitions. |

## Out of Scope for This Checklist

- Share-link behavior (`createShareLink`, `revokeShareLink`) is validated under `SHARE-1`, not this AUTH-1 parity baseline.

## Evidence Required Per Provider

- Test artifact showing pass/fail for each of the 5 checks.
- Failure logs including `ProviderAdapterError.code` when a check fails.
- Provider descriptor snapshot used during the run (`id`, `displayName`, `capabilities`).

## Source of Truth in Code

- `lib/providers/ProviderAdapter.interface.ts` exports `PROVIDER_PARITY_CHECKLIST`.

