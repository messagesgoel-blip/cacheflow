# Code Patterns

## [pattern name]
- use when:
- example:
- do not deviate because:

## Sprint Task Key (`id@gate`)
- use when: Referencing any roadmap task in locks, metrics scripts, dashboard updates, or commit notes.
- example: `scripts/update_cacheflow_metrics.py --complete 1.11@MODAL-1`
- do not deviate because: plain numeric IDs are not globally unique across gates and will corrupt state/history.

## Worker Task Completion (`finish_task.sh`)
- use when: Any non-Codex agent completes a claimed task and needs to finish consistently.
- example: `./scripts/finish_task.sh 0.2@TRANSFER-1 --test "npm run test -- transfer" --commit "feat(transfer): add error taxonomy"`
- do not deviate because: ad-hoc completion (manual commit/push/release + direct metrics edits) causes lock leaks and inconsistent status tracking.
