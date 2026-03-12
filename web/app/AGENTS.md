# WEB APP ROUTES — Quick Sheet

Scope: Next.js App Router pages and API routes in web/app/.

Key files: layout.tsx, page.tsx, globals.css, api/, dashboard/, files/, settings/, providers/, middleware as needed.

Rules: server components by default; client components only for interactivity; route handlers for API work; keep TypeScript strict; avoid heavy work in server components; never leak sensitive data to the client.

Patterns: server actions for mutations, streaming for large lists, API routes proxy to backend.

Branch policy note: For the next batch onward, use `URM` issue prefix for new branches (e.g., `feat/URM-{issue-id}-{short-description}`); do not create new `LIN-*` branches.
