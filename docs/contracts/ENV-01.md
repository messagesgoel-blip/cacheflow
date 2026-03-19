# ENV-01: Live Rerun TOTP Secret

## Goal
Make `CF_TOTP_SECRET` available to the live rerun path without exposing the value in git, and determine the correct secret source for live runs on this machine.

## Implementation
1. **Secret Source**: The standard for live runs is to use a `.env.live` file in the `web/` directory. This file is ignored by Git via the explicit `web/.env.live` entry in `.gitignore`.
2. **Wiring**: The file `web/playwright.live.config.ts` now loads `web/.env.live` directly at startup and only falls back to the ambient environment when the file is absent.

## Verification
- Run `bash scripts/setup-live-env.sh` and confirm it writes `web/.env.live` with `CF_TOTP_SECRET=...`.
- The `web/playwright.live.config.ts` runner will inject this into `process.env` when present.

## Blockers
- **Missing External Access**: I do not have the actual TOTP secret value for the live test account.
- **Action Required**: A human operator must run `scripts/setup-live-env.sh` or create `web/.env.live` manually before executing `V1-4-RERUN`.
