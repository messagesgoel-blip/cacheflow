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
