#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import os
import re
import subprocess
import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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
ORCHESTRATOR_STATE_FILE = BASE / "logs" / "orchestrator-state.json"
TASK_STATE_FILE = BASE / "monitoring" / "cacheflow_task_state.yaml"
TASK_HISTORY_FILE = BASE / "monitoring" / "task_history.yaml"
AUDIT_YAML_FILE = BASE / "monitoring" / "cacheflow_module_audit.yaml"
AUDIT_CSV_FILE = BASE / "monitoring" / "cacheflow_module_audit.csv"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def run_git(args: list[str]) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=str(BASE),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return ""
    return proc.stdout.strip()


def normalize_path_fragment(raw: str) -> str:
    value = str(raw or "").strip()
    value = value.replace("\\", "/")
    value = value.replace("`", "")
    value = re.sub(r"\s+\(.*\)$", "", value).strip()
    value = re.sub(r"\s+--.*$", "", value).strip()
    value = value.lstrip("/")
    return value


def normalize_remote_to_http(remote_url: str) -> str:
    remote_url = (remote_url or "").strip()
    if remote_url.startswith("git@github.com:"):
        path = remote_url.replace("git@github.com:", "", 1)
        if path.endswith(".git"):
            path = path[:-4]
        return f"https://github.com/{path}"
    if remote_url.startswith("https://github.com/"):
        return remote_url[:-4] if remote_url.endswith(".git") else remote_url
    return ""


def natural_key(value: str) -> list[Any]:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", str(value))]


