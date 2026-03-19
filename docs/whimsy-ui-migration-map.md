# Whimsy UI Migration Map

Purpose: map Whimsy Panel Suite surfaces onto the canonical CacheFlow product roadmap without creating duplicate feature tracks.

Principles:

- CacheFlow `web/` stays the only production frontend.
- Whimsy is the canonical UI and IA reference for end-state product surfaces.
- Shared pages are visual migrations of existing capability, not new roadmap epics.
- Missing Whimsy surfaces must map to an existing roadmap stage, GTM backlog, or internal-only scope.

## Runtime Rules

Do port:

- design tokens, page composition, shell layout, navigation semantics, and interaction patterns
- reusable UI primitives from Whimsy when they can live inside Next App Router
- exact visual treatment where CacheFlow already has matching backend capability

Do not port:

- Supabase auth
- `react-router-dom`
- Vite app bootstrap/runtime
- mock-only data flows as production state management

## Surface Mapping

| Whimsy surface | CacheFlow route or destination | Current data/runtime source | Roadmap owner | Migration action |
| --- | --- | --- | --- | --- |
| `Home` | `/dashboard` | existing dashboard/session/API clients | common surface | port exact Whimsy layout, keep CacheFlow data |
| `Library` | `/files` with optional `/library` alias | existing file browser and provider APIs | common surface | port Whimsy shell + file browsing composition, reuse CacheFlow browser logic |
| `Connections` | `/connections` | `GET /api/connections` | common surface | replace page body with Whimsy cards/forms backed by live connections data |
| `Transfers` | `/transfers` | `TransferContext`, `GET/POST /api/transfers` | common surface | port Whimsy status UI first, then explorer mode against live transfer/file APIs |
| `Activity` | `/activity` | existing activity endpoints | common surface | port Whimsy list/filter UI on top of live feed |
| `Security` | `/security` | existing auth / 2FA / credential flows | common surface | port Whimsy layout, keep cookie/session and 2FA behavior |
| `Settings` | `/settings` | existing settings/auth/provider preferences | common surface | port Whimsy tabs/forms without introducing Supabase settings flows |
| `Spaces` | future `/spaces` | not a live product surface yet | Sprint 10 | add route placeholder + shell during migration gate; fill with Team Workspaces implementation later |
| `Integrations` | future `/integrations` | not a live product surface yet | Sprint 10 + Sprint 13 | add route placeholder; later back with MCP, webhook, and external integration data |
| `Automations` | future `/automations` | partial scheduling exists; no full Whimsy surface yet | Version 6.3 + Sprint 12 | add route placeholder; later unify scheduling/rules under Whimsy UI |
| `Analytics` | future `/analytics` | no single live analytics hub yet | Sprint 9, 15, 16, 20 | add route placeholder; later unify FinOps, heatmap, uptime, and carbon reporting |
| `Organization` | future `/organization` | no single live organization hub yet | Sprint 18 | add placeholder, later back with AI organization flows |
| `Pricing` | no product route required | GTM/commercial only | GTM backlog | keep out of Version 1 / Version 2 product sequencing |
| `Design System` | internal-only reference route if useful | internal docs/components only | internal enablement | optional internal dev route, not a roadmap stage |
| `Auth` | `/login`, `/register`, password reset flows | CacheFlow session + HttpOnly cookies | common auth surface | preserve Whimsy look only; do not port Supabase auth logic |

## Duplicate Removal Decisions

- Do not create separate roadmap work for `Home`, `Library`, `Connections`, `Transfers`, `Activity`, `Security`, or `Settings` if the underlying product capability already exists.
- Do not keep a separate "design refresh" roadmap lane in parallel with feature delivery once the migration gate is active.
- Do not model `Pricing` as a product feature stage; keep it in GTM / Commercial planning only.
- Do not model `Design System` as a user-facing roadmap feature.

## Shared Data Adapters

These are the seams that let Whimsy visuals run inside CacheFlow with minimal rework:

| Concern | CacheFlow source |
| --- | --- |
| authenticated session | `web/lib/auth/serverSession.ts`, `web/lib/auth/clientSession.ts` |
| connections list | `web/app/api/connections/route.ts`, `web/lib/apiClient.ts` |
| transfers | `web/context/TransferContext.tsx`, `web/app/api/transfers/route.ts` |
| files / providers | existing `web/lib/providers/*`, `web/app/api/*`, and browser pages |
| shell route protection | `web/app/(authenticated)/layout.tsx` |

## Suggested Execution Order

1. Port Whimsy shell into CacheFlow `web/components/shell`.
2. Port exact Whimsy design tokens/primitives that are still missing from CacheFlow.
3. Migrate common pages with live data in this order:
   - `/dashboard`
   - `/connections`
   - `/transfers`
   - `/activity`
   - `/security`
   - `/settings`
   - `/files` / optional `/library`
4. Add placeholder routes for `spaces`, `integrations`, `automations`, `analytics`, and `organization`.
5. Keep those placeholder routes tied to their owning roadmap stages so IA stays stable while features land.

## Manifest Note

The active orchestration manifest should not be regenerated for Version 2 execution until:

- `V1-4` live triage is cleared
- the Whimsy migration gate is green
- Sprint 7+ tasks are decomposed against the Whimsy-aligned route map
