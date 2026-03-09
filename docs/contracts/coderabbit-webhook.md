# CodeRabbit Webhook Contract

## Listener
- Script: `scripts/coderabbit-webhook.ts`
- Port: `9876`
- Route: `POST /github-webhook`
- Secret env var: `GITHUB_WEBHOOK_SECRET`
- Signature header: `x-hub-signature-256` (`sha256=<hex>`)

Requests with missing/invalid signatures are rejected with `401`.

## Payload Filter
The listener only processes payloads where all conditions are true:
- `x-github-event` header is `pull_request_review`
- `payload.action` is `submitted`
- `payload.sender.login` is `coderabbitai[bot]`

Expected fields consumed:
- `pull_request.number` (PR number)
- `review.body` (markdown review body)

All other events return `200` and produce no state file.

## Parsed State Output
On accepted CodeRabbit review events, the listener parses the review body and writes:
- `monitoring/coderabbit-<pr>.yaml`

Written shape:
- `pr: <number>`
- `status: completed`
- `hasBlockers: <boolean>`
- `summary: <string>`
- `suggestions: <string[]>`
- `receivedAt: <ISO timestamp>`
- `agentNotified: false`

## Orchestrator Gate Read Path
`checkCodeRabbitGate(pr)` in `scripts/orchestrate.ts` reads `monitoring/coderabbit-<pr>.yaml` and returns:
- `pending` when file does not exist
- `blocked` when `hasBlockers: true` (with `suggestions`)
- `clear` when `hasBlockers: false` (with `summary`)

On `clear`, orchestrator writes `agentNotified: true` back to the YAML before returning.

Polling behavior in orchestrator:
- Poll interval: `15s`
- Timeout: `20m`
- Every check appended to `logs/codex-audit.jsonl`
- Timeout treated as gate failure
