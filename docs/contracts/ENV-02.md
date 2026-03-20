# ENV-02: Repo-Owned Fixture Seeding

## Goal
Seed the required fixture files used by the suite: `.pdf`, `.txt`, `.docx`, and one image. Record exact fixture names and where the suite expects to find them.

## Fixtures Required
The live test suite expects these files to be present or uploadable. The repo now carries real local fixtures in `web/e2e/fixtures/files/`:
1. `normal-file.txt`
2. `test-document.pdf`
3. `report.docx`
4. `image.png`

## Seeding Strategy
A script `scripts/seed-live-fixtures.sh` is provided. This script uploads missing fixtures through the authenticated `/files/upload` API, skips files that already exist at the root, and re-verifies the root listing after seeding. If no token is supplied, it mints one from the repo-owned bootstrap credentials in `web/.env.live` via `scripts/bootstrap-dev-auth.sh`.

## Blockers
- None external. A developer can run `scripts/setup-live-env.sh` once, then `scripts/seed-live-fixtures.sh` will bootstrap auth automatically if no token is passed.
