# Deployment Constraints

## Purpose

This project must run on a stateful, long-running Node.js runtime to satisfy `SSE-1` and `TRANSFER-1`.

- `SSE-1`: SSE connections must stay open and stable for real-time transfer progress.
- `TRANSFER-1`: Background transfer workers must keep running across requests and retries.

## Required Runtime Profile

The deployment target MUST provide all of the following:

1. Long-lived Node.js processes (not request-scoped function instances)
2. Persistent HTTP connections for Server-Sent Events (SSE)
3. Long-running background job workers (BullMQ)
4. Stable Redis connectivity for queue + pub/sub lifecycle

## Allowed Targets

Examples of acceptable targets:

- Docker containers (single host or orchestrated)
- Kubernetes Deployments/StatefulSets
- VM or bare-metal Node.js services managed by systemd/pm2/supervisor

## Prohibited Targets

The following are explicitly disallowed for production and CI gate compliance:

- Vercel Functions / Vercel Edge Functions
- Netlify Functions / Edge Functions
- AWS Lambda / Lambda@Edge
- Cloudflare Workers
- Any serverless or edge runtime that cannot guarantee long-lived worker + SSE lifecycles

## CI Enforcement

CI MUST run:

- `scripts/check-deployment-target.sh`

The script fails when:

- `DEPLOYMENT_TARGET` is set to a blocked serverless/edge target
- `vercel.json` exists at repository root
- `netlify.toml` exists at repository root
- Cloudflare Workers or Serverless Framework manifests exist at repository root (`wrangler.*`, `serverless.*`)
- Lambda function definitions are detected in root deployment manifests

## Configuration

`.env.example` defines the baseline runtime target:

```bash
DEPLOYMENT_TARGET=docker
```

Use a long-running target value in CI and deployment environments.
