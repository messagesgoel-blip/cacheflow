# Plasmic Integration (Cacheflow)

This runbook sets up Plasmic as a UI code generation surface while keeping
application logic, routing, auth, and data mutations in Cacheflow-owned code.

## Integration model

- Use Plasmic CLI codegen in `web/` (not runtime loader-first).
- Keep generated files under `web/components/plasmic/`.
- Treat Plasmic output as presentational components.
- Keep API calls, state transitions, auth checks, and side effects in existing
  app/container code.

## One-time setup (local)

From repo root:

```bash
cd web
npm run plasmic:init
```

Authenticate once (writes local `web/.plasmic.auth`, git-ignored):

```bash
cd web
npx @plasmicapp/cli auth
```

## Daily usage

Check project status:

```bash
cd web
npm run plasmic:status
```

Sync all configured projects:

```bash
cd web
npm run plasmic:sync
```

Sync only one project:

```bash
cd web
PLASMIC_PROJECT_ID=<project-id> npm run plasmic:sync:project
```

Default project ID configured for this repo:

- `dBrwTrDKiTkBShUoNHTaNj`

## CI behavior

Workflow: `.github/workflows/plasmic-sync-check.yml`

- Runs on PR/push when Plasmic config or generated files change.
- Verifies sync stays reproducible.
- Uses repository secrets:
  - `PLASMIC_AUTH_B64`: base64 of `.plasmic.auth`
  - Optional `PLASMIC_PROJECT_ID` for targeted sync checks

If `PLASMIC_AUTH_B64` is absent, the workflow exits cleanly with a warning.

## Guardrails

- Do not commit `web/.plasmic.auth`.
- Do not move business logic into generated Plasmic files.
- Wrap generated components in repo-owned components when connecting to app
  state and backend actions.
- Run before PR:
  - `cd web && npm run plasmic:sync`
  - `cd web && npm run test`
  - `cd web && npm run build`

## Preview Route

A dedicated preview route is available for testing Plasmic content without affecting production:

- **Route**: `/plasmic-preview`
- **File**: `web/app/plasmic-preview/page.tsx`
- **Purpose**: Preview generated Plasmic components in a safe, isolated route

This route:
- Does NOT replace the production homepage
- Uses client-side rendering for hot-reload compatibility
- Is intended for development/preview only

## Generated Code Boundaries

The following directories contain generated code and should NOT be hand-edited:

- `web/components/plasmic/**` - All Plasmic-generated components
- `web/components/plasmic/blank_project/**` - Generated page components
- `web/components/app/page.tsx` - Generated app wrapper (if applicable)

Only edit files in:
- `web/app/plasmic-preview/` - Preview route (repo-owned)
- `web/components/app/` - Repo-owned wrappers that can be modified

When Plasmic content changes, regenerate via:
```bash
cd web && npm run plasmic:sync
```

Then review generated diffs before merging.
