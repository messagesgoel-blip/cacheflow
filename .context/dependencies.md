# Dependencies

## [dependency name]
- version:
- why chosen:

## jsonwebtoken
- version: ^9.0.3 (runtime) / @types/jsonwebtoken ^9.0.10 (dev)
- why chosen: Required by Next API auth/proxy routes in web app to support token sign/verify at build/runtime.

## ts-node
- version: ^10.9.2
- why chosen: Runs `scripts/orchestrate.ts` and `scripts/recover.ts` directly in CI/manual orchestration flows without a separate build step.

## typescript
- version: ^5.9.3
- why chosen: Provides strict typing for orchestrator state machine, manifest parsing, and recovery tooling.

## @types/node
- version: ^25.3.3
- why chosen: Node runtime typings for filesystem/process/child-process APIs used by orchestration scripts.
