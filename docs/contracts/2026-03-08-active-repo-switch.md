# Active Repo Switch

Date: 2026-03-08

## Decision

- `/srv/storage/repo/cacheflow` is the active working repo.
- `/srv/storage/repo/cacheflow` is the canonical deploy checkout.

## Scope

- All current development, verification, release handoff, and deploy instructions should target `/srv/storage/repo/cacheflow`.
- Older references remain historical unless explicitly updated.

## Required Documentation Alignment

- Update prompts and orchestration metadata that still point at the historical workspace.
- Keep historical contracts intact, but mark them as historical when they describe the prior workspace.

## Notes

- This switch does not rewrite historical task locks or archived reports.
- Current-source validation should use the active repo checkout and the source-backed local dev server associated with it.
