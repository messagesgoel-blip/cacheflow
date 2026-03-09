# Contract: Dev Tools CLI Setup

## Tools installed

- `linearis` — Linear CLI (npm global)
- `coderabbit` — CodeRabbit CLI (npm global)

## Required env vars

| Var | Used by | Where set |
|-----|---------|-----------|
| LINEAR_API_TOKEN | linearis | ~/.linear_api_token or env |
| CODERABBIT_API_KEY | coderabbit auth | env |

## Scripts exposed to orchestrate.ts

| Script | Purpose |
|--------|---------|
| scripts/linear-sprint-sync.sh <ID> <STATUS> | Update ticket status |
| scripts/linear-create-issue.sh <TITLE> <TEAM> | Create ticket, returns ID |
| scripts/pre-push-review.sh | Run CodeRabbit before push, exits 1 on blockers |
| scripts/coderabbit-local-review.sh | Launch/poll async local CodeRabbit review for the current branch |
| scripts/setup-dev-tools.sh | One-shot install of all tools |
| scripts/coderabbit-webhook.ts | Entry point for review completion events |

## Local async review

- `scripts/coderabbit-local-review.sh start --type committed` launches a background review for the current branch.
- Default mode is `--prompt-only` so agent-facing output lands in `logs/coderabbit-local-<branch>.log`.
- Status is persisted to `monitoring/coderabbit-local-<branch>.yaml`.
- `.githooks/pre-push` and `scripts/finish_task.sh` launch this async review instead of blocking on CLI completion.

## Review Logic (lib/coderabbit/)

- `parseReview.ts` — extracts structure from CodeRabbit payloads
- `writeReviewState.ts` — persists review signal for orchestrator triage

## GitHub Actions

- `.github/workflows/coderabbit-pre-merge.yml` — runs on agent-opened PRs only
