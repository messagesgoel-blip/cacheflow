# Contract: GEMINI-PORT-1

- producer: codero
- agent: gemini
- repo: cacheflow
- branch: main
- created_utc: 2026-03-20T01:15:10Z
- status: draft

## Interface Summary
Validate that the Gemini task wrappers and launcher plumbing stay repo-agnostic.
The task is intentionally generic and should not depend on CacheFlow-specific
paths, env names, or worktree defaults.

## Inputs
- `scripts/start_sprint.sh`
- `scripts/finish_task.sh`
- `scripts/done_task.sh`
- `scripts/watch_pr_feedback.py`
- `scripts/spring_startup.sh`

## Outputs
- A verification note that the Gemini launcher path is generic enough to work
  from non-CacheFlow repos.
- Any remaining repo-specific assumptions found in the task wrappers.

## Invariants
- No `CACHEFLOW_*` launcher env names.
- No hardcoded CacheFlow worktree fallback.
- No hardcoded personal home path in the active launcher path.
- `GEMINI_INCLUDE_DIRECTORIES` may extend access, and the default launcher path includes `/opt` and `/srv`.

## Versioning
- version: v1
- breaking_change_policy: bump major section/version and notify consumers
