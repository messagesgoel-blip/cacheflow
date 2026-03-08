# Shell Refresh

Date: 2026-03-08

Scope:
- unify dashboard, files, providers, and connections pages under the same shell background and spacing system
- refresh the shared navigation chrome, sidebar, breadcrumb, and storage hero styling
- make initial theme bootstrapping explicitly clear prior `dark` / `light` classes before applying the stored theme

Changed paths:
- `web/app/dashboard/page.tsx`
- `web/app/connections/page.tsx`
- `web/app/files/page.tsx`
- `web/app/providers/page.tsx`
- `web/app/layout.tsx`
- `web/app/globals.css`
- `web/components/Navbar.tsx`
- `web/components/RemotesPanel.tsx`
- `web/components/SelectionToolbar.tsx`
- `web/components/Sidebar.tsx`
- `web/components/ThemeToggle.tsx`
- `web/components/UnifiedBreadcrumb.tsx`
- `web/components/dashboard/StorageHero.tsx`

Behavior:
- authenticated shell pages render inside the same `cf-shell-page` surface instead of mixing legacy gray page wrappers
- dashboard uses the newer command-center layout and session-based auth hydration
- shared shell components use the updated CSS variable palette and panel styling
- theme initialization removes stale theme classes before adding the next theme class

Verification:
- `cd web && npx tsc --noEmit`
