#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

from cacheflow_paths import resolve_base, run_git


BASE = resolve_base()
MANIFEST_FILE = BASE / "docs" / "orchestration" / "task-manifest.json"
UPDATE_SCRIPT = BASE / "scripts" / "update_cacheflow_metrics.py"
REFRESH_SCRIPT = BASE / "scripts" / "refresh_cacheflow_metrics.sh"

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update CacheFlow task state from a git commit or merge event.")
    parser.add_argument("--event", choices=("review", "merge"), required=True)
    parser.add_argument("--commit", default="HEAD", help="Commit-ish to inspect.")
    parser.add_argument("--selector", action="append", default=[], help="Explicit task selector(s) to update.")
    parser.add_argument("--refresh", action="store_true", help="Refresh dashboards after the state update.")
    return parser.parse_args()


def known_task_ids() -> set[str]:
    if not MANIFEST_FILE.exists():
        return set()
    manifest = json.loads(MANIFEST_FILE.read_text())
    return {
        str(task.get("id", "")).strip()
        for task in manifest.get("tasks", [])
        if isinstance(task, dict) and str(task.get("id", "")).strip()
    }


def extract_from_text(task_ids: set[str], text: str) -> set[str]:
    found = set()
    for task_id in task_ids:
        if re.search(rf"(?<![A-Za-z0-9]){re.escape(task_id)}(?![A-Za-z0-9])", text):
            found.add(task_id)
    return found


def extract_from_changed_files(task_ids: set[str], commit_ish: str) -> set[str]:
    changed = run_git(["diff-tree", "-m", "--no-commit-id", "--name-only", "-r", commit_ish])
    found = set()
    for path in changed.splitlines():
        path = path.strip()
        match = re.match(r"^docs/contracts/([A-Za-z0-9.-]+)\.md$", path)
        if not match:
            continue
        task_id = match.group(1)
        if task_id in task_ids:
            found.add(task_id)
    return found


def extract_task_ids(task_ids: set[str], commit_ish: str) -> set[str]:
    message = run_git(["show", "-s", "--format=%B", commit_ish])
    found = extract_from_text(task_ids, message)
    found.update(extract_from_changed_files(task_ids, commit_ish))
    return found


def main() -> None:
    args = parse_args()
    commit_sha = run_git(["rev-parse", f"{args.commit}^{{commit}}"])
    task_ids = sorted(set(args.selector) | extract_task_ids(known_task_ids(), commit_sha))
    if not task_ids:
        print(f"no task ids inferred from {commit_sha}; skipping task-state update")
        return

    message = run_git(["show", "-s", "--format=%s", commit_sha])
    status_flag = "--under-review" if args.event == "review" else "--complete"
    subprocess.run(
        [
            sys.executable,
            str(UPDATE_SCRIPT),
            status_flag,
            *task_ids,
            "--source-commit",
            commit_sha,
            "--source-message",
            message,
        ],
        cwd=str(BASE),
        check=True,
    )
    if args.refresh:
        subprocess.run(["bash", str(REFRESH_SCRIPT)], cwd=str(BASE), check=True)


if __name__ == "__main__":
    main()