def parse_iso(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@dataclass
class DoneEvent:
    timestamp: str
    commit: str
    message: str


def load_manifest_tasks() -> list[dict[str, Any]]:
    data = json.loads(MANIFEST_FILE.read_text())
    tasks = [task for task in data.get("tasks", []) if int(task.get("sprint", -1)) <= 5]
    tasks.sort(key=lambda t: (int(t.get("sprint", 0)), natural_key(str(t.get("id", ""))), str(t.get("gate", ""))))
    return tasks


def load_orchestrator_state() -> dict[str, str]:
    if not ORCHESTRATOR_STATE_FILE.exists():
        return {}
    raw = json.loads(ORCHESTRATOR_STATE_FILE.read_text())
    out: dict[str, str] = {}
    tasks = raw.get("tasks", {})
    if isinstance(tasks, dict):
        for key, value in tasks.items():
            if isinstance(value, str):
                out[str(key)] = value.lower()
            elif isinstance(value, dict):
                out[str(key)] = str(value.get("status", "pending")).lower()
    return out


def load_task_state() -> dict[str, dict[str, Any]]:
    if not TASK_STATE_FILE.exists():
        return {}
    raw = yaml.safe_load(TASK_STATE_FILE.read_text()) or {}
    return raw if isinstance(raw, dict) else {}


def load_done_events() -> dict[str, DoneEvent]:
    if not TASK_HISTORY_FILE.exists():
        return {}
    rows = yaml.safe_load(TASK_HISTORY_FILE.read_text()) or []
    out: dict[str, DoneEvent] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        ts = str(row.get("timestamp", "")).strip()
        commit = str(row.get("commit", "")).strip()
        message = str(row.get("message", "")).strip()
        for change in row.get("changed", []) or []:
            if not isinstance(change, dict):
                continue
            if str(change.get("to", "")).strip().lower() != "done":
                continue
            task_key = str(change.get("task_key", "")).strip()
            if not task_key:
                continue
            current = out.get(task_key)
            if current is None:
                out[task_key] = DoneEvent(timestamp=ts, commit=commit, message=message)
                continue
            prev_dt = parse_iso(current.timestamp)
            next_dt = parse_iso(ts)
            if prev_dt is None or (next_dt is not None and next_dt >= prev_dt):
                out[task_key] = DoneEvent(timestamp=ts, commit=commit, message=message)
    return out


def should_prefer_web(agent: str, path_value: str) -> bool:
    if agent not in {"claudecode", "gemini"}:
        return False
    if path_value.startswith("web/"):
        return False
    return bool(re.match(r"^(app|components|styles|e2e|tests|playwright|public|context|hooks|lib)/", path_value))


def resolve_patterns(agent: str, raw_path: str) -> tuple[list[str], bool]:
    normalized = normalize_path_fragment(raw_path)
    if not normalized:
        return ([], False)

    if normalized.startswith("web/"):
        candidates = [normalized]
    elif should_prefer_web(agent, normalized):
        candidates = [f"web/{normalized}", normalized]
    else:
        candidates = [normalized, f"web/{normalized}"]

    is_glob = any(ch in normalized for ch in ["*", "?"])
    found: list[str] = []
    for candidate in candidates:
        abs_candidate = BASE / candidate
        if abs_candidate.exists():
            rel = str(abs_candidate.relative_to(BASE)).replace("\\", "/")
            if rel not in found:
                found.append(rel)
        if is_glob:
            # Next.js dynamic route segments use literal folder names like [id].
            # Escape brackets so glob treats them as literals while preserving * and ?.
            escaped_candidate = re.sub(r"\[([^\]/]+)\]", r"[[]\1[]]", candidate)
            for path_obj in BASE.glob(escaped_candidate):
                if path_obj.exists():
                    rel = str(path_obj.relative_to(BASE)).replace("\\", "/")
                    if rel not in found:
                        found.append(rel)

    if found:
        return (found, True)

    if should_prefer_web(agent, normalized):
        return ([f"web/{normalized}"], False)
    return ([normalized], False)


def load_commit_meta(commit: str, cache: dict[str, tuple[str, str, str]]) -> tuple[str, str, str]:
    if not commit:
        return ("", "", "")
    if commit in cache:
        return cache[commit]
    out = run_git(["show", "-s", "--format=%cI|%an|%s", commit])
    if not out:
        cache[commit] = ("", "", "")
        return cache[commit]
    parts = out.split("|", 2)
    if len(parts) != 3:
        cache[commit] = ("", "", "")
        return cache[commit]
    cache[commit] = (parts[0].strip(), parts[1].strip(), parts[2].strip())
    return cache[commit]


def load_path_last_change(path_value: str, cache: dict[str, tuple[str, str, str]]) -> tuple[str, str, str]:
    if path_value in cache:
        return cache[path_value]
    out = run_git(["log", "-1", "--format=%H|%cI|%an", "--", path_value])
    if not out:
        cache[path_value] = ("", "", "")
        return cache[path_value]
    parts = out.split("|")
    if len(parts) != 3:
        cache[path_value] = ("", "", "")
        return cache[path_value]
    cache[path_value] = (parts[0].strip(), parts[1].strip(), parts[2].strip())
    return cache[path_value]


def pick_latest_change(paths: list[str], path_cache: dict[str, tuple[str, str, str]]) -> tuple[str, str, str]:
    best_commit = ""
    best_ts = ""
    best_author = ""
    best_dt: datetime | None = None
    for path_value in paths:
        commit, ts, author = load_path_last_change(path_value, path_cache)
        if not ts:
            continue
        dt = parse_iso(ts)
        if dt is None:
            continue
        if best_dt is None or dt >= best_dt:
            best_dt = dt
            best_commit = commit
            best_ts = ts
            best_author = author
    return (best_commit, best_ts, best_author)


def render_locations(paths: list[str], github_repo: str) -> tuple[str, str, str]:
    unique_paths: list[str] = []
    for value in paths:
        if value not in unique_paths:
            unique_paths.append(value)
    local_paths = "; ".join(str((BASE / p).resolve()) for p in unique_paths)
    git_paths = "; ".join(unique_paths)
    git_urls = "; ".join(f"{github_repo}/blob/main/{p}" for p in unique_paths) if github_repo else ""
    return (local_paths, git_paths, git_urls)


def normalize_agent_name(value: str) -> str:
    raw = str(value or "").strip()
    lowered = raw.lower()
    mapping = {
        "opencode": "OpenCode",
        "claudecode": "ClaudeCode",
        "gemini": "Gemini",
        "codex": "Codex",
    }
    if lowered in mapping:
        return mapping[lowered]
    cleaned = re.sub(r"[^\w\s/-]", " ", raw).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def infer_worker(assigned_agent: str, history_message: str, commit_author: str) -> str:
    msg = history_message.lower()
    if "gemini" in msg:
        return "Gemini"
    if "claude" in msg:
        return "ClaudeCode"
    if "opencode" in msg:
        return "OpenCode"
    if "codex" in msg:
        return "Codex"
    if assigned_agent:
        return assigned_agent
    return commit_author


def build_rows() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    manifest_tasks = load_manifest_tasks()
    orchestrator_state = load_orchestrator_state()
    task_state = load_task_state()
    done_events = load_done_events()

    remote_url = run_git(["remote", "get-url", "origin"])
    github_repo = normalize_remote_to_http(remote_url)

    commit_cache: dict[str, tuple[str, str, str]] = {}
    path_cache: dict[str, tuple[str, str, str]] = {}

    rows: list[dict[str, Any]] = []
    summary = {
        "total_modules": 0,
        "complete_modules": 0,
        "partial_modules": 0,
        "incomplete_modules": 0,
    }

    for idx, task in enumerate(manifest_tasks, start=1):
        task_id = str(task.get("id", "")).strip()
        sprint = int(task.get("sprint", 0))
        gate = str(task.get("acceptance_criteria", [""])[0] if task.get("acceptance_criteria") else "").strip()
        task_key = f"{task_id}@{gate}"

        state_row = task_state.get(task_key) if isinstance(task_state.get(task_key), dict) else {}
        status = orchestrator_state.get(task_id, str(state_row.get("status", "pending")).lower())

        declared_files = task.get("files", []) or []
        file_checks: list[dict[str, Any]] = []
        resolved_paths: list[str] = []
        for declared in declared_files:
            paths, exists = resolve_patterns(str(task.get("agent", "")), str(declared))
            file_checks.append(
                {
                    "declared": str(declared),
                    "normalized": normalize_path_fragment(str(declared)),
                    "exists": exists,
                    "resolved": paths,
                }
            )
            if exists:
                for path_value in paths:
                    if path_value not in resolved_paths:
                        resolved_paths.append(path_value)

        files_ok = all(item["exists"] for item in file_checks) if file_checks else True
        files_score = (
            round(sum(1 for item in file_checks if item["exists"]) / len(file_checks) * 100, 2)
            if file_checks
            else 100.0
        )

        contract_path = normalize_path_fragment(str(task.get("contract_path", "")))
        produces_contract = bool(task.get("produces_contract", False))
        contract_exists = (BASE / contract_path).exists() if contract_path else False
        contract_ok = (not produces_contract) or contract_exists

        done_event = done_events.get(task_key)
        done_at = done_event.timestamp if done_event else str(state_row.get("done_at", "")).strip()
        done_commit = done_event.commit if done_event else str(state_row.get("commit", "")).strip()
        done_message = done_event.message if done_event else str(state_row.get("changelog", "")).strip()

        committed_at, committed_by, commit_message = load_commit_meta(done_commit, commit_cache)
        if not done_commit:
            done_commit = str(state_row.get("commit", "")).strip()
            committed_at, committed_by, commit_message = load_commit_meta(done_commit, commit_cache)

        last_change_commit, last_change_at, last_change_by = pick_latest_change(resolved_paths, path_cache)
        if not committed_by and last_change_by:
            committed_by = last_change_by
        if not committed_at and last_change_at:
            committed_at = last_change_at
        if not done_commit and last_change_commit:
            done_commit = last_change_commit

        local_paths, git_paths, git_urls = render_locations(resolved_paths, github_repo)

        assigned_agent = normalize_agent_name(str(task.get("agent", "")))
        worked_by = infer_worker(assigned_agent, done_message, committed_by)

        status_ok = status == "done"
        done_logged = bool(done_at)
        checks = {
            "status_ok": status_ok,
            "files_ok": files_ok,
            "contract_ok": contract_ok,
            "done_logged": done_logged,
            "committed": bool(done_commit),
        }
        check_pass_count = sum(1 for value in checks.values() if value)
        completeness_score = round((check_pass_count / len(checks)) * 100, 2)
        if completeness_score == 100:
            completeness = "complete"
        elif completeness_score >= 60:
            completeness = "partial"
        else:
            completeness = "incomplete"

        row = {
            "seq": idx,
            "module_id": task_id,
            "task_key": task_key,
            "sprint": sprint,
            "wave": int(task.get("wave", 0)),
            "module_title": str(task.get("title", "")),
            "status": status,
            "completeness": completeness,
            "completeness_score": completeness_score,
            "files_ok": files_ok,
            "files_score": files_score,
            "contract_required": produces_contract,
            "contract_path": str((BASE / contract_path).resolve()) if contract_path else "",
            "contract_exists": contract_exists,
            "contract_ok": contract_ok,
            "done_logged": done_logged,
            "timestamp_done": done_at,
            "timestamp_last_changed": last_change_at,
            "timestamp_committed": committed_at,
            "commit_hash": done_commit,
            "commit_message": commit_message or done_message,
            "committed_by": committed_by,
            "worked_by": worked_by,
            "assigned_agent": assigned_agent,
            "local_file_locations": local_paths,
            "git_file_locations": git_paths,
            "git_urls": git_urls,
            "file_checks": file_checks,
            "acceptance_criteria": task.get("acceptance_criteria", []) or [],
        }
        rows.append(row)
        summary["total_modules"] += 1
        if completeness == "complete":
            summary["complete_modules"] += 1
        elif completeness == "partial":
            summary["partial_modules"] += 1
        else:
            summary["incomplete_modules"] += 1

    return rows, summary


def write_yaml(rows: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    payload = {
        "generated_at": now_iso(),
        "scope": "sprints_0_to_5",
        "summary": summary,
        "modules": rows,
    }
    AUDIT_YAML_FILE.write_text(yaml.safe_dump(payload, sort_keys=False, allow_unicode=True))


def write_csv(rows: list[dict[str, Any]]) -> None:
    AUDIT_CSV_FILE.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "seq",
        "sprint",
        "module_id",
        "task_key",
        "module_title",
        "status",
        "completeness",
        "completeness_score",
        "files_ok",
        "contract_required",
        "contract_exists",
        "timestamp_done",
        "timestamp_last_changed",
        "timestamp_committed",
        "commit_hash",
        "committed_by",
        "worked_by",
        "assigned_agent",
        "local_file_locations",
        "git_file_locations",
        "git_urls",
    ]
    with AUDIT_CSV_FILE.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in columns})


