# ENV-01: Repo-Owned Bootstrap TOTP Secret

## Goal
Make `CF_TOTP_SECRET` available to the rerun path without exposing the value in git, and keep the secret source under repository control.

## Implementation
1. **Secret Source**: The bootstrap source is a `.env.live` file in the `web/` directory. This file is ignored by Git via the explicit `web/.env.live` entry in `.gitignore`.
2. **Wiring**: The file `web/playwright.live.config.ts` loads `web/.env.live` directly at startup and only falls back to the ambient environment when the file is absent.
3. **Bootstrap Values**: `scripts/setup-live-env.sh` mirrors the repo-owned bootstrap values from the deployed stack env when available, writes `CF_TOTP_SECRET` plus QA bootstrap credentials into `web/.env.live`, and `scripts/bootstrap-dev-auth.sh` mints a session token from those credentials when needed.

## Verification
- Run `bash scripts/setup-live-env.sh` and confirm it writes `web/.env.live` with `CF_TOTP_SECRET=...` and the QA bootstrap credentials.
- The script defaults to the seeded QA account already used by the CacheFlow repo stack, unless you override the bootstrap env vars explicitly.
- The `web/playwright.live.config.ts` runner will inject this into `process.env` when present.
- `scripts/bootstrap-dev-auth.sh` should mint a usable session token from the repo-owned bootstrap credentials when no token is passed in.

## Blockers
- None external. If a developer wants different bootstrap values, they can export env vars before running `scripts/setup-live-env.sh`.
