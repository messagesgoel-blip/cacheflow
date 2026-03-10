#!/usr/bin/env python3
"""Track GitHub PR feedback for the current branch and notify the owning agent on new CodeRabbit reviews."""

from __future__ import annotations

import argparse
import json
import os
import re
import stat
import subprocess
import sys
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
    match = re.search(r"\bseverity\s*[:=-]\s*(critical|high|medium|low)\b", body or "", re.IGNORECASE)
    return match.group(1).lower() if match else "none"


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


def safe_dump(data: dict[str, Any]) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=False)


def write_review_state(pr: int, parsed: dict[str, Any], comments: list[dict[str, str]], *, agent_notified: bool) -> Path:
    MONITORING_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MONITORING_DIR / f"coderabbit-{pr}.yaml"
    payload = {
        "pr": pr,
        "status": "completed",
        "hasBlockers": parsed["hasBlockers"],
        "severity": parsed["severity"],
        "summary": parsed["summary"],
        "suggestions": parsed["suggestions"],
        "comments": comments,
        "receivedAt": now_iso(),
        "agentNotified": agent_notified,
    }
    out_path.write_text(safe_dump(payload), encoding="utf-8")
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
    if direct.returncode == 0 and direct.stdout.strip().isdigit():
        return int(direct.stdout.strip())

    branch = current_branch()
    listing = run(
        ["gh", "pr", "list", "--head", branch, "--state", "open", "--json", "number", "--jq", ".[0].number"],
        check=False,
    )
    if listing.returncode == 0 and listing.stdout.strip().isdigit():
        return int(listing.stdout.strip())
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


