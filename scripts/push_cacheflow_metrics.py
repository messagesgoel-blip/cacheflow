#!/usr/bin/env python3
import os
import time
from pathlib import Path

import requests
import yaml

STATUS_CODE = {
    "planned": 0,
    "pending": 1,
    "running": 2,
    "done": 3,
    "complete": 3,
    "closed": 3,
    "pass": 3,
}


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
    lines.append(f"cacheflow_tasks_completed_total {int(data.get('tasks_completed_total', 0))}")
    lines.append(f"cacheflow_total_tasks {int(data.get('total_tasks', 0))}")
    lines.append(f"cacheflow_total_sprints {int(data.get('total_sprints', 0))}")

    for sprint in data.get("sprints", []):
        sprint_label = esc(sprint.get("sprint"))
        lines.append(f'cacheflow_sprint_total_tasks{{sprint="{sprint_label}"}} {int(sprint.get("total_tasks", 0))}')
        lines.append(f'cacheflow_sprint_done_tasks{{sprint="{sprint_label}"}} {int(sprint.get("done_tasks", 0))}')
        lines.append(f'cacheflow_sprint_running_tasks{{sprint="{sprint_label}"}} {int(sprint.get("running_tasks", 0))}')
        lines.append(f'cacheflow_sprint_pending_tasks{{sprint="{sprint_label}"}} {int(sprint.get("pending_tasks", 0))}')
        lines.append(f'cacheflow_sprint_planned_tasks{{sprint="{sprint_label}"}} {int(sprint.get("planned_tasks", 0))}')
        lines.append(f'cacheflow_sprint_progress_percent{{sprint="{sprint_label}"}} {float(sprint.get("progress", 0.0))}')
        lines.append(f'cacheflow_sprint_commits_total{{sprint="{sprint_label}"}} {int(sprint.get("commits_total", 0))}')

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
            f'status="{esc(status, 16)}",'
            f'commit="{esc(task.get("commit"), 20)}",'
            f'done_at="{esc(task.get("done_at"), 40)}",'
            f'task_desc="{esc(task.get("description"), 160)}",'
            f'changelog="{esc(task.get("changelog"), 160)}"'
        )
        lines.append(f"cacheflow_task_status{{{labels}}} {code}")
    return "\n".join(lines) + "\n"


def push_metrics(text, gateway):
    url = f"{gateway}/metrics/job/cacheflow_sprint_tracker"
    resp = requests.put(url, data=text)
    resp.raise_for_status()
    print("pushed", len(text.splitlines()), "metrics")


def main():
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
