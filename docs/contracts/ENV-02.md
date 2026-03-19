# ENV-02: Live Fixture Seeding

## Goal
Seed the required live fixture files used by the suite: `.pdf`, `.txt`, `.docx`, and one image. Record exact fixture names and where the suite expects to find them.

## Fixtures Required
The live test suite expects these files to be present or uploadable. The repo now carries real local fixtures in `web/e2e/fixtures/files/`:
1. `normal-file.txt`
2. `test-document.pdf`
3. `report.docx`
4. `image.png`

## Seeding Strategy
A script `scripts/seed-live-fixtures.sh` is provided. This script uploads missing fixtures through the authenticated `/files/upload` API, skips files that already exist at the root, and re-verifies the live root listing after seeding.

## Blockers
- **Missing External Access**: I cannot execute the seeding script because I lack a valid access token for the live test account.
- **Action Required**: A human operator must run `scripts/seed-live-fixtures.sh` with a valid bearer token or cookie-derived token before executing `V1-4-RERUN`.
