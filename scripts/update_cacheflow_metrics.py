#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

import yaml
from cacheflow_paths import resolve_base, run_git


BASE = resolve_base()
MANIFEST_FILE = BASE / "docs" / "orchestration" / "task-manifest.json"
ROADMAP_CATALOG_FILE = BASE / "monitoring" / "cacheflow_roadmap_items.yaml"
SPRINT_TASKS_FILE = BASE / "monitoring" / "cacheflow_sprint_tasks.yaml"
METRICS_FILE = BASE / "monitoring" / "cacheflow_metrics.yaml"
STATE_FILE = BASE / "monitoring" / "cacheflow_task_state.yaml"
ORCHESTRATOR_STATE_FILE = BASE / "logs" / "orchestrator-state.json"
HISTORY_FILE = BASE / "monitoring" / "task_history.yaml"
LOCK_DIR = BASE / ".context" / "task_locks"

DONE_STATES = {"done", "complete", "closed", "pass"}
VALID_STATES = {"planned", "pending", "running", "active", "under_review", "done", "complete"}
COMBINED_STAGE_MIN_SPRINT = 6
AGENT_LABELS = {
    "opencode": "\u25C8 OpenCode",
    "claudecode": "\u25C6 ClaudeCode",
    "gemini": "\u25C9 Gemini",
}
ROADMAP_VERSION_TITLES = {
    "1": "Version 1",
    "2": "Version 2",
}
ROADMAP_STAGE_DEFS = {
    "V1-0": {"title": "Release Blocker", "roadmap_version": "1", "order": 0},
    "V1-1": {"title": "Core Platform", "roadmap_version": "1", "order": 1},
    "V1-2": {"title": "Power User Essentials", "roadmap_version": "1", "order": 2},
    "V1-3": {"title": "Power User Completion", "roadmap_version": "1", "order": 3},
    "V2-A": {"title": "Foundation", "roadmap_version": "2", "order": 4},
    "V2-B": {"title": "Easy Wins", "roadmap_version": "2", "order": 5},
    "V2-C": {"title": "Moderate", "roadmap_version": "2", "order": 6},
    "V2-D": {"title": "Advanced", "roadmap_version": "2", "order": 7},
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def load_orchestrator_state_file() -> dict:
    if not ORCHESTRATOR_STATE_FILE.exists():
        return {}
    try:
        payload = json.loads(ORCHESTRATOR_STATE_FILE.read_text())
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def load_roadmap_catalog() -> list[dict]:
    if not ROADMAP_CATALOG_FILE.exists():
        return []
    try:
        raw = yaml.safe_load(ROADMAP_CATALOG_FILE.read_text()) or {}
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as exc:
        print(f"update_cacheflow_metrics: failed to load roadmap catalog {ROADMAP_CATALOG_FILE}: {exc}", file=sys.stderr)
        return []

    if not isinstance(raw, dict):
        print(f"update_cacheflow_metrics: expected dict in {ROADMAP_CATALOG_FILE}, got {type(raw).__name__}", file=sys.stderr)
        return []
    items = raw.get("items", [])
    if not isinstance(items, list):
        print(f"update_cacheflow_metrics: expected list at {ROADMAP_CATALOG_FILE}:items", file=sys.stderr)
        return []
    return items


def roadmap_stage_for_sprint(sprint: int) -> str:
    if sprint <= 5:
        return "V1-1"
    if 7 <= sprint <= 11:
        return "V2-A"
    if 12 <= sprint <= 14:
        return "V2-B"
    if 15 <= sprint <= 17:
        return "V2-C"
    if 18 <= sprint <= 20:
        return "V2-D"
    return "V1-2"


def roadmap_stage_for_task(task: dict) -> str:
    sprint = int(task.get("sprint", 0) or 0)
    task_id = str(task.get("id", "")).strip()
    if sprint == 6:
        if task_id in {"6.1", "6.2", "6.3"}:
            return "V1-2"
        return "V1-3"
    return roadmap_stage_for_sprint(sprint)


def annotate_task_metadata(task: dict) -> None:
    stage = roadmap_stage_for_task(task)
    stage_meta = ROADMAP_STAGE_DEFS.get(stage, ROADMAP_STAGE_DEFS["V1-2"])
    version = stage_meta["roadmap_version"]
    task["roadmap_stage"] = stage
    task["roadmap_stage_title"] = stage_meta["title"]
    task["roadmap_version"] = version
    task["roadmap_version_title"] = ROADMAP_VERSION_TITLES.get(version, f"Version {version}")


def normalize_status(raw_status: str) -> str:
    status = str(raw_status or "").strip().lower()
    if status in DONE_STATES:
        return "done"
    if status == "active":
        return "running"
    if status in VALID_STATES:
        return status
    return "planned"


def reduce_status(statuses: list[str], default: str = "planned") -> str:
    normalized = [normalize_status(status) for status in statuses if str(status).strip()]
    if not normalized:
        return default
    if all(status == "done" for status in normalized):
        return "done"
    if any(status == "running" for status in normalized):
        return "running"
    if any(status == "under_review" for status in normalized):
        return "under_review"
    if any(status == "pending" for status in normalized):
        return "pending"
    if any(status == "planned" for status in normalized):
        return "planned"
    return default


def count_statuses(statuses: list[str]) -> dict[str, int]:
    counts = {"done": 0, "running": 0, "under_review": 0, "pending": 0, "planned": 0}
    for status in statuses:
        counts[normalize_status(status)] += 1
    return counts


def gate_item_status(current_state: str) -> str:
    state = str(current_state or "").strip().lower()
    if state in {"gate_passed", "done", "green"}:
        return "done"
    if "gate" in state or "patch" in state or "verify" in state:
        return "running"
    if state:
        return "pending"
    return "planned"


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
            task = {
                **base,
                "task_key": task_id,
                "gate": "",
                "criteria": [],
            }
            annotate_task_metadata(task)
            tasks.append(task)
            continue

        if sprint_num >= COMBINED_STAGE_MIN_SPRINT:
            combined_gate = "+".join(criteria)
            task = {
                **base,
                "task_key": f"{task_id}@{combined_gate}",
                "gate": combined_gate,
                "criteria": criteria,
            }
            annotate_task_metadata(task)
            tasks.append(task)
            continue

        for criterion in criteria:
            task = {
                **base,
                "task_key": f"{task_id}@{criterion}",
                "gate": criterion,
                "criteria": [criterion],
            }
            annotate_task_metadata(task)
            tasks.append(task)
    return tasks


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Regenerate CacheFlow sprint metrics from roadmap.")
    parser.add_argument("--complete", nargs="*", default=[], help="Mark task(s) done. Accepts task id or id@gate.")
    parser.add_argument("--running", nargs="*", default=[], help="Mark task(s) running.")
    parser.add_argument("--pending", nargs="*", default=[], help="Mark task(s) pending.")
    parser.add_argument("--planned", nargs="*", default=[], help="Mark task(s) planned.")
    parser.add_argument("--under-review", nargs="*", default=[], help="Mark task(s) under review.")
    parser.add_argument("--source-commit", default="", help="Override commit used for task provenance.")
    parser.add_argument("--source-message", default="", help="Override changelog message used for state changes.")
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
        "under_review": set(args.under_review),
        "pending": set(args.pending),
        "planned": set(args.planned),
    }


