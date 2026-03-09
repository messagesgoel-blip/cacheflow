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
| scripts/setup-dev-tools.sh | One-shot install of all tools |

## GitHub Actions
- `.github/workflows/coderabbit-pre-merge.yml` — runs on agent-opened PRs only
