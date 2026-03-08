# Preview Range Optimization

## Scope
- stop downloading full files before opening the preview panel
- use ranged reads for text previews where the route supports it
- use direct streamed URLs for VPS image previews

## Changed paths
- `api/src/routes/providers.js`
- `api/src/routes/api.js`
- `web/app/api/providers/vps/[id]/[...segments]/route.ts`
- `web/app/api/files/download/route.ts`
- `web/components/UnifiedFileBrowser.tsx`
- `web/components/PreviewPanel.tsx`
- `web/lib/files/previewSource.ts`
- `web/lib/providers/StorageProvider.ts`
- `web/lib/providers/vps.ts`
- `web/lib/providers/local.ts`

## Behavioral contract
- `pdf` and unsupported previews open immediately without downloading the whole file
- `text` previews request only the first `64 KiB` when the route supports byte ranges
- VPS image previews use the authenticated `/api/providers/vps/:id/files/download` URL directly instead of prefetching the whole blob
- proxy routes preserve `Range`, `Content-Range`, and `Accept-Ranges`

## Verification targets
- `cd web && npx tsc --noEmit`
- `cd web && npm test -- --runInBand`
- `cd api && TOKEN_ENCRYPTION_KEY=... npm test -- --runInBand`
