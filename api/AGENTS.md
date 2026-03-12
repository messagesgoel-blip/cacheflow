# API — Quick Sheet

Purpose: Express API on port 8100 for auth, provider connections, file ops, sync hooks.

Layout: src/routes, src/services, src/middleware, src/utils; tests/ for unit/integration.

Hot spots: routes/files.ts (file ops), routes/remotes.ts (provider OAuth), routes/auth.ts (login/refresh), routes/health.ts.

Standards: Prisma for DB; express-validator for inputs; JWT refresh + access; rate-limit per IP/user; sanitize responses (no raw records or credentials).

Rules: keep handlers short and non-blocking; use structured errors; never store secrets/plaintext or leak vault data; prefer service layer over route logic.

Branch policy note: For the next batch onward, use `URM` issue prefix for new branches (e.g., `feat/URM-{issue-id}-{short-description}`); do not create new `LIN-*` branches.
