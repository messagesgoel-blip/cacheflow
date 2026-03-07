#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

def resolve_base() -> Path:
    explicit = os.environ.get("CACHEFLOW_BASE")
    if explicit:
        return Path(explicit).resolve()
    canonical = Path("/home/sanjay/cacheflow_work")
    if (canonical / ".git").exists():
        return canonical.resolve()
    return Path(__file__).resolve().parent.parent


BASE = resolve_base()
MANIFEST_FILE = BASE / "docs" / "orchestration" / "task-manifest.json"
SPRINT_TASKS_FILE = BASE / "monitoring" / "cacheflow_sprint_tasks.yaml"
METRICS_FILE = BASE / "monitoring" / "cacheflow_metrics.yaml"
STATE_FILE = BASE / "monitoring" / "cacheflow_task_state.yaml"
ORCHESTRATOR_STATE_FILE = BASE / "logs" / "orchestrator-state.json"
HISTORY_FILE = BASE / "monitoring" / "task_history.yaml"
LOCK_DIR = BASE / ".context" / "task_locks"

DONE_STATES = {"done", "complete", "closed", "pass"}
VALID_STATES = {"planned", "pending", "running", "done"}
COMBINED_STAGE_MIN_SPRINT = 6
AGENT_LABELS = {
    "opencode": "\u25C8 OpenCode",
    "claudecode": "\u25C6 ClaudeCode",
    "gemini": "\u25C9 Gemini",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def run_git(args: list[str]) -> str:
    return (
        subprocess.run(
            ["git", *args],
            cwd=str(BASE),
            capture_output=True,
            text=True,
            check=True,
        )
        .stdout.strip()
    )


def load_orchestrator_overrides() -> dict:
    if not ORCHESTRATOR_STATE_FILE.exists():
        return {}
    try:
        data = json.loads(ORCHESTRATOR_STATE_FILE.read_text())
        overrides = data.get("tasks", {})
        if overrides:
            print(f"[sync] orchestrator-state override: {len(overrides)} tasks")
        return overrides
    except Exception:
        return {}


def agent_label(raw_agent: str, sprint: int) -> str:
    normalized = str(raw_agent or "").strip().lower()
    if normalized == "codex":
        if sprint >= COMBINED_STAGE_MIN_SPRINT:
            return "\u2605 CODEX (Cross-agent)"
        return "\u2605 CODEX (Master)"
    return AGENT_LABELS.get(normalized, normalized or "Unassigned")


def parse_tasks() -> list[dict]:
    manifest = json.loads(MANIFEST_FILE.read_text())
    raw_tasks = manifest.get("tasks", [])
    tasks = []
    for raw_task in raw_tasks:
        if not isinstance(raw_task, dict):
            continue

        task_id = str(raw_task.get("id", "")).strip()
        if not task_id:
            continue

        sprint_num = int(raw_task.get("sprint", 0) or 0)
        criteria = [
            str(criterion).strip()
            for criterion in raw_task.get("acceptance_criteria", []) or []
            if str(criterion).strip()
        ]
        files = ", ".join(str(path).strip() for path in raw_task.get("files", []) or [] if str(path).strip())
        base = {
            "id": task_id,
            "description": str(raw_task.get("title", "")).strip(),
            "sprint": sprint_num,
            "files": files,
            "agent": agent_label(str(raw_task.get("agent", "")), sprint_num),
        }

        if not criteria:
            tasks.append(
                {
                    **base,
                    "task_key": task_id,
                    "gate": "",
                    "criteria": [],
                }
            )
            continue

        if sprint_num >= COMBINED_STAGE_MIN_SPRINT:
            combined_gate = "+".join(criteria)
            tasks.append(
                {
                    **base,
                    "task_key": f"{task_id}@{combined_gate}",
                    "gate": combined_gate,
                    "criteria": criteria,
                }
            )
            continue

        for criterion in criteria:
            tasks.append(
                {
                    **base,
                    "task_key": f"{task_id}@{criterion}",
                    "gate": criterion,
                    "criteria": [criterion],
                }
            )
    return tasks


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Regenerate CacheFlow sprint metrics from roadmap.")
    parser.add_argument("--complete", nargs="*", default=[], help="Mark task(s) done. Accepts task id or id@gate.")
    parser.add_argument("--running", nargs="*", default=[], help="Mark task(s) running.")
    parser.add_argument("--pending", nargs="*", default=[], help="Mark task(s) pending.")
    parser.add_argument("--planned", nargs="*", default=[], help="Mark task(s) planned.")
    parser.add_argument("--note", default="", help="Optional changelog note override for status changes.")
    return parser.parse_args()


def load_active_locks() -> set[str]:
    active: set[str] = set()
    if not LOCK_DIR.exists():
        return active

    for lock_dir in LOCK_DIR.glob("*.lock"):
        meta_file = lock_dir / "meta.json"
        if not meta_file.exists():
            continue
        try:
            payload = json.loads(meta_file.read_text())
        except Exception:
            continue

        task_key = str(payload.get("task_id") or "").strip()
        if task_key:
            active.add(task_key)

    return active


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    raw = yaml.safe_load(STATE_FILE.read_text()) or {}
    if not isinstance(raw, dict):
        return {}
    return raw


def _selector_matches(task: dict, selector: str) -> bool:
    selector = selector.strip()
    if not selector:
        return False
    if selector == task["task_key"]:
        return True
    if "@" in selector:
        return False
    return selector == task["id"]


def _status_map(args: argparse.Namespace) -> dict:
    return {
        "done": set(args.complete),
        "running": set(args.running),
        "pending": set(args.pending),
        "planned": set(args.planned),
    }


def _lookup_previous(existing_state: dict, task: dict) -> dict:
    previous = existing_state.get(task["task_key"], {})
    if isinstance(previous, str):
        return {"status": previous}
    if isinstance(previous, dict) and previous:
        return previous

    id_matches = []
    for rec in existing_state.values():
        if not isinstance(rec, dict):
            continue
        if str(rec.get("id", "")).strip() != task["id"]:
            continue
        id_matches.append(rec)

    if not id_matches:
        return {}

    same_sprint = [rec for rec in id_matches if int(rec.get("sprint", 0) or 0) == int(task["sprint"])]
    if len(same_sprint) == 1:
        return same_sprint[0]
    if same_sprint:
        return same_sprint[0]
    return id_matches[0]


def apply_state(tasks: list[dict], args: argparse.Namespace) -> tuple[list[dict], dict, list[dict]]:
    existing_state = load_state()
    orchestrator_overrides = load_orchestrator_overrides()
    state_out = {}
    changes = []
    commit_full = run_git(["rev-parse", "HEAD"])
    commit_short = commit_full[:12]
    message = run_git(["log", "-1", "--pretty=%s"])
    timestamp = now_iso()
    selectors = _status_map(args)
    active_locks = load_active_locks()

    for task in tasks:
        key = task["task_key"]
        previous = _lookup_previous(existing_state, task)

        record = {
            "status": previous.get("status", "planned"),
            "commit": previous.get("commit", ""),
            "done_at": previous.get("done_at", ""),
            "changelog": previous.get("changelog", ""),
        }

        target_status = None
        # Priority 1: Command line arguments
        for candidate_status in ("done", "running", "pending", "planned"):
            for selector in selectors[candidate_status]:
                if _selector_matches(task, selector):
                    target_status = candidate_status
                    break
            if target_status:
                break

        # Priority 2: Orchestrator state override
        orchestrator_status = orchestrator_overrides.get(key) or orchestrator_overrides.get(task["id"])
        if orchestrator_status in VALID_STATES:
            target_status = orchestrator_status

        # Priority 3: Active locks (implies running)
        if not target_status and key in active_locks and str(record.get("status", "")).lower() not in DONE_STATES:
            target_status = "running"

        # If a task was previously running but has no active lock now, reset it to planned.
        # This prevents stale running states after agent crashes or manual lock cleanup.
        if (
            not target_status
            and str(record.get("status", "")).lower() == "running"
            and key not in active_locks
        ):
            target_status = "planned"

        if target_status:
            if target_status == "done":
                record["status"] = "done"
                record["commit"] = commit_short
                record["done_at"] = timestamp
                record["changelog"] = args.note.strip() or message
            else:
                record["status"] = target_status
                if target_status in ("planned", "pending", "running"):
                    # Non-done states should never carry completion metadata.
                    record["commit"] = ""
                    record["done_at"] = ""
                    record["changelog"] = ""

        status = str(record.get("status", "planned")).lower()
        if status not in VALID_STATES:
            status = "planned"
            record["status"] = status

        if status in DONE_STATES and not record.get("commit"):
            record["commit"] = commit_short
            record["done_at"] = record.get("done_at") or timestamp
            record["changelog"] = record.get("changelog") or (args.note.strip() or message)

        task["status"] = status
        task["commit"] = record.get("commit", "")
        task["done_at"] = record.get("done_at", "")
        task["changelog"] = record.get("changelog", "")

        state_out[key] = {
            "id": task["id"],
            "task_key": key,
            "gate": task["gate"],
            "criteria": task.get("criteria", []),
            "sprint": task["sprint"],
            "agent": task["agent"],
            "status": task["status"],
            "commit": task["commit"],
            "done_at": task["done_at"],
            "changelog": task["changelog"],
        }

        before_status = str(previous.get("status", "planned")).lower()
        if before_status not in VALID_STATES:
            before_status = "planned"
        if before_status != task["status"]:
            changes.append(
                {
                    "task_key": key,
                    "id": task["id"],
                    "gate": task["gate"],
                    "from": before_status,
                    "to": task["status"],
                }
            )

    return tasks, state_out, changes


def compute_metrics(tasks: list[dict], previous_metrics: dict) -> dict:
    sprints = defaultdict(list)
    gates = defaultdict(list)
    for task in tasks:
        sprints[int(task["sprint"])].append(task)
        criteria = task.get("criteria") or [task.get("gate", "")]
        for criterion in criteria:
            criterion_name = str(criterion).strip()
            if criterion_name:
                gates[criterion_name].append(task)

    sprint_rows = []
    current_sprint = 0
    first_open_sprint = None
    running_sprints = []
    total_done = 0
    total_running = 0

    for sprint in sorted(sprints):
        sprint_tasks = sprints[sprint]
        total = len(sprint_tasks)
        done = sum(1 for t in sprint_tasks if t["status"] in DONE_STATES)
        running = sum(1 for t in sprint_tasks if t["status"] == "running")
        pending = sum(1 for t in sprint_tasks if t["status"] == "pending")
        planned = sum(1 for t in sprint_tasks if t["status"] == "planned")
        commits = {t["commit"] for t in sprint_tasks if t.get("commit")}
        progress = round((done / total) * 100, 2) if total else 0.0
        sprint_rows.append(
            {
                "sprint": sprint,
                "total_tasks": total,
                "done_tasks": done,
                "running_tasks": running,
                "pending_tasks": pending,
                "planned_tasks": planned,
                "progress": progress,
                "commits_total": len(commits),
            }
        )
        total_done += done
        total_running += running
        if done < total and first_open_sprint is None:
            first_open_sprint = sprint
        if running > 0:
            running_sprints.append(sprint)

    if running_sprints:
        current_sprint = min(running_sprints)
    elif first_open_sprint is not None:
        current_sprint = first_open_sprint
    elif sprint_rows:
        current_sprint = sprint_rows[-1]["sprint"]

    current_progress = 0.0
    for row in sprint_rows:
        if row["sprint"] == current_sprint:
            current_progress = row["progress"]
            break

    gate_status = {}
    for gate, gate_tasks in gates.items():
        done = all(t["status"] in DONE_STATES for t in gate_tasks)
        running = any(t["status"] == "running" for t in gate_tasks)
        pending = any(t["status"] == "pending" for t in gate_tasks)
        if done:
            gate_status[gate] = "done"
        elif running:
            gate_status[gate] = "running"
        elif pending:
            gate_status[gate] = "pending"
        else:
            gate_status[gate] = "open"

    previous_start = int(previous_metrics.get("sprint_start", 0)) if isinstance(previous_metrics, dict) else 0
    if previous_start <= 0:
        previous_start = int(datetime.now(timezone.utc).timestamp())

    return {
        "generated_at": now_iso(),
        "current_sprint": current_sprint,
        "sprint_progress": current_progress,
        "sprint_start": previous_start,
        "running_tasks": total_running,
        "tasks_completed_total": total_done,
        "total_tasks": len(tasks),
        "total_sprints": len(sprint_rows),
        "gate_status": gate_status,
        "sprints": sprint_rows,
        "tasks": tasks,
    }


def load_previous_metrics() -> dict:
    if not METRICS_FILE.exists():
        return {}
    loaded = yaml.safe_load(METRICS_FILE.read_text()) or {}
    if isinstance(loaded, dict):
        return loaded
    return {}


def write_yaml(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(payload, sort_keys=False))


def record_history(changes: list[dict], tasks: list[dict]) -> None:
    if not changes:
        return
    history = []
    if HISTORY_FILE.exists():
        history = yaml.safe_load(HISTORY_FILE.read_text()) or []
    commit_full = run_git(["rev-parse", "HEAD"])
    message = run_git(["log", "-1", "--pretty=%s"])
    done_keys = [c["task_key"] for c in changes if c["to"] == "done"]
    done_ids = sorted(
        {
            t["id"]
            for t in tasks
            if t["task_key"] in set(done_keys)
        }
    )
    history.append(
        {
            "timestamp": now_iso(),
            "commit": commit_full,
            "message": message,
            "changed": changes,
            "done_task_keys": done_keys,
            "done_tasks": done_ids,
        }
    )
    HISTORY_FILE.write_text(yaml.safe_dump(history, sort_keys=False))


def main() -> None:
    args = parse_args()
    parsed_tasks = parse_tasks()
    tasks, state_out, changes = apply_state(parsed_tasks, args)
    previous_metrics = load_previous_metrics()
    metrics = compute_metrics(tasks, previous_metrics)

    write_yaml(SPRINT_TASKS_FILE, {"generated_at": metrics["generated_at"], "tasks": tasks})
    write_yaml(STATE_FILE, state_out)
    write_yaml(METRICS_FILE, metrics)
    record_history(changes, tasks)

    print(f"wrote {len(tasks)} task entries to {SPRINT_TASKS_FILE}")
    print(f"wrote metrics to {METRICS_FILE}")
    if changes:
        print(f"recorded {len(changes)} task state changes to {HISTORY_FILE}")


if __name__ == "__main__":
    main()
