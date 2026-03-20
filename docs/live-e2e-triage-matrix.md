# Live E2E Triage Matrix

Run date: `2026-03-10T23:45:38Z`
Document updated: `2026-03-11`

Purpose: track the post-green-run implementation and verification backlog exposed by the external live Playwright suite, without losing it under the existing "Version 1 complete" roadmap state.

Source inputs:

- `/srv/storage/local/green run/CacheFlow_E2E_Triage_Dispatch.md`
- external live run summary and artifacts from `2026-03-10T23:45:38Z`

Important note:

- The dispatch note is directionally useful but not numerically consistent.
- Its category table says `54` failures, but the listed bucket totals do not reconcile cleanly.
- Treat this matrix as the normalized tracking source for implementation order and ownership.

## Status Labels

- `open`: actionable and not yet started
- `blocked`: depends on another row first
- `verify`: re-run/reclassify after prerequisite fixes
- `deferred`: keep visible, but do not implement until prerequisite classification is complete

## A. Immediate Real Fixes

| ID | Type | Owner | Criteria / Tests | Dependency | Summary | Status |
|---|---|---|---|---|---|---|
| `SEC-01` | Security | OpenCode | `AUTH-3` | none | Remove `cf_token` and any token-like auth state from `localStorage`; rely on cookie/session-derived auth state only. | `open` |
| `APP-01` | App bug | OpenCode | `UPLOAD-1`, downstream upload-dependent tests | none | Invalidate/refresh file listing after successful upload; ensure upload response returns the created file object. | `open` |
| `APP-02` | App bug | ClaudeCode | `TRANSFER-1` | none | Add `data-transfer-tray` and keep tray mounted in the shell layout so it survives navigation. | `open` |
| `APP-03` | App bug | ClaudeCode | storage dashboard checks | none | Add `data-storage-total` and confirm aggregate quota data actually renders on Overview. | `open` |
| `APP-04` | App bug | ClaudeCode | provider health-dot checks | none | Add `data-status="connected\|degraded\|expired"` to provider status indicators. | `open` |
| `APP-05` | App bug | ClaudeCode | `TRANSFER-1` 429 indicator | none | Surface `429` rate-limit state in UI with amber indicator and `Retry-After` countdown. | `open` |
| `APP-06` | App bug | ClaudeCode | VPS sidebar checks | none | Render VPS/SFTP entries in the sidebar and add `data-provider-type="vps"`. | `open` |
| `APP-07` | App bug | ClaudeCode | `VAULT-1` PIN challenge | none | Default vault to locked state and render the PIN challenge before content. | `open` |
| `APP-08` | App bug | ClaudeCode | empty-state checks | none | Add explicit empty-state components for `/trash` and `/transfers`. | `open` |
| `APP-09` | App bug | OpenCode | `HEALTH` | none | Add unauthenticated `GET /api/health` returning `status`, `timestamp`, `memory`, and `uptime`. | `open` |
| `APP-10` | App bug | OpenCode | console `401` checks | none | Audit layout/prefetch/background requests; always send credentials and handle `401` without noisy console errors. | `open` |
| `APP-11` | App bug | OpenCode + ClaudeCode | `PERF` / TTI | `APP-10` | Reduce cold-load time by decoupling provider health checks from first paint and rendering shell/skeletons earlier. | `blocked` |
| `APP-12` | App bug | ClaudeCode | `L-07` | none | Finish providers-page sticky-nav spacing so content starts below the nav box. | `open` |
| `APP-13` | App bug | OpenCode | `RENAME`, `VERSION-1`, `TRASH-1` | `APP-01` | Re-verify rename/version/trash flows after upload invalidation is fixed; treat current rename failure as a likely cascade, not a standalone first fix. | `blocked` |

## B. Spec Fixes

These are test-file defects or stale assumptions and should not be treated as product regressions until corrected.

| ID | Owner | Affected tests | Dependency | Summary | Status |
|---|---|---|---|---|---|
| `SPEC-01` | Gemini | `AUTH-1` | none | Replace invalid comma locator syntax with `.or()` or equivalent valid Playwright locator composition. | `open` |
| `SPEC-02` | Gemini | `NAV-1` | none | Reconcile expected nav labels with the actual live shell DOM before asserting exact text. | `open` |
| `SPEC-03` | Gemini | `PREVIEW-1` | `APP-01` | Replace broken CSS suffix selectors and mixed `text=` selector strings with valid Playwright locator/filter patterns. | `blocked` |
| `SPEC-04` | Gemini | `ACTIONS-1` | none | Use the actual row-selection affordance (`role="checkbox"` / custom control) instead of assuming native checkbox inputs. | `open` |
| `SPEC-05` | Gemini | `SHARE-1` | `APP-01` | Use a robust file-row selector after upload/list refresh is fixed. | `blocked` |
| `SPEC-06` | Gemini | `SEARCH-1` | none | Confirm whether search is a route or embedded surface and update navigation/locators accordingly. | `open` |
| `SPEC-07` | Gemini | cross-cutting `SEC` | none | Replace `page.evaluate(fetch(...))` from `about:blank` with `page.request.*` to avoid CORS false failures. | `open` |
| `SPEC-08` | Gemini | `MEDIA-1`, `PROVIDER PARITY`, `ZERODISK-1`, `HEALTH` | none | Replace browser-context fetches that lose session cookies with `page.request.*`. | `open` |
| `SPEC-09` | Gemini | `L-02` | none | Update login-page selectors to match the actual mounted auth layout and wait strategy. | `open` |
| `SPEC-10` | Gemini | `L-03` | none | Update connections-page card measurement logic and stabilization waits before dead-space assertions. | `open` |
| `SPEC-11` | Gemini | `L-07` sticky-nav checks | none | Target the real topbar element instead of assuming `<header>` / `[data-topbar]`. | `open` |