def load_done_history() -> tuple[dict[str, dict], dict[str, dict]]:
    if not HISTORY_FILE.exists():
        return {}, {}
    try:
        raw = yaml.safe_load(HISTORY_FILE.read_text()) or []
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as exc:
        print(f"update_cacheflow_metrics: failed to load task history {HISTORY_FILE}: {exc}", file=sys.stderr)
        return {}, {}
    if not isinstance(raw, list):
        return {}, {}

    out: dict[str, dict] = {}
    by_id: dict[str, dict] = {}
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        timestamp = str(entry.get("timestamp", "")).strip()
        commit = str(entry.get("commit", "")).strip()
        message = str(entry.get("message", "")).strip()
        payload = {
            "commit": commit[:12],
            "done_at": timestamp,
            "changelog": message,
        }
        for task_key in entry.get("done_task_keys", []) or []:
            key = str(task_key).strip()
            if not key:
                continue
            out[key] = payload
            task_id = key.split("@", 1)[0]
            if task_id:
                by_id[task_id] = payload
        for done_task_id in entry.get("done_tasks", []) or []:
            done_task_id = str(done_task_id).strip()
            if done_task_id:
                by_id[done_task_id] = payload
    return out, by_id


def parse_sprint_number(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None

    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return int(text)

    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else None


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


def build_roadmap_items(tasks: list[dict], orchestrator_state: dict, roadmap_catalog: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    tasks_by_id: dict[str, list[dict]] = defaultdict(list)
    for task in tasks:
        tasks_by_id[str(task["id"])].append(task)

    items: list[dict] = []
    current_state = str(orchestrator_state.get("current_state", "")).strip()
    core_rows = [task for task in tasks if int(task.get("sprint", 0) or 0) <= 5]
    core_statuses = [task["status"] for task in core_rows]
    core_counts = count_statuses(core_statuses)
    core_total = len(core_rows)
    core_done = core_counts["done"]
    orchestrator_tasks = orchestrator_state.get("tasks", {})
    if not isinstance(orchestrator_tasks, dict):
        orchestrator_tasks = {}
    orchestrator_sprint = parse_sprint_number(orchestrator_state.get("current_sprint")) or 0

    for item in roadmap_catalog:
        item_id = str(item.get("item_id", "")).strip()
        if not item_id:
            continue

        stage = str(item.get("stage", "")).strip()
        roadmap_version = str(item.get("roadmap_version", "")).strip()
        stage_title = str(item.get("stage_title", "")).strip()
        roadmap_version_title = str(item.get("roadmap_version_title", "")).strip()
        item_type = str(item.get("item_type", "")).strip() or "execution"
        sprint_label = str(item.get("sprint", "")).strip()

        status = "planned"
        progress = 0.0
        criteria_count = 1
        done_criteria = 0

        if item_id == "V1-0":
            gate_status = gate_item_status(current_state)
            if gate_status != "done" and core_total and core_done == core_total and all(
                key in tasks_by_id
                and tasks_by_id[key]
                and all(t["status"] in DONE_STATES for t in tasks_by_id[key])
                for key in ("6.1", "6.2", "6.3", "6.4", "6.5", "6.6")
            ):
                gate_status = "done"
            status = gate_status
            progress = 100.0 if status == "done" else 0.0
            done_criteria = 1 if status == "done" else 0
        elif item_id == "V1-1":
            status = reduce_status(core_statuses, default="planned")
            progress = round((core_done / core_total) * 100, 2) if core_total else 0.0
            criteria_count = core_total
            done_criteria = core_done
        elif item_id in tasks_by_id:
            rows = tasks_by_id[item_id]
            statuses = [row["status"] for row in rows]
            counts = count_statuses(statuses)
            total = len(rows)
            status = reduce_status(statuses, default="planned")
            progress = round((counts["done"] / total) * 100, 2) if total else 0.0
            criteria_count = total
            done_criteria = counts["done"]
        else:
            status = normalize_status(orchestrator_tasks.get(item_id, "pending"))
            sprint_num = parse_sprint_number(sprint_label) or 0
            if status in {"planned", "pending"} and orchestrator_sprint == sprint_num:
                status = "running"
            progress = 100.0 if status == "done" else 0.0
            done_criteria = 1 if status == "done" else 0

        items.append(
            {
                "item_id": item_id,
                "title": str(item.get("title", "")).strip(),
                "sprint": sprint_label,
                "roadmap_version": roadmap_version,
                "roadmap_version_title": roadmap_version_title,
                "stage": stage,
                "stage_title": stage_title,
                "status": status,
                "progress": progress,
                "criteria_count": criteria_count,
                "done_criteria": done_criteria,
                "item_type": item_type,
            }
        )

    stage_rows = []
    for stage_key, stage_meta in sorted(ROADMAP_STAGE_DEFS.items(), key=lambda pair: pair[1]["order"]):
        stage_items = [item for item in items if item["stage"] == stage_key]
        stage_statuses = [item["status"] for item in stage_items]
        counts = count_statuses(stage_statuses)
        total = len(stage_items)
        done = counts["done"]
        stage_rows.append(
            {
                "stage": stage_key,
                "title": stage_meta["title"],
                "roadmap_version": stage_meta["roadmap_version"],
                "roadmap_version_title": ROADMAP_VERSION_TITLES[stage_meta["roadmap_version"]],
                "total_items": total,
                "done_items": done,
                "running_items": counts["running"],
                "under_review_items": counts["under_review"],
                "pending_items": counts["pending"],
                "planned_items": counts["planned"],
                "progress": round((done / total) * 100, 2) if total else 0.0,
                "status": reduce_status(stage_statuses, default="planned"),
            }
        )

    version_rows = []
    for version, title in ROADMAP_VERSION_TITLES.items():
        version_items = [item for item in items if item["roadmap_version"] == version]
        statuses = [item["status"] for item in version_items]
        counts = count_statuses(statuses)
        total = len(version_items)
        done = counts["done"]
        version_rows.append(
            {
                "roadmap_version": version,
                "title": title,
                "total_items": total,
                "done_items": done,
                "running_items": counts["running"],
                "under_review_items": counts["under_review"],
                "pending_items": counts["pending"],
                "planned_items": counts["planned"],
                "progress": round((done / total) * 100, 2) if total else 0.0,
                "status": reduce_status(statuses, default="planned"),
            }
        )

    return items, stage_rows, version_rows


def apply_state(tasks: list[dict], args: argparse.Namespace) -> tuple[list[dict], dict, list[dict]]:
    existing_state = load_state()
    done_history, done_history_by_id = load_done_history()
    state_out = {}
    changes = []
    commit_full = args.source_commit.strip()
    commit_short = commit_full[:12] if commit_full else ""
    message = args.source_message.strip()
    provenance_loaded = False
    timestamp = now_iso()
    selectors = _status_map(args)
    active_locks = load_active_locks()

    def ensure_provenance() -> tuple[str, str]:
        nonlocal commit_full, commit_short, message, provenance_loaded
        if not provenance_loaded:
            if not commit_full:
                commit_full = run_git(["rev-parse", "HEAD"])
                commit_short = commit_full[:12]
            elif not commit_short:
                commit_short = commit_full[:12]
            if not message:
                message = run_git(["log", "-1", "--pretty=%s"])
            provenance_loaded = True
        return commit_short, message

    for task in tasks:
        key = task["task_key"]
        previous = _lookup_previous(existing_state, task)

        record = {
            "status": previous.get("status", "planned"),
            "commit": previous.get("commit", ""),
            "done_at": previous.get("done_at", ""),
            "changelog": previous.get("changelog", ""),
        }

        history_rec = done_history.get(key) or done_history_by_id.get(task["id"])
        if history_rec and normalize_status(record.get("status", "")) == "done":
            record["commit"] = history_rec.get("commit", "")
            record["done_at"] = history_rec.get("done_at", "")
            record["changelog"] = history_rec.get("changelog", "")

        target_status = None
        # Priority 1: Command line arguments
        for candidate_status in ("done", "running", "under_review", "pending", "planned"):
            for selector in selectors[candidate_status]:
                if _selector_matches(task, selector):
                    target_status = candidate_status
                    break
            if target_status:
                break

        # Priority 2: Active locks (implies running)
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
                commit_short_value, message_value = ensure_provenance()
                record["status"] = "done"
                record["commit"] = commit_short_value
                record["done_at"] = timestamp
                record["changelog"] = args.note.strip() or message_value
            else:
                record["status"] = target_status
                if target_status in ("planned", "pending", "running", "under_review"):
                    # Non-done states should never carry completion metadata.
                    record["commit"] = ""
                    record["done_at"] = ""
                    record["changelog"] = ""

        status = normalize_status(record.get("status", "planned"))
        if status not in {normalize_status(s) for s in VALID_STATES}:
            status = "planned"
            record["status"] = status

        if status in DONE_STATES and not record.get("commit"):
            commit_short_value, message_value = ensure_provenance()
            record["commit"] = commit_short_value
            record["done_at"] = record.get("done_at") or timestamp
            record["changelog"] = record.get("changelog") or (args.note.strip() or message_value)

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
            "roadmap_version": task["roadmap_version"],
            "roadmap_stage": task["roadmap_stage"],
            "status": task["status"],
            "commit": task["commit"],
            "done_at": task["done_at"],
            "changelog": task["changelog"],
        }

        before_status = normalize_status(previous.get("status", "planned"))
        if before_status not in {normalize_status(s) for s in VALID_STATES}:
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


def compute_metrics(tasks: list[dict], previous_metrics: dict, orchestrator_state: dict) -> dict:
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
    total_under_review = 0

    for sprint in sorted(sprints):
        sprint_tasks = sprints[sprint]
        total = len(sprint_tasks)
        done = sum(1 for t in sprint_tasks if normalize_status(t["status"]) == "done")
        running = sum(1 for t in sprint_tasks if normalize_status(t["status"]) == "running")
        under_review = sum(1 for t in sprint_tasks if normalize_status(t["status"]) == "under_review")
        pending = sum(1 for t in sprint_tasks if normalize_status(t["status"]) == "pending")
        planned = sum(1 for t in sprint_tasks if normalize_status(t["status"]) == "planned")
        commits = {t["commit"] for t in sprint_tasks if t.get("commit")}
        versions = sorted({t["roadmap_version"] for t in sprint_tasks if t.get("roadmap_version")})
        progress = round((done / total) * 100, 2) if total else 0.0
        sprint_rows.append(
            {
                "sprint": sprint,
                "roadmap_version": ",".join(versions),
                "total_tasks": total,
                "done_tasks": done,
                "running_tasks": running,
                "under_review_tasks": under_review,
                "pending_tasks": pending,
                "planned_tasks": planned,
                "progress": progress,
                "commits_total": len(commits),
            }
        )
        total_done += done
        total_running += running
        total_under_review += under_review
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
        done = all(normalize_status(t["status"]) == "done" for t in gate_tasks)
        running = any(normalize_status(t["status"]) == "running" for t in gate_tasks)
        under_review = any(normalize_status(t["status"]) == "under_review" for t in gate_tasks)
        pending = any(normalize_status(t["status"]) == "pending" for t in gate_tasks)
        if done:
            gate_status[gate] = "done"
        elif running:
            gate_status[gate] = "running"
        elif under_review:
            gate_status[gate] = "under_review"
        elif pending:
            gate_status[gate] = "pending"
        else:
            gate_status[gate] = "open"

    previous_start = int(previous_metrics.get("sprint_start", 0)) if isinstance(previous_metrics, dict) else 0
    if previous_start <= 0:
        previous_start = int(datetime.now(timezone.utc).timestamp())
    roadmap_catalog = load_roadmap_catalog()
    roadmap_items, roadmap_stages, roadmap_versions = build_roadmap_items(tasks, orchestrator_state, roadmap_catalog)
    current_state = str(orchestrator_state.get("current_state", "")).strip()
    roadmap_source = str(orchestrator_state.get("roadmap_source", "")).strip()
    orchestrator_sprint = parse_sprint_number(orchestrator_state.get("current_sprint")) or 0
    if orchestrator_sprint > 0:
        current_sprint = orchestrator_sprint
        current_progress = 0.0
        for row in sprint_rows:
            if row["sprint"] == current_sprint:
                current_progress = row["progress"]
                break
    active_version = "1" if current_sprint <= 6 else "2"

    return {
        "generated_at": now_iso(),
        "current_sprint": current_sprint,
        "active_roadmap_version": active_version,
        "current_state": current_state,
        "roadmap_source": roadmap_source,
        "sprint_progress": current_progress,
        "sprint_start": previous_start,
        "running_tasks": total_running,
        "under_review_tasks": total_under_review,
        "tasks_completed_total": total_done,
        "total_tasks": len(tasks),
        "total_sprints": len(sprint_rows),
        "gate_status": gate_status,
        "sprints": sprint_rows,
        "roadmap_versions": roadmap_versions,
        "roadmap_stages": roadmap_stages,
        "roadmap_items": roadmap_items,
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


def record_history(changes: list[dict], tasks: list[dict], source_commit: str = "", source_message: str = "") -> None:
    if not changes:
        return
    history = []
    if HISTORY_FILE.exists():
        try:
            history = yaml.safe_load(HISTORY_FILE.read_text()) or []
        except (OSError, UnicodeDecodeError, yaml.YAMLError) as exc:
            print(f"update_cacheflow_metrics: failed to load existing task history {HISTORY_FILE}: {exc}", file=sys.stderr)
            return
    if not isinstance(history, list):
        print(
            f"update_cacheflow_metrics: expected list in {HISTORY_FILE}, got {type(history).__name__}; skipping history write",
            file=sys.stderr,
        )
        return

    done_keys = [c["task_key"] for c in changes if c["to"] == "done"]
    done_key_set = set(done_keys)
    done_records = [task for task in tasks if task["task_key"] in done_key_set]
    commit_full = source_commit.strip()
    if not commit_full and done_records:
        commit_full = run_git(["rev-parse", "HEAD"])
    message = source_message.strip()
    if not message and done_records:
        message = run_git(["log", "-1", "--pretty=%s"])
    done_ids = sorted(
        {
            t["id"]
            for t in tasks
            if t["task_key"] in done_key_set
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
    orchestrator_state = load_orchestrator_state_file()
    metrics = compute_metrics(tasks, previous_metrics, orchestrator_state)

    write_yaml(SPRINT_TASKS_FILE, {"generated_at": metrics["generated_at"], "tasks": tasks})
    write_yaml(STATE_FILE, state_out)
    write_yaml(METRICS_FILE, metrics)
    record_history(changes, tasks, args.source_commit, args.source_message)

    print(f"wrote {len(tasks)} task entries to {SPRINT_TASKS_FILE}")
    print(f"wrote metrics to {METRICS_FILE}")
    if changes:
        print(f"recorded {len(changes)} task state changes to {HISTORY_FILE}")


if __name__ == "__main__":
    main()
