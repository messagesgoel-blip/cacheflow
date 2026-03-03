# Mistakes & Dead Ends

## YYYY-MM-DD — [title]
- what was tried:
- why it failed:
- do not attempt:
- agent:

## 2026-03-02 — Plain task IDs in state files
- what was tried: Persisting task state with only numeric IDs (for example `1.1`) without gate context.
- why it failed: IDs are reused in multiple gates, causing collisions and incorrect status/commit attribution.
- do not attempt: Do not key state/history by numeric ID alone; always use `id@gate`.
- agent: codex

## 2026-03-03 — Missing `.context/task_locks` reported as "already claimed"
- what was tried: Running `./agent-coord.sh claim_task <id@gate>` before `.context/task_locks` existed.
- why it failed: `mkdir` failed on missing parent path, but script mapped all failures to "already claimed", causing false lock conflicts.
- do not attempt: Do not assume claim failures are real conflicts unless lock directory and `meta.json` exist; initialize lock directories first.
- agent: codex
