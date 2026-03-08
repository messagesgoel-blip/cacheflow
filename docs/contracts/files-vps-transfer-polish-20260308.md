# Files, VPS Detail, and Transfer Surface Polish

Date: 2026-03-08

Scope:
- tighten files empty and loading states
- compact the VPS detail browser shell and table states
- bring transfer modal and tray surfaces into the current shell density

What changed:
- restyled `UnifiedFileBrowser` placeholders to use shell cards and actionable next-step states
- reduced padding and tightened control/table treatment on the VPS detail page
- compacted `TransferModal`, `TransferTray`, and `TransferItem` without changing transfer behavior

Non-goals:
- no backend, provider, or transfer pipeline changes
- no selector, route, or label changes required by focused Playwright coverage

Verification:
- `cd web && npx tsc --noEmit`
- focused Playwright:
  - `e2e/aggregation.spec.ts`
  - `e2e/vpsDetailSurface.spec.ts`
  - `e2e/transfer-modal.spec.ts`
  - `e2e/transfer-modal-move.spec.ts`
  - `e2e/transferTray.spec.ts`