def fetch_coderabbit_comments(pr: int, limit: int = 12) -> list[dict[str, str]]:
    query = (
        "query($owner:String!,$repo:String!,$pr:Int!){"
        "repository(owner:$owner,name:$repo){"
        "pullRequest(number:$pr){"
        "reviewThreads(first:50){nodes{isResolved comments(first:10){nodes{author{login} body path outdated createdAt}}}}"
        "}}}"
    )
    remote = run(["git", "remote", "get-url", "origin"])
    url = remote.stdout.strip()
    match = re.search(r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?$", url)
    if not match:
        return []
    owner = match.group("owner")
    repo = match.group("repo")
    result = run(
        ["gh", "api", "graphql", "-f", f"query={query}", "-F", f"owner={owner}", "-F", f"repo={repo}", "-F", f"pr={pr}"],
        check=False,
    )
    if result.returncode != 0:
        return []
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []

    comments: list[dict[str, str]] = []
    threads = payload.get("data", {}).get("repository", {}).get("pullRequest", {}).get("reviewThreads", {}).get("nodes", [])
    for thread in threads:
        if thread.get("isResolved") is True:
            continue
        for comment in thread.get("comments", {}).get("nodes", []):
            if str(comment.get("author", {}).get("login", "")).startswith("coderabbitai"):
                comments.append(
                    {
                        "path": str(comment.get("path") or ""),
                        "createdAt": str(comment.get("createdAt") or ""),
                        "body": strip_markdown(str(comment.get("body") or "")),
                        "outdated": "true" if comment.get("outdated") else "false",
                    }
                )
    comments.sort(key=lambda item: item["createdAt"], reverse=True)
    return comments[:limit]


def read_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def write_state(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


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
        match = re.fullmatch(r"_dev_pts_(\d+)", entry.name)
        if not match:
            continue
        tty_path = Path("/dev/pts") / match.group(1)
        try:
            st = tty_path.stat()
        except OSError:
            continue
        if tty_path.is_symlink() or not stat.S_ISCHR(st.st_mode):
            continue
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


def watcher_state_path(pr: int) -> Path:
    return WATCH_DIR / f"pr-{pr}.json"


def summarize_comments(comments: list[dict[str, str]], limit: int = 3) -> str:
    if not comments:
        return "no unresolved inline comments captured"
    lines = []
    for comment in comments[:limit]:
        path = comment.get("path") or "outside-diff"
        body = comment.get("body") or ""
        lines.append(f"{path}: {body[:180]}")
    return " | ".join(lines)


def init_watch(args: argparse.Namespace) -> int:
    pr = resolve_pr_number(args.pr)
    snapshot = fetch_snapshot(pr)
    state = {
        "status": "initialized",
        "pr": pr,
        "branch": snapshot.branch,
        "agent": args.agent,
        "task": args.task or "",
        "intervalSeconds": args.interval,
        "latestReviewId": snapshot.latest_review_id,
        "latestReviewAt": snapshot.latest_review_at,
        "reviewDecision": snapshot.review_decision,
        "updatedAt": snapshot.updated_at,
        "startedAt": now_iso(),
        "lastCheckedAt": None,
        "notifiedAt": None,
        "url": snapshot.url,
    }
    state_path = watcher_state_path(pr)
    write_state(state_path, state)
    print(f"Initialized PR feedback tracking for PR #{pr}")
    print(state_path)
    return 0


def check_watch(args: argparse.Namespace) -> int:
    pr = resolve_pr_number(args.pr)
    state_path = watcher_state_path(pr)
    state = read_state(state_path)
    snapshot = fetch_snapshot(pr)

    agent = args.agent or str(state.get("agent") or "").strip()
    task = args.task or str(state.get("task") or "").strip()
    if not agent:
        raise RuntimeError("missing agent; run start first or pass --agent")

    baseline_review_id = str(state.get("latestReviewId") or "")
    current_review_id = snapshot.latest_review_id or ""
    next_state = {
        "status": "idle",
        "pr": pr,
        "branch": snapshot.branch,
        "agent": agent,
        "task": task,
        "intervalSeconds": args.interval if args.interval else int(state.get("intervalSeconds") or 600),
        "latestReviewId": current_review_id,
        "latestReviewAt": snapshot.latest_review_at,
        "reviewDecision": snapshot.review_decision,
        "updatedAt": snapshot.updated_at,
        "startedAt": state.get("startedAt") or now_iso(),
        "lastCheckedAt": now_iso(),
        "notifiedAt": state.get("notifiedAt"),
        "url": snapshot.url,
    }

    append_line(
        LOG_DIR / f"pr-feedback-watch-{pr}.log",
        f"[{now_iso()}] check pr={pr} baseline={baseline_review_id or '-'} latest={current_review_id or '-'} decision={snapshot.review_decision or '-'}",
    )

    if current_review_id and current_review_id != baseline_review_id:
        comments = fetch_coderabbit_comments(pr)
        parsed = parse_review(snapshot.latest_review_body, snapshot.latest_review_state)
        review_file = write_review_state(pr, parsed, comments, agent_notified=True)
        summary = parsed["summary"] or snapshot.latest_review_state or "CodeRabbit feedback received"
        detail = summarize_comments(comments)
        message = (
            f"CodeRabbit feedback for {agent} on PR #{pr}"
            f"{f' task={task}' if task else ''}: "
            f"decision={snapshot.review_decision or snapshot.latest_review_state or 'UNKNOWN'}; "
            f"summary={summary}; comments={detail}; file={review_file}"
        )
        notify_agent(agent, message)
        next_state["status"] = "notified"
        next_state["notifiedAt"] = now_iso()
        next_state["monitoringFile"] = str(review_file)
        write_state(state_path, next_state)
        print(message)
        return 0

    write_state(state_path, next_state)
    print(f"No new CodeRabbit feedback for PR #{pr}")
    return 0


def show_status(args: argparse.Namespace) -> int:
    pr = resolve_pr_number(args.pr)
    state_path = watcher_state_path(pr)
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

    start = subparsers.add_parser("start", help="Record the current latest review as baseline after PR creation/push")
    add_common(start)
    start.add_argument("--agent", required=True, help="Owning agent name to notify")
    start.add_argument("--task", default="", help="Optional task key")
    start.add_argument("--interval", type=int, default=600, help="Suggested heartbeat interval in seconds")
    start.set_defaults(func=init_watch)

    check = subparsers.add_parser("check", help="Check for a newer CodeRabbit review and notify the owning agent")
    add_common(check)
    check.add_argument("--agent", default="", help="Owning agent name override")
    check.add_argument("--task", default="", help="Optional task key override")
    check.add_argument("--interval", type=int, default=0, help="Suggested heartbeat interval override")
    check.set_defaults(func=check_watch)

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
