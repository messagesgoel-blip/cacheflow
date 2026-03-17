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

## Registered Code Components (Phase 2)

This section documents the UI components from Cacheflow's design system that are
registered for use in Plasmic Studio.

### Currently Registered Components

| Component | Display Name | Import Path | Safe Props |
|-----------|--------------|-------------|------------|
| Button | Cacheflow Button | `@/components/ui/Button` | `variant`, `size`, `children`, `disabled`, `className` |
| Badge | Cacheflow Badge | `@/components/ui/Badge` | `variant`, `children`, `className` |
| Spinner | Cacheflow Spinner | `@/components/ui/Spinner` | `size`, `className` |

### Registration File

- **Location**: `web/lib/plasmic/registerCodeComponents.ts`
- **Test**: `web/lib/plasmic/__tests__/registerCodeComponents.test.ts`

### How to Add a New Component

1. **Verify eligibility**: Component must meet these criteria:
   - No auth/session/token dependencies
   - No data-fetch side effects for basic render
   - Stable, simple props
   - Presentation-only (no business logic)

2. **Identify safe props**: Document which props are safe to expose:
   - ✅ Safe: `variant`, `size`, `className`, `children`, `disabled`
   - ❌ Forbidden: `onClick` callbacks, `type` for forms, `value`, `name`, internal IDs

3. **Add registration**: Create a `registerComponent()` call in `registerCodeComponents.ts`:

```typescript
   import { BooleanType, ChoiceType, StringType } from "@plasmicapp/host/registerComponent";
   import { YourComponent } from "@/components/ui/YourComponent";

   registerComponent(YourComponent, {
     name: "CacheflowYourComponent",
     displayName: "Cacheflow Your Component",
     importPath: "@/components/ui/YourComponent",
     props: {
       variant: {
         type: ChoiceType,
         options: ["default", "secondary"],
         defaultValue: "default",
       },
       // ... other safe props
     },
   });
   ```

4. **Add test**: Add test coverage in `__tests__/registerCodeComponents.test.ts`

5. **Document**: Update this table with the new component

### Explicitly Forbidden Props

Never expose these to Plasmic:
- Vault tokens, provider credentials
- Session/user authentication state
- Internal IDs tied to private infrastructure
- Privileged callbacks (admin actions, data mutations)
- API endpoints or internal URLs

### Ownership

- **Generated**: `web/components/plasmic/**` - DO NOT EDIT
- **Registered**: `web/lib/plasmic/registerCodeComponents.ts` - REPO OWNED
- **Tests**: `web/lib/plasmic/__tests__/` - REPO OWNED
