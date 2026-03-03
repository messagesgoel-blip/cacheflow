#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from pathlib import Path

import yaml


BASE = Path(
    os.environ.get(
        "CACHEFLOW_BASE",
        str(Path(__file__).resolve().parent.parent),
    )
).resolve()

DASHBOARD = BASE / "docs" / "sprints-task-dashboard.md"
STATE_FILE = BASE / "monitoring" / "cacheflow_task_state.yaml"

STATUS_LABEL = {
    "planned": "Planned",
    "pending": "Pending",
    "running": "Running",
    "done": "Done",
}


def progress_bar(percent: int) -> str:
    filled = max(0, min(10, int(round(percent / 10))))
    return "[" + ("█" * filled) + ("░" * (10 - filled)) + "]"


def load_state() -> dict:
    raw = yaml.safe_load(STATE_FILE.read_text()) or {}
    return raw if isinstance(raw, dict) else {}


def sprint_stats(state: dict) -> dict[int, dict]:
    rows: dict[int, list] = {}
    for rec in state.values():
        if not isinstance(rec, dict):
            continue
        sprint = int(rec.get("sprint", 0))
        rows.setdefault(sprint, []).append(rec)

    out: dict[int, dict] = {}
    for sprint, entries in rows.items():
        total = len(entries)
        done = sum(1 for e in entries if str(e.get("status", "")).lower() == "done")
        progress = round((done / total) * 100) if total else 0
        commits = {
            str(e.get("commit", "")).strip()
            for e in entries
            if str(e.get("commit", "")).strip()
        }
        out[sprint] = {
            "done": done,
            "total": total,
            "progress": progress,
            "commits": len(commits),
        }
    return out


def sync_dashboard() -> int:
    state = load_state()
    stats = sprint_stats(state)
    lines = DASHBOARD.read_text().splitlines()

    updated = []
    current_sprint = None
    changed = 0

    for line in lines:
        sprint_match = re.match(r"^## Sprint\s+(\d+)\s*$", line)
        if sprint_match:
            current_sprint = int(sprint_match.group(1))
            updated.append(line)
            continue

        if current_sprint is not None and line.startswith("- Progress:"):
            s = stats.get(current_sprint, {"done": 0, "total": 0, "progress": 0, "commits": 0})
            new_line = (
                f"- Progress: `{progress_bar(s['progress'])} {s['progress']}%` "
                f"({s['done']} / {s['total']} completed)"
            )
            if new_line != line:
                changed += 1
            updated.append(new_line)
            continue

        if current_sprint is not None and line.startswith("- Total commits:"):
            s = stats.get(current_sprint, {"done": 0, "total": 0, "progress": 0, "commits": 0})
            new_line = f"- Total commits: `{s['commits']}` (update after commit + update script)"
            if new_line != line:
                changed += 1
            updated.append(new_line)
            continue

        if (
            line.startswith("|")
            and not line.startswith("| ---")
            and not line.startswith("| Task ID")
            and not line.startswith("| ID ")
        ):
            parts = [p.strip() for p in line.strip("|").split("|")]
            if len(parts) >= 7:
                task_id, desc, agent = parts[0], parts[1], parts[2]
                gate_match = re.search(r"\(Gate ([^)]+)\)", desc)
                if gate_match:
                    task_key = f"{task_id}@{gate_match.group(1)}"
                    rec = state.get(task_key)
                    if isinstance(rec, dict):
                        status_raw = str(rec.get("status", "planned")).lower()
                        status = STATUS_LABEL.get(status_raw, "Planned")
                        commit = str(rec.get("commit", "")).strip()
                        done_at = str(rec.get("done_at", "")).strip()
                        changelog = str(rec.get("changelog", "")).strip()
                        new_line = (
                            f"| {task_id} | {desc} | {agent} | {status} | "
                            f"{(commit[:7] if commit else '—')} | "
                            f"{(done_at if done_at else '—')} | "
                            f"{(changelog if changelog else '—')} |"
                        )
                        if new_line != line:
                            changed += 1
                        updated.append(new_line)
                        continue

        updated.append(line)

    DASHBOARD.write_text("\n".join(updated) + "\n")
    return changed


if __name__ == "__main__":
    count = sync_dashboard()
    print(f"dashboard sync: {count} lines updated")
