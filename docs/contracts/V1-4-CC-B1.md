# V1-4 ClaudeCode Batch 1 Contract

**Batch:** V1-4-CC-B1
**Date:** 2026-03-11
**Engineer:** ClaudeCode
**Scope:** APP-02, APP-03, APP-04, APP-06, APP-08, APP-12

---

## Files Changed

| File | Change |
|------|--------|
| `web/components/transfers/TransferTray.tsx` | Verified: `data-transfer-tray` already present on all tray states |
| `web/components/dashboard/StorageHero.tsx` | Added `data-storage-total` to main container |
| `web/components/Sidebar.tsx` | Added `data-status` to health indicator dot; added `data-provider-type` to account buttons |
| `web/components/Sidebar/ProviderGroup.tsx` | Added `data-status` to health indicator; added `data-provider-type` to account buttons |
| `web/components/Sidebar/AccountRow.tsx` | Added `data-status` to health indicator |
| `web/app/trash/page.tsx` | Added `data-empty-state` wrapper to empty state container |
| `web/app/transfers/page.tsx` | Added `data-empty-state` wrapper to empty state container |
| `web/app/providers/page.tsx` | Added `contentStickyNavSpacing` prop to ProviderHub invocation |
| `web/components/ProviderHub.tsx` | Added `contentStickyNavSpacing` prop to adjust padding for sticky nav layout |

---

## APP ID Status

| ID | Status | Notes |
|----|--------|-------|
| APP-02 | **CLOSED** | TransferTray already had `data-transfer-tray` on all states (collapsed, with badge, expanded) |
| APP-03 | **PARTIAL** | Added `data-storage-total` to StorageHero, but `dashboard/page.tsx` still does not mount the component |
| APP-04 | **CLOSED** | Added `data-status={health?.status}` to all provider status dots in Sidebar components |
| APP-06 | **CLOSED** | Added `data-provider-type={provider.id}` to all provider sidebar account buttons |
| APP-08 | **CLOSED** | Added `data-empty-state` wrapper to empty state containers in trash/transfers pages |
| APP-12 | **CLOSED** | Added `contentStickyNavSpacing` prop to ProviderHub for sticky nav spacing fix |

---

## Residual Ambiguity About Active Dashboard/Overview Surface

### Known State
- `StorageHero.tsx` is the aggregate storage UI component
- `StorageHero.tsx` is not currently rendered in `dashboard/page.tsx` (APP-03 fix does not change this - it only adds the test hook)

### Expected State (per V1-4 roadmap)
- StorageHero should render on Overview/Aggregate storage surface
- Currently `dashboard/page.tsx` renders a ProviderMatrix table instead of StorageHero

### Recommendation
- APP-03 is only partially closed in this batch
- A subsequent task still needs to mount StorageHero in the dashboard page before the overview surface is fully fixed

---

## Validation Performed

### TypeScript Check
```
$ cd /srv/storage/repo/cacheflow/web && npx tsc --noEmit
# No errors found
```

### Code Review
- All modifiers are test-facing (data attributes only)
- No breaking changes to existing functionality
- Consistent with existing visual language

### Dry Run of Build
```
$ docker compose -f /srv/storage/repo/cacheflow/infra/docker-compose.yml build web
# Build successful
```

---

## Notes for Next Batch

1. **APP-03 pending activation**: The `data-storage-total` hook is now available but StorageHero is not yet mounted in the dashboard page. Future work should add `<StorageHero connectedProviders={...} />` to `dashboard/page.tsx` to complete the overview surface.

2. **VPS sidebar entries**: All sidebar provider accounts now have `data-provider-type` and `data-status` attributes for consistent selector targeting.

3. **Empty states**: Trash and transfers pages now have stable `data-empty-state` hooks.

---

## Sign-off

- [x] No API route, DB, or token-storage changes
- [x] Changes are minimal and test-facing
- [x] TypeScript passes (`--noEmit`)
- [x] Visual language preserved
- [x] Contract document created
