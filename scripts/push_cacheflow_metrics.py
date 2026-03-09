#!/usr/bin/env python3
import os
import time
from datetime import datetime
from pathlib import Path

import requests
import yaml

STATUS_CODE = {
    "planned": 0,
    "pending": 1,
    "running": 2,
    "under_review": 2,
    "done": 3,
    "complete": 3,
    "closed": 3,
    "pass": 3,
}

AUDIT_COMPLETENESS = {
    "incomplete": 0,
    "partial": 1,
    "complete": 2,
}


def format_datetime(timestamp_str):
    """Convert ISO datetime string to friendly format: Month DD, YY HH:MM AM/PM"""
    if not timestamp_str:
        return ""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt.strftime("%B %d, %y %I:%M %p")
    except:
        return timestamp_str


def load_metrics(path):
    return yaml.safe_load(Path(path).read_text()) or {}


def esc(value, max_len=160):
    text = "" if value is None else str(value)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.replace("\\", "\\\\").replace("\n", " ").replace('"', '\\"')
    return text[:max_len]


def build_payload(data):
    now = int(time.time())
    lines = []
    lines.append(f"cacheflow_current_sprint {int(data.get('current_sprint', 0))}")
    lines.append(f"cacheflow_sprint_progress {float(data.get('sprint_progress', 0))}")
    lines.append(f"cacheflow_sprint_age_seconds {max(0, now - int(data.get('sprint_start', now)))}")
    lines.append(f"cacheflow_tasks_running_total {int(data.get('running_tasks', 0))}")
    lines.append(f"cacheflow_tasks_under_review_total {int(data.get('under_review_tasks', 0))}")
    lines.append(f"cacheflow_tasks_completed_total {int(data.get('tasks_completed_total', 0))}")
    lines.append(f"cacheflow_total_tasks {int(data.get('total_tasks', 0))}")
    lines.append(f"cacheflow_total_sprints {int(data.get('total_sprints', 0))}")
    active_version = esc(data.get("active_roadmap_version"), 8)
    current_state = esc(data.get("current_state"), 48)
    roadmap_source = esc(data.get("roadmap_source"), 160)
    if active_version:
        lines.append(f'cacheflow_active_roadmap_version{{roadmap_version="{active_version}"}} 1')
    if current_state:
        lines.append(
            f'cacheflow_orchestrator_state{{state="{current_state}",roadmap_source="{roadmap_source}"}} 1'
        )

    for sprint in data.get("sprints", []):
        sprint_label = esc(sprint.get("sprint"))
        roadmap_version = esc(sprint.get("roadmap_version"), 16)
        sprint_labels = f'sprint="{sprint_label}"'
        if roadmap_version:
            sprint_labels += f',roadmap_version="{roadmap_version}"'
        lines.append(f'cacheflow_sprint_total_tasks{{{sprint_labels}}} {int(sprint.get("total_tasks", 0))}')
        lines.append(f'cacheflow_sprint_done_tasks{{{sprint_labels}}} {int(sprint.get("done_tasks", 0))}')
        lines.append(f'cacheflow_sprint_running_tasks{{{sprint_labels}}} {int(sprint.get("running_tasks", 0))}')
        lines.append(f'cacheflow_sprint_under_review_tasks{{{sprint_labels}}} {int(sprint.get("under_review_tasks", 0))}')
        lines.append(f'cacheflow_sprint_pending_tasks{{{sprint_labels}}} {int(sprint.get("pending_tasks", 0))}')
        lines.append(f'cacheflow_sprint_planned_tasks{{{sprint_labels}}} {int(sprint.get("planned_tasks", 0))}')
        lines.append(f'cacheflow_sprint_progress_percent{{{sprint_labels}}} {float(sprint.get("progress", 0.0))}')
        lines.append(f'cacheflow_sprint_commits_total{{{sprint_labels}}} {int(sprint.get("commits_total", 0))}')

    for version in data.get("roadmap_versions", []):
        version_label = esc(version.get("roadmap_version"), 8)
        title = esc(version.get("title"), 64)
        status = esc(version.get("status"), 16)
        labels = f'roadmap_version="{version_label}",title="{title}"'
        lines.append(f'cacheflow_roadmap_version_total_items{{{labels}}} {int(version.get("total_items", 0))}')
        lines.append(f'cacheflow_roadmap_version_done_items{{{labels}}} {int(version.get("done_items", 0))}')
        lines.append(f'cacheflow_roadmap_version_running_items{{{labels}}} {int(version.get("running_items", 0))}')
        lines.append(f'cacheflow_roadmap_version_under_review_items{{{labels}}} {int(version.get("under_review_items", 0))}')
        lines.append(f'cacheflow_roadmap_version_pending_items{{{labels}}} {int(version.get("pending_items", 0))}')
        lines.append(f'cacheflow_roadmap_version_planned_items{{{labels}}} {int(version.get("planned_items", 0))}')
        lines.append(f'cacheflow_roadmap_version_progress_percent{{{labels}}} {float(version.get("progress", 0.0))}')
        lines.append(f'cacheflow_roadmap_version_status{{{labels},status="{status}"}} 1')

    for stage in data.get("roadmap_stages", []):
        stage_key = esc(stage.get("stage"), 12)
        stage_title = esc(stage.get("title"), 96)
        version_label = esc(stage.get("roadmap_version"), 8)
        version_title = esc(stage.get("roadmap_version_title"), 64)
        status = esc(stage.get("status"), 16)
        labels = (
            f'stage="{stage_key}",'
            f'stage_title="{stage_title}",'
            f'roadmap_version="{version_label}",'
            f'roadmap_version_title="{version_title}"'
        )
        lines.append(f'cacheflow_roadmap_stage_total_items{{{labels}}} {int(stage.get("total_items", 0))}')
        lines.append(f'cacheflow_roadmap_stage_done_items{{{labels}}} {int(stage.get("done_items", 0))}')
        lines.append(f'cacheflow_roadmap_stage_running_items{{{labels}}} {int(stage.get("running_items", 0))}')
        lines.append(f'cacheflow_roadmap_stage_under_review_items{{{labels}}} {int(stage.get("under_review_items", 0))}')
        lines.append(f'cacheflow_roadmap_stage_pending_items{{{labels}}} {int(stage.get("pending_items", 0))}')
        lines.append(f'cacheflow_roadmap_stage_planned_items{{{labels}}} {int(stage.get("planned_items", 0))}')
        lines.append(f'cacheflow_roadmap_stage_progress_percent{{{labels}}} {float(stage.get("progress", 0.0))}')
        lines.append(f'cacheflow_roadmap_stage_status{{{labels},status="{status}"}} 1')

    for item in data.get("roadmap_items", []):
        status = str(item.get("status", "planned")).lower()
        code = STATUS_CODE.get(status, 0)
        labels = (
            f'item_id="{esc(item.get("item_id"), 16)}",'
            f'title="{esc(item.get("title"), 160)}",'
            f'sprint="{esc(item.get("sprint"), 12)}",'
            f'roadmap_version="{esc(item.get("roadmap_version"), 8)}",'
            f'roadmap_version_title="{esc(item.get("roadmap_version_title"), 32)}",'
            f'stage="{esc(item.get("stage"), 12)}",'
            f'stage_title="{esc(item.get("stage_title"), 64)}",'
            f'item_type="{esc(item.get("item_type"), 16)}",'
            f'status="{esc(status, 16)}"'
        )
        lines.append(f"cacheflow_roadmap_item_status{{{labels}}} {code}")
        lines.append(f"cacheflow_roadmap_item_progress_percent{{{labels}}} {float(item.get('progress', 0.0))}")
        lines.append(f"cacheflow_roadmap_item_done_criteria{{{labels}}} {int(item.get('done_criteria', 0))}")
        lines.append(f"cacheflow_roadmap_item_total_criteria{{{labels}}} {int(item.get('criteria_count', 0))}")

    for gate, status in (data.get("gate_status") or {}).items():
        status_norm = esc(str(status).lower(), 24)
        gate_label = esc(gate, 64)
        done_val = 1 if status_norm in ("done", "closed", "pass", "green") else 0
        lines.append(f'cacheflow_gate_is_done{{gate="{gate_label}"}} {done_val}')
        lines.append(f'cacheflow_gate_status{{gate="{gate_label}",status="{status_norm}"}} 1')

    for task in data.get("tasks", []):
        status = str(task.get("status", "planned")).lower()
        code = STATUS_CODE.get(status, 0)
        labels = (
            f'task_id="{esc(task.get("id"), 32)}",'
            f'task_key="{esc(task.get("task_key"), 96)}",'
            f'sprint="{esc(task.get("sprint"), 12)}",'
            f'gate="{esc(task.get("gate"), 48)}",'
            f'agent="{esc(task.get("agent"), 48)}",'
            f'roadmap_version="{esc(task.get("roadmap_version"), 8)}",'
            f'roadmap_stage="{esc(task.get("roadmap_stage"), 12)}",'
            f'roadmap_stage_title="{esc(task.get("roadmap_stage_title"), 64)}",'
            f'status="{esc(status, 16)}",'
            f'commit="{esc(task.get("commit"), 20)}",'
            f'done_at="{esc(task.get("done_at"), 40)}",'
            f'task_desc="{esc(task.get("description"), 160)}",'
            f'changelog="{esc(task.get("changelog"), 160)}"'
        )
        lines.append(f"cacheflow_task_status{{{labels}}} {code}")

    # Sprint 0-5 module audit rows (generated by scripts/generate_module_audit.py)
    audit_file = Path(os.environ.get("CACHEFLOW_BASE", Path(__file__).resolve().parent.parent)) / "monitoring" / "cacheflow_module_audit.yaml"
    if audit_file.exists():
        audit_data = yaml.safe_load(audit_file.read_text()) or {}
        summary = audit_data.get("summary", {}) or {}
        lines.append(
            f'cacheflow_module_audit_total{{scope="sprints_0_5"}} {int(summary.get("total_modules", 0))}'
        )
        lines.append(
            f'cacheflow_module_audit_complete_total{{scope="sprints_0_5"}} {int(summary.get("complete_modules", 0))}'
        )
        lines.append(
            f'cacheflow_module_audit_partial_total{{scope="sprints_0_5"}} {int(summary.get("partial_modules", 0))}'
        )
        lines.append(
            f'cacheflow_module_audit_incomplete_total{{scope="sprints_0_5"}} {int(summary.get("incomplete_modules", 0))}'
        )

        for module in audit_data.get("modules", []):
            if not isinstance(module, dict):
                continue
            completeness = str(module.get("completeness", "incomplete")).lower()
            comp_code = AUDIT_COMPLETENESS.get(completeness, 0)
            score = float(module.get("completeness_score", 0.0) or 0.0)
            labels = (
                f'seq="{esc(module.get("seq"), 8)}",'
                f'sprint="{esc(module.get("sprint"), 8)}",'
                f'module_id="{esc(module.get("module_id"), 32)}",'
                f'task_key="{esc(module.get("task_key"), 96)}",'
                f'wave="{esc(module.get("wave"), 8)}",'
                f'module_title="{esc(module.get("module_title"), 220)}",'
                f'status="{esc(module.get("status"), 16)}",'
                f'completeness="{esc(completeness, 16)}",'
                f'files_ok="{esc(module.get("files_ok"), 8)}",'
                f'contract_ok="{esc(module.get("contract_ok"), 8)}",'
                f'timestamp_done="{esc(module.get("timestamp_done"), 40)}",'
                f'timestamp_last_changed="{esc(module.get("timestamp_last_changed"), 40)}",'
                f'timestamp_committed="{esc(module.get("timestamp_committed"), 40)}",'
                f'commit_hash="{esc(module.get("commit_hash"), 40)}",'
                f'committed_by="{esc(module.get("committed_by"), 120)}",'
                f'worked_by="{esc(module.get("worked_by"), 80)}",'
                f'assigned_agent="{esc(module.get("assigned_agent"), 80)}",'
                f'local_paths="{esc(module.get("local_file_locations"), 512)}",'
                f'git_paths="{esc(module.get("git_file_locations"), 512)}",'
                f'git_urls="{esc(module.get("git_urls"), 512)}"'
            )
            lines.append(f"cacheflow_module_audit_status{{{labels}}} {comp_code}")
            lines.append(f"cacheflow_module_audit_score{{{labels}}} {score}")
    return "\n".join(lines) + "\n"


def push_metrics(text, gateway):
    url = f"{gateway}/metrics/job/cacheflow_sprint_tracker"
    resp = requests.put(url, data=text)
    resp.raise_for_status()
    print("pushed", len(text.splitlines()), "metrics")


def main():
    explicit = os.environ.get("CACHEFLOW_BASE")
    if explicit:
        base = Path(explicit).resolve()
    else:
        canonical = Path("/home/sanjay/cacheflow_work")
        if (canonical / ".git").exists():
            base = canonical.resolve()
        else:
            base = Path(__file__).resolve().parent.parent
    metrics_file = base / "monitoring" / "cacheflow_metrics.yaml"
    if not metrics_file.exists():
        raise SystemExit("metrics file missing")
    data = load_metrics(metrics_file)
    payload = build_payload(data)
    gateway = os.environ.get("PUSHGATEWAY", "http://localhost:9091")
    push_metrics(payload, gateway)


if __name__ == "__main__":
    main()