## C. Re-verify / Reclassify After A+B

The dispatch note labels many Version 1 feature failures as "not yet built", but the canonical roadmap tracks `6.1` through `6.6` as complete. Do not silently accept either story. Re-run after the real app fixes and spec fixes above, then reclassify each area.

| ID | Area | Current position | Dependency | Next action | Status |
|---|---|---|---|---|---|
| `VERIFY-01` | `6.1` quota alerts + remote URL import | latest live run failed | A + B complete | Re-run and decide whether failures are true app regressions, config gaps, or stale spec assumptions. | `verify` |
| `VERIFY-02` | `6.2` logs / terminal | latest live run failed | A + B complete | Re-run and classify against shipped Version 1 behavior. | `verify` |
| `VERIFY-03` | `6.3` scheduler + throttle | latest live run failed | A + B complete | Re-run and classify against shipped Version 1 behavior. | `verify` |
| `VERIFY-04` | `6.4` media range requests | mixed: bounded-memory pass, `206` checks fail | `SPEC-08` | Re-run with request-path fixes before deciding app status. | `verify` |
| `VERIFY-05` | `6.5` versioning + trash | failed with upload-dependent cascades | `APP-01`, `APP-13` | Re-run only after upload/list mutation is fixed. | `verify` |
| `VERIFY-06` | `6.6` VPS key lifecycle | mixed: encryption check pass, UI checks fail | `APP-06` | Re-run after VPS sidebar / affordance fixes. | `verify` |

## D. Environment / Fixture Gaps

These should stay visible so reruns are comparable.

| ID | Gap | Effect | Next action | Status |
|---|---|---|---|---|
| `ENV-01` | repo-owned bootstrap `CF_TOTP_SECRET` not generated yet | all `2FA-1` cases skipped | Run `scripts/setup-live-env.sh` before rerun. | `open` |
| `ENV-02` | bootstrap fixture files not seeded | preview/document tests skip or become non-diagnostic | Run `scripts/seed-live-fixtures.sh` before rerun. | `open` |
| `ENV-03` | bootstrap provider/data state not guaranteed | duplicate/share/VPS/version/trash checks become skip-heavy or misleading | Run `scripts/verify-live-baseline.sh` and seed a stable bootstrap test account before rerun. | `open` |

## Ordered Task Queue

Follow this queue in order to avoid inconsistency and false classification. If a row lists multiple task IDs, they are parallel-safe within that phase once all prior phases are complete.

1. `SEC-01` — OpenCode
   Remove token-like auth state from browser-visible storage before any other triage work; this is the only critical security item.
2. `APP-01` — OpenCode
   Fix upload/list invalidation first because multiple downstream failures depend on uploaded files appearing.
3. `APP-09`, `APP-10` — OpenCode
   Add `/api/health` and eliminate avoidable background/prefetch `401` noise before evaluating perf and cross-cutting checks.
4. `APP-02`, `APP-03`, `APP-04`, `APP-05`, `APP-06`, `APP-07`, `APP-08`, `APP-12` — ClaudeCode
   Resolve the independent UI/runtime affordance bugs once the core backend/session issues above are stable.
5. `SPEC-01`, `SPEC-02`, `SPEC-04`, `SPEC-06`, `SPEC-07`, `SPEC-08`, `SPEC-09`, `SPEC-10`, `SPEC-11` — Gemini
   Remove false failures that do not depend on upload/list state.
6. `APP-11` — OpenCode + ClaudeCode
   Revisit TTI only after auth noise and shell/data-fetch sequencing bugs are reduced.
7. `SPEC-03`, `SPEC-05`, `APP-13` — Gemini, Gemini, OpenCode
   Finish upload-dependent selector fixes and re-verify rename/version/trash only after `APP-01`.
8. `ENV-01`, `ENV-02`, `ENV-03` — QA / Gemini support
   Provide repo-owned bootstrap secret and stable seeded fixtures/account before the verification rerun.
9. `VERIFY-01`, `VERIFY-02`, `VERIFY-03`, `VERIFY-04`, `VERIFY-05`, `VERIFY-06`
   Re-run and explicitly reclassify live failures for Version `6.1` through `6.6`.

## Ordered Task IDs Only

For dispatching and issue tracking, use the dependency-safe order from the
**Ordered Task Queue** above. That grouped queue is the canonical source for the
full `SEC-01` through `VERIFY-06` sequence and should be updated in one place
only to avoid drift.

## Re-run Gate

Use this matrix as closed only when all of the following are true:

- `AUTH-3` is green and no token-like auth state is stored in browser-visible storage.
- Upload/list invalidation is fixed and downstream upload-dependent checks are re-run.
- `/api/health` returns `200` unauthenticated with the expected JSON shape.
- No primary-route background request produces avoidable console `401` noise.
- Transfer tray, provider health attributes, vault PIN gate, empty states, and VPS sidebar all re-verified.
- Spec-side false failures are removed from the suite.
- Rerun is executed with the repo-owned bootstrap `CF_TOTP_SECRET` and stable fixture files/account.
- Version `6.1` through `6.6` are explicitly reclassified as `green`, `real regression`, or `fixture/spec issue`.
