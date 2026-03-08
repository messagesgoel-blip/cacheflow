# Command Palette Shell Slice

Date: 2026-03-08

Goal:
- add a thin command palette inspired by the example UI without introducing a new component system or backend search dependency
- keep the feature limited to existing routes and existing UI actions

Scope:
- add a lightweight `Ctrl/Cmd+K` palette in the shared navbar
- include only:
  - route navigation
  - file-surface actions already supported by `UnifiedFileBrowser`
  - provider connect actions already supported by `ProviderHub`
- use client-side custom events and route transitions only

Behavior:
- palette opens from the navbar button or `Ctrl/Cmd+K`
- route commands navigate directly
- action commands either:
  - dispatch immediately when already on the target route, or
  - navigate first, then dispatch the existing UI action after the route loads

Explicit non-goals:
- no backend search
- no recent-file indexing
- no billing/team/API-key features from the example UI
- no new auth, provider, or transfer contracts

Validation:
- focused Playwright covers:
  - opening the file create-folder modal from the palette
  - navigating to providers and opening the VPS connect modal from the palette