def run_suite_checks(rows: list[dict[str, Any]]) -> tuple[bool, dict[str, int]]:
    failed_status = sum(1 for row in rows if row.get("status") != "done")
    failed_files = sum(1 for row in rows if not row.get("files_ok"))
    failed_contracts = sum(
        1 for row in rows if row.get("contract_required") and not row.get("contract_exists")
    )
    failed_done_log = sum(1 for row in rows if not row.get("done_logged"))
    ok = failed_status == 0 and failed_files == 0 and failed_contracts == 0 and failed_done_log == 0
    return ok, {
        "failed_status": failed_status,
        "failed_files": failed_files,
        "failed_contracts": failed_contracts,
        "failed_done_log": failed_done_log,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate sprint 0-5 module audit dataset")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero if any suite check fails",
    )
    args = parser.parse_args()

    rows, summary = build_rows()
    write_yaml(rows, summary)
    write_csv(rows)
    ok, checks = run_suite_checks(rows)
    print(
        f"module audit generated: total={summary['total_modules']} complete={summary['complete_modules']} "
        f"partial={summary['partial_modules']} incomplete={summary['incomplete_modules']}"
    )
    print(
        "suite checks: "
        f"failed_status={checks['failed_status']} "
        f"failed_files={checks['failed_files']} "
        f"failed_contracts={checks['failed_contracts']} "
        f"failed_done_log={checks['failed_done_log']}"
    )
    if args.strict and not ok:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
