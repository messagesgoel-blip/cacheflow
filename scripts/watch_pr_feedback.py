#!/usr/bin/env python3
"""Poll GitHub PR review state and notify the owning agent on new CodeRabbit feedback."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = ROOT / "logs"
NOTIFICATIONS_FILE = LOG_DIR / "notifications.txt"
WATCH_DIR = ROOT / ".context" / "cache_state" / "pr_feedback_watch"
AGENT_INBOX_DIR = ROOT / ".context" / "cache_state" / "agent_notifications"
MONITORING_DIR = ROOT / "monitoring"
TTY_MAP_DIR = Path(os.environ.get("CACHEFLOW_AGENT_TTY_MAP_DIR", "/tmp/cacheflow_agent_tty_map"))


@dataclass
class ReviewSnapshot:
    pr: int
    url: str
    branch: str
    review_decision: str
    updated_at: str
    latest_review_id: str | None
    latest_review_at: str | None
    latest_review_state: str | None
    latest_review_body: str


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True, check=check)


def append_line(path: Path, line: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
      handle.write(f"{line}\n")


def strip_markdown(text: str) -> str:
    stripped = re.sub(r"```[\s\S]*?```", " ", text)
    stripped = re.sub(r"`([^`]+)`", r"\1", stripped)
    stripped = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", stripped)
    stripped = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", stripped)
    stripped = re.sub(r"[*_~>#-]+", " ", stripped)
    stripped = re.sub(r"\s+", " ", stripped)
    return stripped.strip()


def first_paragraph(body: str) -> str:
    parts = [part.strip() for part in re.split(r"\n\s*\n", body or "") if part.strip()]
    return strip_markdown(parts[0]) if parts else ""


def extract_suggestions(body: str) -> list[str]:
    return [line.strip() for line in (body or "").splitlines() if line.strip().startswith("> [!")]


def detect_severity(body: str) -> str:
    raw = body or ""
    lowered = raw.lower()
    for level in ("critical", "high", "medium", "low"):
        if re.search(rf"\bseverity\s*:\s*{level}\b", lowered) or re.search(rf"\b{level}\b", lowered):
            return level
    return "none"


def has_issue_actions(body: str) -> bool:
    lines = (body or "").splitlines()
    in_issues = False
    for raw in lines:
        line = raw.strip()
        if re.match(r"^##\s+issues\b", line, re.IGNORECASE):
            in_issues = True
            continue
        if in_issues and re.match(r"^##\s+", line):
            break
        if in_issues and re.match(r"^(?:-|\*|\d+\.|>\s*\[!)", line):
            return True
    return False


def parse_review(body: str, review_state: str | None = None) -> dict[str, Any]:
    severity = detect_severity(body)
    actionable_comments = re.search(r"actionable comments posted:\s*([1-9]\d*)", body or "", re.IGNORECASE)
    has_blockers = (
        "🚨" in (body or "")
        or has_issue_actions(body)
        or actionable_comments is not None
        or (review_state or "").upper() == "CHANGES_REQUESTED"
        or severity in {"critical", "high"}
    )
    return {
        "hasBlockers": has_blockers,
        "severity": severity,
        "summary": first_paragraph(body),
        "suggestions": extract_suggestions(body),
        "raw": body or "",
    }


def write_review_state(pr: int, parsed: dict[str, Any]) -> Path:
    MONITORING_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MONITORING_DIR / f"coderabbit-{pr}.yaml"
    payload = {
        "pr": pr,
        "status": "completed",
        "hasBlockers": parsed["hasBlockers"],
        "severity": parsed["severity"],
        "summary": parsed["summary"],
        "suggestions": parsed["suggestions"],
        "receivedAt": now_iso(),
        "agentNotified": False,
    }
    out_path.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")
    return out_path


def current_branch() -> str:
    result = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    branch = result.stdout.strip()
    if not branch or branch == "HEAD":
        raise RuntimeError("unable to resolve current branch")
    return branch


def resolve_pr_number(explicit_pr: int | None) -> int:
    if explicit_pr:
        return explicit_pr

    direct = run(["gh", "pr", "view", "--json", "number", "--jq", ".number"], check=False)
    if direct.returncode == 0:
        value = direct.stdout.strip()
        if value.isdigit():
            return int(value)

    branch = current_branch()
    listing = run(
        ["gh", "pr", "list", "--head", branch, "--state", "open", "--json", "number", "--jq", ".[0].number"],
        check=False,
    )
    value = listing.stdout.strip()
    if listing.returncode == 0 and value.isdigit():
        return int(value)
    raise RuntimeError("unable to resolve open PR for current branch")


def fetch_snapshot(pr: int) -> ReviewSnapshot:
    fields = "number,url,headRefName,reviewDecision,updatedAt,reviews"
    result = run(["gh", "pr", "view", str(pr), "--json", fields])
    payload = json.loads(result.stdout)
    reviews = [
        review
        for review in payload.get("reviews", [])
        if str(review.get("author", {}).get("login", "")).startswith("coderabbitai")
    ]
    latest = max(reviews, key=lambda item: item.get("submittedAt") or "", default=None)
    return ReviewSnapshot(
        pr=int(payload["number"]),
        url=str(payload.get("url") or ""),
        branch=str(payload.get("headRefName") or ""),
        review_decision=str(payload.get("reviewDecision") or ""),
        updated_at=str(payload.get("updatedAt") or ""),
        latest_review_id=str(latest.get("id")) if latest else None,
        latest_review_at=str(latest.get("submittedAt")) if latest else None,
        latest_review_state=str(latest.get("state")) if latest else None,
        latest_review_body=str(latest.get("body") or "") if latest else "",
    )


def write_state(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def read_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def tty_paths_for_agent(agent: str) -> list[Path]:
    if not TTY_MAP_DIR.exists():
        return []

    paths: list[Path] = []
    normalized = agent.strip().lower()
    for entry in TTY_MAP_DIR.iterdir():
        if not entry.is_file():
            continue
        try:
            mapped = entry.read_text(encoding="utf-8").strip().lower()
        except OSError:
            continue
        if mapped != normalized:
            continue
        restored = entry.name.replace("_", "/")
        if not restored.startswith("/"):
            restored = f"/{restored}"
        tty_path = Path(restored)
        if tty_path.exists():
            paths.append(tty_path)
    return paths


def notify_agent(agent: str, message: str) -> None:
    ts_line = f"[{now_iso()}] {message}"
    append_line(NOTIFICATIONS_FILE, ts_line)
    append_line(AGENT_INBOX_DIR / f"{agent}.log", ts_line)
    for tty_path in tty_paths_for_agent(agent):
        try:
            with tty_path.open("w", encoding="utf-8") as handle:
                handle.write(f"\n{message}\n")
        except OSError:
            continue


def watcher_paths(pr: int) -> tuple[Path, Path, Path]:
    state_path = WATCH_DIR / f"pr-{pr}.json"
    log_path = LOG_DIR / f"pr-feedback-watch-{pr}.log"
    pid_path = WATCH_DIR / f"pr-{pr}.pid"
    return state_path, log_path, pid_path


def start_watch(args: argparse.Namespace) -> int:
    pr = resolve_pr_number(args.pr)
    state_path, log_path, pid_path = watcher_paths(pr)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    pid_path.parent.mkdir(parents=True, exist_ok=True)
    if pid_path.exists():
        try:
            existing_pid = int(pid_path.read_text(encoding="utf-8").strip())
            os.kill(existing_pid, 0)
            print(f"PR feedback watcher already running for PR #{pr}")
            print(state_path)
            return 0
        except (OSError, ValueError):
            pid_path.unlink(missing_ok=True)

    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "run",
        "--pr",
        str(pr),
        "--interval",
        str(args.interval),
        "--timeout",
        str(args.timeout),
        "--agent",
        args.agent,
    ]
    if args.task:
        command.extend(["--task", args.task])
    if args.notify_existing:
        command.append("--notify-existing")

    log_path.parent.mkdir(parents=True, exist_ok=True)
    snapshot = fetch_snapshot(pr)
    write_state(
        state_path,
        {
            "status": "running",
            "pr": pr,
            "branch": snapshot.branch,
            "agent": args.agent,
            "task": args.task or "",
            "intervalSeconds": args.interval,
            "timeoutSeconds": args.timeout,
            "pid": None,
            "startedAt": now_iso(),
            "lastCheckedAt": None,
            "latestReviewId": snapshot.latest_review_id,
            "notifiedAt": None,
            "logFile": str(log_path),
        },
    )
    with log_path.open("a", encoding="utf-8") as log_handle:
        process = subprocess.Popen(command, cwd=str(ROOT), stdout=log_handle, stderr=subprocess.STDOUT)
    pid_path.write_text(f"{process.pid}\n", encoding="utf-8")
    current = read_state(state_path)
    current["pid"] = process.pid
    write_state(state_path, current)
    print(f"Started PR feedback watcher for PR #{pr}")
    print(state_path)
    return 0


def run_watch(args: argparse.Namespace) -> int:
    pr = resolve_pr_number(args.pr)
    state_path, log_path, pid_path = watcher_paths(pr)
    snapshot = fetch_snapshot(pr)
    baseline_review_id = None if args.notify_existing else snapshot.latest_review_id
    started_at = now_iso()
    append_line(log_path, f"[{started_at}] watch start pr={pr} branch={snapshot.branch} agent={args.agent} task={args.task or '-'} baselineReviewId={baseline_review_id or '-'}")

    deadline = time.time() + max(args.timeout, args.interval)
    while time.time() <= deadline:
        snapshot = fetch_snapshot(pr)
        write_state(
            state_path,
            {
                "status": "running",
                "pr": pr,
                "branch": snapshot.branch,
                "agent": args.agent,
                "task": args.task or "",
                "intervalSeconds": args.interval,
                "timeoutSeconds": args.timeout,
                "pid": os.getpid(),
                "startedAt": started_at,
                "lastCheckedAt": now_iso(),
                "latestReviewId": snapshot.latest_review_id,
                "latestReviewAt": snapshot.latest_review_at,
                "reviewDecision": snapshot.review_decision,
                "updatedAt": snapshot.updated_at,
                "logFile": str(log_path),
                "notifiedAt": None,
            },
        )
        append_line(
            log_path,
            f"[{now_iso()}] heartbeat pr={pr} decision={snapshot.review_decision or '-'} updatedAt={snapshot.updated_at or '-'} latestReviewId={snapshot.latest_review_id or '-'}",
        )

        if snapshot.latest_review_id and snapshot.latest_review_id != baseline_review_id:
            parsed = parse_review(snapshot.latest_review_body, snapshot.latest_review_state)
            review_file = write_review_state(pr, parsed)
            summary = parsed["summary"] or snapshot.latest_review_state or "CodeRabbit feedback received"
            message = (
                f"CodeRabbit feedback for {args.agent} on PR #{pr}"
                f"{f' task={args.task}' if args.task else ''}: "
                f"decision={snapshot.review_decision or snapshot.latest_review_state or 'UNKNOWN'}; "
                f"summary={summary}; file={review_file}"
            )
            notify_agent(args.agent, message)
            append_line(log_path, f"[{now_iso()}] notified agent={args.agent} pr={pr} reviewId={snapshot.latest_review_id}")
            write_state(
                state_path,
                {
                    "status": "notified",
                    "pr": pr,
                    "branch": snapshot.branch,
                    "agent": args.agent,
                    "task": args.task or "",
                    "intervalSeconds": args.interval,
                    "timeoutSeconds": args.timeout,
                    "pid": os.getpid(),
                    "startedAt": started_at,
                    "lastCheckedAt": now_iso(),
                    "latestReviewId": snapshot.latest_review_id,
                    "latestReviewAt": snapshot.latest_review_at,
                    "reviewDecision": snapshot.review_decision,
                    "updatedAt": snapshot.updated_at,
                    "logFile": str(log_path),
                    "notifiedAt": now_iso(),
                    "monitoringFile": str(review_file),
                },
            )
            pid_path.unlink(missing_ok=True)
            return 0

        time.sleep(args.interval)

    append_line(log_path, f"[{now_iso()}] timeout pr={pr} agent={args.agent}")
    write_state(
        state_path,
        {
            "status": "timeout",
            "pr": pr,
            "branch": snapshot.branch,
            "agent": args.agent,
            "task": args.task or "",
            "intervalSeconds": args.interval,
            "timeoutSeconds": args.timeout,
            "pid": os.getpid(),
            "startedAt": started_at,
            "lastCheckedAt": now_iso(),
            "latestReviewId": snapshot.latest_review_id,
            "latestReviewAt": snapshot.latest_review_at,
            "reviewDecision": snapshot.review_decision,
            "updatedAt": snapshot.updated_at,
            "logFile": str(log_path),
            "notifiedAt": None,
        },
    )
    pid_path.unlink(missing_ok=True)
    return 124


def show_status(args: argparse.Namespace) -> int:
    pr = resolve_pr_number(args.pr)
    state_path, _, _ = watcher_paths(pr)
    state = read_state(state_path)
    if not state:
        print(f"No PR feedback watcher state for PR #{pr}", file=sys.stderr)
        return 1
    print(json.dumps(state, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_common(command: argparse.ArgumentParser) -> None:
        command.add_argument("--pr", type=int, default=None, help="Open PR number. Defaults to current branch PR.")

    start = subparsers.add_parser("start", help="Launch background watcher for the current branch PR")
    add_common(start)
    start.add_argument("--agent", required=True, help="Owning agent name to notify")
    start.add_argument("--task", default="", help="Optional task key")
    start.add_argument("--interval", type=int, default=300, help="Heartbeat interval in seconds")
    start.add_argument("--timeout", type=int, default=7200, help="Maximum watch time in seconds")
    start.add_argument("--notify-existing", action="store_true", help="Treat current latest CodeRabbit review as new feedback")
    start.set_defaults(func=start_watch)

    run_cmd = subparsers.add_parser("run", help="Internal watcher entrypoint")
    add_common(run_cmd)
    run_cmd.add_argument("--agent", required=True)
    run_cmd.add_argument("--task", default="")
    run_cmd.add_argument("--interval", type=int, default=300)
    run_cmd.add_argument("--timeout", type=int, default=7200)
    run_cmd.add_argument("--notify-existing", action="store_true")
    run_cmd.set_defaults(func=run_watch)

    status = subparsers.add_parser("status", help="Show watcher state for the current branch PR")
    add_common(status)
    status.set_defaults(func=show_status)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
