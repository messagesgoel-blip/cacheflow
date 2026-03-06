# COMPONENTS — Quick Sheet

Scope: React components for the web UI (file browser, provider setup, shared UI).

Key areas: files/, providers/, ui/, layout/, errors/, Sidebar/, FileBrowser/, ProviderCard/, FileActions/, hooks/.

Rules: TypeScript strict; Tailwind for styling; ensure ARIA/accessibility; minimize prop drilling (prefer context/hooks); client components only when interactive; keep render work light.

Security: never expose credentials or tokens in UI; prefer fetching via server components when possible.
