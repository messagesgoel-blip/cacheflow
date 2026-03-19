# ENV-03: Live Provider/Account Baseline

## Goal
Define a stable live provider/account baseline for rerun. Document which provider/account/folders/files/state are required. Add a verification script or checklist that confirms the live account is in the expected state before rerun.

## Baseline State Requirements
For the `V1-4-RERUN` suite to execute deterministically, the test account (`sup@goels.in`) must meet the following criteria:
1. **Session**: The live session must resolve successfully in `web/api/auth/session` with a valid `accessToken`.
2. **Providers**: At least one primary cloud provider (e.g., Google Drive or Dropbox) must be fully authenticated and connected.
3. **Provider Health**: At least one provider must return `healthy` from `web/api/connections/health`.
4. **Data State**:
   - The root directory must contain the seeded fixture files (`normal-file.txt`, `test-document.pdf`, `report.docx`, `image.png`).
   - Quota must have at least 1GB of free space.
5. **Account Settings**: 2FA must be disabled initially, or `ENV-01` must be satisfied so the live rerun can complete its challenge.

## Verification Checklist
A helper script `scripts/verify-live-baseline.sh` is provided to check live session validity, health, provider status, root fixtures, 2FA state, and quota.
Set `REQUIRE_VPS_CONNECTION=true` when the rerun should also enforce a healthy VPS connection.

## Blockers
- **Missing External Access**: I cannot verify the account state programmatically because I lack the live access token for the environment.
- **Action Required**: The user must manually run `scripts/verify-live-baseline.sh` with a valid token and ensure all checks pass before unlocking `V1-4-RERUN`.
