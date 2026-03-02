# Code Patterns

## [pattern name]
- use when:
- example:
- do not deviate because:

## Sprint Task Key (`id@gate`)
- use when: Referencing any roadmap task in locks, metrics scripts, dashboard updates, or commit notes.
- example: `scripts/update_cacheflow_metrics.py --complete 1.11@MODAL-1`
- do not deviate because: plain numeric IDs are not globally unique across gates and will corrupt state/history.
