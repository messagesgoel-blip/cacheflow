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
| scripts/watch_pr_feedback.py | Poll GitHub PR reviews every 5 min and notify the owning agent when CodeRabbit feedback arrives |
| scripts/setup-dev-tools.sh | One-shot install of all tools |
| scripts/coderabbit-webhook.ts | Entry point for review completion events |

## PR Feedback Watch

- `python3 scripts/watch_pr_feedback.py start --agent <Agent> --task <TASK>` launches a background watcher for the current branch PR.
- Default heartbeat interval is `300` seconds.
- On new CodeRabbit review feedback, the watcher:
  - writes `monitoring/coderabbit-<pr>.yaml`
  - appends a message to `logs/notifications.txt`
  - appends a message to `.context/cache_state/agent_notifications/<Agent>.log`
  - attempts to write a direct terminal notification to any TTYs mapped to that agent in `/tmp/cacheflow_agent_tty_map`
- Watcher state is stored under `.context/cache_state/pr_feedback_watch/pr-<pr>.json`.

## Review Logic (lib/coderabbit/)

- `parseReview.ts` — extracts structure from CodeRabbit payloads
- `writeReviewState.ts` — persists review signal for orchestrator triage

## GitHub Actions

- `.github/workflows/coderabbit-pre-merge.yml` — runs on agent-opened PRs only
