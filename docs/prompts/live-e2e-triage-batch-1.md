# V1-4 Live E2E Triage Batch 1

Use this prompt pack for the first post-PR cleanup dispatch from the normalized live triage backlog.

Source of truth:

- `docs/live-e2e-triage-matrix.md`
- `docs/roadmap.md` (`V1-4 Post-Completion Live E2E Triage Hold`)

Dispatch rule:

- Use the normalized matrix as the queue source.
- Do not re-open already merged PR cleanup work.
- Prefer the smallest scope that closes the next real blocker.
- Do not start Sprint 7 implementation while this batch is open.

Current dispatch decision:

- `APP-01` upload invalidation appears to be implemented in the current tree and should be treated as verify-first, not new implementation.
- `APP-09` `/api/health` exists in the current tree and should also be treated as verify-first.
- `SPEC-07` and `SPEC-08` are partially landed already; verify current coverage before editing.
- The first real implementation batch should focus on:
  - `SEC-01` + `APP-10`
  - `APP-02`, `APP-03`, `APP-04`, `APP-06`, `APP-08`, `APP-12`
  - `SPEC-01`, `SPEC-02`, `SPEC-04`, `SPEC-06`, `SPEC-09`, `SPEC-10`, `SPEC-11`

Hold for later batch:

- `APP-05` rate-limit UI
- `APP-07` vault PIN challenge
- `APP-11` perf / TTI
- `APP-13` rename/version/trash re-verification
- `ENV-01` to `ENV-03`
- `VERIFY-01` to `VERIFY-06`

## Prompt: OpenCode

```text
You are working Batch 1 of the CacheFlow V1-4 live E2E triage hold.

Repo:
- /opt/docker/apps/cacheflow

Source docs:
- docs/live-e2e-triage-matrix.md
- docs/roadmap.md

Scope for this pass:
- `SEC-01`
- `APP-10`
- verify-only check for `APP-01` and `APP-09`

What to do:
1) Remove runtime app-auth dependence on browser-visible `cf_token`.
2) Eliminate same-origin auth fallbacks that still read/write `cf_token` for session state.
3) Keep provider-specific remote/account storage intact unless it is directly part of app-auth state.
4) Verify whether upload invalidation and `/api/health` are already satisfied in current code before changing them.
5) Do not touch Sprint 7 work.

Known current problem surfaces from audit:
- `web/components/HomeEntry.tsx`
- `web/app/files/page.tsx`
- `web/lib/apiClient.ts`
- several auth-gated pages still read `localStorage.getItem('cf_token')`

Constraints:
- No speculative feature work.
- Do not rewrite provider adapters unless required to remove app-auth token usage.
- If a path is already fixed, leave it alone and record it as verify-only.

Expected outcome:
- app auth derives from cookie/session state, not `cf_token`
- background/prefetch auth noise is reduced without breaking login/session flows
- `APP-01` and `APP-09` are confirmed fixed or called out with exact residual gap

Suggested validation:
- targeted auth/session tests
- `web/e2e/securityAudit.spec.ts`
- a focused session/login regression pass

Report back with:
- files changed
- whether `APP-01` and `APP-09` needed code changes or were verify-only
- remaining blockers, if any
```

## Prompt: ClaudeCode

```text
You are working Batch 1 of the CacheFlow V1-4 live E2E triage hold.

Repo:
- /opt/docker/apps/cacheflow

Source docs:
- docs/live-e2e-triage-matrix.md
- docs/roadmap.md

Scope for this pass:
- `APP-02`
- `APP-03`
- `APP-04`
- `APP-06`
- `APP-08`
- `APP-12`

What to do:
1) Close the missing UI/runtime affordance gaps that are low-risk and parallel-safe.
2) Prefer data-attribute/testability fixes plus minimal rendering corrections.
3) Do not take `APP-05` or `APP-07` in this batch.

Known current problem surfaces from audit:
- `web/components/transfers/TransferTray.tsx`
  - tray is globally mounted already, but still uses `data-testid="cf-transfer-tray"` instead of `data-transfer-tray`
- `web/components/dashboard/StorageHero.tsx`
  - aggregate storage UI exists but is not the active rendered overview surface
- `web/app/dashboard/page.tsx`
  - does not currently render the storage hero
- `web/components/ProviderHub.tsx`
- `web/components/Sidebar.tsx`
  - status dots/chips render, but no `data-status` / `data-provider-type="vps"` attributes
- `web/app/trash/page.tsx`
- `web/app/transfers/page.tsx`
  - explicit empty-state/test hooks need verification and likely tightening
- `web/app/providers/page.tsx`
  - sticky-nav spacing still relies on shallow fixed padding

Constraints:
- No new product features.
- Keep changes test-facing and behavior-minimal.
- Use the existing visual language; do not redesign surfaces.

Expected outcome:
- transfer tray exposes the expected live-test hook
- overview storage total renders with a stable test hook
- provider status and VPS sidebar entries expose stable data attributes
- trash/transfers empty states expose stable data hooks
- providers content reliably starts below the sticky nav

Suggested validation:
- relevant component tests if present
- targeted Playwright surfaces:
  - `web/e2e/layoutDispatch1.spec.ts`
  - `web/e2e/tests/storageDashboard.spec.ts`
  - transfer tray / providers surface checks

Report back with:
- files changed
- which app IDs were fully closed
- any residual ambiguity about the active dashboard/overview surface
```

## Prompt: Gemini

```text
You are working Batch 1 of the CacheFlow V1-4 live E2E triage hold.

Repo:
- /opt/docker/apps/cacheflow

Source docs:
- docs/live-e2e-triage-matrix.md
- docs/roadmap.md

Scope for this pass:
- `SPEC-01`
- `SPEC-02`
- `SPEC-04`
- `SPEC-06`
- `SPEC-09`
- `SPEC-10`
- `SPEC-11`
- verify whether `SPEC-07` and `SPEC-08` are already satisfied before editing

What to do:
1) Remove stale test assumptions and invalid selectors in the current E2E suite.
2) Prefer stable role-based or real-surface selectors over brittle CSS assumptions.
3) If `SPEC-07` / `SPEC-08` are already satisfied in current code, do not churn them.
4) Do not work on upload-dependent selector fixes yet (`SPEC-03`, `SPEC-05` are held).

Known current problem surfaces from audit:
- checkbox assumptions still exist in:
  - `web/e2e/real-ui-operations.spec.ts`
  - `web/e2e/phase3-interactions.spec.ts`
  - `web/e2e/transfer-modal.spec.ts`
  - `web/e2e/transfer-modal-move.spec.ts`
- providers/nav tests already partially moved toward real surfaces:
  - `web/e2e/layoutDispatch1.spec.ts`
  - `web/e2e/providersSurface.spec.ts`
- `web/e2e/securityAudit.spec.ts` already uses `page.request.*`

Constraints:
- No product code changes unless a test cannot be corrected without exposing an existing stable hook.
- Keep scope to test correctness, not feature implementation.
- Avoid reintroducing `waitForTimeout` when a deterministic wait is possible.

Expected outcome:
- non-upload-dependent false failures are removed from the suite
- stale route/nav/login assumptions are aligned with the current shell
- `SPEC-07` / `SPEC-08` are either confirmed already-fixed or minimally corrected

Suggested validation:
- targeted Playwright runs for the touched files only

Report back with:
- files changed
- which SPEC IDs were fixed vs verify-only
- any remaining app-side blocker that prevented a pure spec fix
```
