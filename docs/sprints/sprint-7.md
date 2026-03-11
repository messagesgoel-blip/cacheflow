# Sprint 7 Plan

- Status: Draft decomposed, manifest not yet active
- Version: 2
- Theme: Zero-Knowledge Vault
- Entry gate: Version 1 fully green and complete (satisfied)

## Outcome

- Convert the current vault from a hidden-content feature into a zero-knowledge storage mode with browser-owned key material, explicit recovery-kit flows, and locked-state boundaries across Files, Search, and Share.

## Acceptance Gates

- `ZKV-1`: browser-generated key hierarchy, versioned ciphertext envelope, and no server-side persistence of raw vault keys or decrypted vault payloads at rest
- `RECOVERY-1`: unlock, recovery-kit, acknowledgement, and irreversible-loss messaging are explicit and testable across devices
- `MIGRATE-1`: legacy vault users can migrate or defer safely without silent corruption or locked-item leakage

## Draft Task Decomposition

| Task Key | Agent | Scope | Planned Deliverable | Depends On |
| --- | --- | --- | --- | --- |
| `7.1@ZKV-1` | Codex | Architecture and gate freeze | threat model, key hierarchy, ciphertext envelope versioning, and manifest activation checklist | none |
| `7.2@ZKV-1` | OpenCode | Client key hierarchy and ciphertext envelope primitives | implementation-ready scope for browser-side key creation, wrapping, and session unlock boundaries | `7.1@ZKV-1` |
| `7.3@MIGRATE-1` | OpenCode | Provider wrapping, metadata isolation, and migration boundary | server/provider constraints for zero-knowledge metadata, legacy vault coexistence, and migration rollback | `7.1@ZKV-1` |
| `7.4@RECOVERY-1` | ClaudeCode | Unlock, recovery-kit, and irreversible-loss UX | lifecycle copy, flows, warnings, and acknowledgement surfaces for unlock and recovery | `7.1@ZKV-1` |
| `7.5@RECOVERY-1` | ClaudeCode | Locked-item boundary behavior | Files, Search, Share, and sidebar behavior when vault content is locked, missing, or partially migrated | `7.1@ZKV-1`, `7.4@RECOVERY-1` |
| `7.6@ZKV-1` | Gemini | Deterministic crypto and recovery test contract | unit/integration gate design for envelope compatibility, recovery flows, and red-line failure cases | `7.1@ZKV-1`, `7.2@ZKV-1`, `7.4@RECOVERY-1` |
| `7.7@MIGRATE-1` | Gemini | Cross-device unlock and migration safety gate plan | E2E coverage for migration, mixed-state vault users, and recovery-kit loss scenarios | `7.1@ZKV-1`, `7.3@MIGRATE-1`, `7.4@RECOVERY-1` |

## Agent Boundaries

- OpenCode owns crypto feasibility, provider-object wrapping, and migration constraints.
- ClaudeCode owns vault lifecycle UX, locked-state messaging, and irreversible-loss communication.
- Gemini owns deterministic gate design, cross-device test strategy, and migration safety coverage.
- Codex owns gate definitions, task-key freeze, and the later manifest activation step.

## Notes

- Sprint 7 is now the active planning sprint in runtime state.
- The draft decomposition also lives in `docs/contracts/7.1.md`.
- The startup prompt pack already exists at `docs/prompts/sprint-7-startup-all-agents.md`.
- Do not claim draft task keys until they are activated in `docs/orchestration/task-manifest.json`.
