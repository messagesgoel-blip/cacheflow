#!/usr/bin/env python3
import os
from pathlib import Path

import requests
import yaml

explicit_base = os.environ.get("CACHEFLOW_BASE")
if explicit_base:
    CACHEFLOW_BASE = Path(explicit_base).resolve()
else:
    canonical = Path("/home/sanjay/cacheflow_work")
    if (canonical / ".git").exists():
        CACHEFLOW_BASE = canonical.resolve()
    else:
        CACHEFLOW_BASE = Path(__file__).resolve().parent.parent
HISTORY_FILE = CACHEFLOW_BASE / 'monitoring' / 'task_history.yaml'
METRICS_FILE = CACHEFLOW_BASE / 'monitoring' / 'cacheflow_metrics.yaml'
PUSHGATEWAY = os.environ.get('PUSHGATEWAY','http://localhost:9091')
JOB='cacheflow_task_history'


def esc(value, max_len=200):
    text = "" if value is None else str(value)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.replace("\\", "\\\\").replace("\n", " ").replace('"', '\\"')
    return text[:max_len]


def main():
    if not HISTORY_FILE.exists():
        raise SystemExit('history missing')
    data = yaml.safe_load(HISTORY_FILE.read_text()) or []
    metrics = yaml.safe_load(METRICS_FILE.read_text()) if METRICS_FILE.exists() else {}
    current_sprint = esc((metrics or {}).get('current_sprint'), 12)
    roadmap_version = esc((metrics or {}).get('active_roadmap_version'), 8)
    current_state = esc((metrics or {}).get('current_state'), 32)
    lines = []
    for idx, entry in enumerate(data[-100:], start=1):
        commit = entry.get('commit')
        if not commit:
            continue
        tasks = ",".join(entry.get('done_tasks', []))
        task_keys = ",".join(entry.get('done_task_keys', []))
        changed_count = len(entry.get('changed', []))
        ts = entry.get('timestamp', '')
        msg = esc(entry.get('message', ''), 160)
        shared = (
            f'idx="{idx}",commit="{esc(commit,64)}",tasks="{esc(tasks,200)}",'
            f'task_keys="{esc(task_keys,200)}",ts="{esc(ts,48)}",message="{msg}",'
            f'current_sprint="{current_sprint}",roadmap_version="{roadmap_version}",current_state="{current_state}"'
        )
        lines.append(
            f'cacheflow_history_entry{{{shared}}} 1'
        )
        lines.append(
            f'cacheflow_history_changed_total{{idx="{idx}",commit="{esc(commit,64)}",ts="{esc(ts,48)}",current_sprint="{current_sprint}",roadmap_version="{roadmap_version}",current_state="{current_state}"}} {changed_count}'
        )
    payload = '\n'.join(lines) + '\n'
    resp = requests.put(f"{PUSHGATEWAY}/metrics/job/{JOB}", data=payload)
    resp.raise_for_status()
    print('history metrics pushed', len(lines))

if __name__ == '__main__':
    main()

