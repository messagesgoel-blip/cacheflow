#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re

import yaml
from cacheflow_paths import resolve_base


BASE = resolve_base()
STATUS_FILE = BASE / "STATUS.md"
STATE_FILE = BASE / "monitoring" / "cacheflow_task_state.yaml"
ORCHESTRATOR_STATE_FILE = BASE / "logs" / "orchestrator-state.json"
LOCK_DIR = BASE / ".context" / "task_locks"
START_MARKER = "<!-- RUNNING_SPRINT_QUEUE:START -->"
END_MARKER = "<!-- RUNNING_SPRINT_QUEUE:END -->"
DONE_STATES = {"done", "complete", "closed", "pass"}
STATUS_LABEL = {
    "planned": "Planned",
    "pending": "Pending",
    "running": "Running",
    "done": "Done",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync running sprint claim queue into STATUS.md")
    parser.add_argument("--sprint", type=int, default=None, help="Override running sprint number")
    return parser.parse_args()


def load_state() -> dict:
    raw = yaml.safe_load(STATE_FILE.read_text()) or {}
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key, rec in raw.items():
        if isinstance(key, str) and isinstance(rec, dict):
            out[key] = rec
    return out


def load_active_locks() -> set[str]:
    active: set[str] = set()
    if not LOCK_DIR.exists():
        return active

    for lock in LOCK_DIR.glob("*.lock"):
        task_key = lock.name[:-5] if lock.name.endswith(".lock") else lock.name
        if task_key:
            active.add(task_key)
    return active


def load_orchestrator_sprint() -> int | None:
    if not ORCHESTRATOR_STATE_FILE.exists():
        return None
    try:
        raw = json.loads(ORCHESTRATOR_STATE_FILE.read_text())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(raw, dict):
        return None
    sprint = raw.get("current_sprint")
    if isinstance(sprint, bool):
        return None
    if isinstance(sprint, int):
        return sprint if sprint > 0 else None
    if isinstance(sprint, float):
        sprint_value = int(sprint) if sprint.is_integer() else None
        return sprint_value if sprint_value and sprint_value > 0 else None
    if isinstance(sprint, str):
        sprint_text = sprint.strip()
        if sprint_text.isdigit():
            sprint_value = int(sprint_text)
            return sprint_value if sprint_value > 0 else None
    return None


def find_running_sprint(status_text: str, state: dict, explicit: int | None) -> int:
    if explicit is not None:
        return explicit

    by_sprint: dict[int, list[str]] = {}
    for rec in state.values():
        sprint = int(rec.get("sprint", 0) or 0)
        status = str(rec.get("status", "planned")).lower()
        by_sprint.setdefault(sprint, []).append(status)

    env_sprint = os.environ.get("CACHEFLOW_RUNNING_SPRINT", "").strip()
    if env_sprint.isdigit():
        return int(env_sprint)

    orchestrator_sprint = load_orchestrator_sprint()
    if orchestrator_sprint is not None:
        return orchestrator_sprint

    m = re.search(r"^- running_sprint:\s*(\d+)\s*$", status_text, flags=re.MULTILINE)
    if m:
        status_sprint = int(m.group(1))
        statuses = by_sprint.get(status_sprint, [])
        if any(st not in DONE_STATES for st in statuses):
            return status_sprint

    incomplete = [s for s, statuses in by_sprint.items() if any(st not in DONE_STATES for st in statuses)]
    if not incomplete:
        return 1

    active = [
        s
        for s, statuses in by_sprint.items()
        if any(st in DONE_STATES for st in statuses) and any(st not in DONE_STATES for st in statuses)
    ]
    if active:
        return min(active)
    return min(incomplete)


def claim_agent_name(agent_label: str) -> str:
    if "ClaudeCode" in agent_label:
        return "ClaudeCode"
    if "OpenCode" in agent_label:
        return "OpenCode"
    if "Gemini" in agent_label:
        return "Gemini"
    if "CODEX" in agent_label or "Codex" in agent_label:
        return "Codex"

    # Fallback: remove symbols and spaces.
    normalized = re.sub(r"[^A-Za-z0-9]+", "", agent_label)
    return normalized or "Agent"


def natural_key(value: str) -> list:
    parts = re.split(r"(\d+)", value)
    key = []
    for part in parts:
        if part.isdigit():
            key.append(int(part))
        else:
            key.append(part.lower())
    return key


def sprint_rows(state: dict, sprint: int, active_locks: set[str]) -> list[dict]:
    rows = []
    for task_key, rec in state.items():
        if int(rec.get("sprint", 0) or 0) != sprint:
            continue
        status_raw = str(rec.get("status", "planned")).lower()
        if status_raw in DONE_STATES:
            continue
        agent = str(rec.get("agent", "Unassigned")).strip() or "Unassigned"
        if task_key in active_locks:
            status_display = "Running"
        else:
            status_display = STATUS_LABEL.get(status_raw, status_raw.title())
        rows.append(
            {
                "task_key": task_key,
                "status": status_display,
                "agent": agent,
                "claim_agent": claim_agent_name(agent),
            }
        )
    rows.sort(key=lambda r: (natural_key(r["task_key"]), natural_key(r["agent"])))
    return rows


def render_block(sprint: int, rows: list[dict]) -> str:
    lines = [
        "## Running Sprint Queue (Auto)",
        f"- running_sprint: {sprint}",
        "- source: `monitoring/cacheflow_task_state.yaml`",
        "- dashboard_owner: `Codex`",
        "",
        "### Finish Conditions",
        "1. Agent side (required): claim task lock, implement, run targeted tests, then run:",
        "   `done-task <task_key> --test \"<targeted test>\" --commit \"<message>\"`",
        "2. Shortcut: `done-task --test \"...\" --commit \"...\"` auto-detects your active lock when unique.",
        "3. `done-task` forwards to `finish_task.sh` for commit/push/release.",
        "4. Do not update shared dashboard/metrics files from worker agents.",
        "5. Codex side (after agent push + lock release): run task completion sync and dashboard/metrics refresh.",
        "6. Codex finalize command:",
        "   `python3 scripts/update_cacheflow_metrics.py --complete <task_key> && ./scripts/refresh_cacheflow_metrics.sh`",
        "",
        "### Claim Queue",
    ]

    if not rows:
        lines.append("- No non-done tasks found for this sprint.")
        return "\n".join(lines)

    lines.extend(
        [
            "| Task Key | Agent | State | Claim Command |",
            "| --- | --- | --- | --- |",
        ]
    )
    for row in rows:
        cmd = f'./agent-coord.sh claim_task {row["task_key"]} {row["claim_agent"]} "$(hostname)"'
        lines.append(
            f'| `{row["task_key"]}` | {row["agent"]} | `{row["status"]}` | `{cmd}` |'
        )
    return "\n".join(lines)


def upsert_block(status_text: str, block: str) -> str:
    managed = f"{START_MARKER}\n{block}\n{END_MARKER}"

    start = status_text.find(START_MARKER)
    end = status_text.find(END_MARKER)
    if start != -1 and end != -1 and end > start:
        end += len(END_MARKER)
        return status_text[:start] + managed + status_text[end:]

    anchor_candidates = ["\n## Agent Notes", "\n## Completed", "\n## Monitoring"]
    for anchor in anchor_candidates:
        idx = status_text.find(anchor)
        if idx != -1:
            prefix = status_text[:idx].rstrip() + "\n\n"
            suffix = status_text[idx:].lstrip("\n")
            return prefix + managed + "\n\n" + suffix

    return status_text.rstrip() + "\n\n" + managed + "\n"


def main() -> int:
    args = parse_args()
    status_text = STATUS_FILE.read_text()
    state = load_state()
    active_locks = load_active_locks()
    sprint = find_running_sprint(status_text, state, args.sprint)
    rows = sprint_rows(state, sprint, active_locks)
    new_text = upsert_block(status_text, render_block(sprint, rows))

    if new_text == status_text:
        print(f"status queue sync: no changes (sprint {sprint})")
        return 0

    STATUS_FILE.write_text(new_text)
    print(f"status queue sync: updated STATUS.md for sprint {sprint} with {len(rows)} queued task(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
