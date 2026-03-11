from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def resolve_base() -> Path:
    explicit = os.environ.get("CACHEFLOW_BASE")
    if explicit:
        return Path(explicit).resolve()

    script_dir = Path(__file__).resolve().parent
    return script_dir.parent


def run_git(args: list[str], cwd: Path | None = None) -> str:
    """Run a trusted git command and return stripped stdout.

    Args:
        args: Hardcoded git subcommands/flags only. Do not pass untrusted or
            user-controlled input here; callers are responsible for ensuring any
            assembled args remain trusted literals.
        cwd: Working directory; defaults to resolve_base().
    """
    working_dir = cwd or resolve_base()
    return (
        subprocess.run(
            ["git", *args],
            cwd=str(working_dir),
            capture_output=True,
            text=True,
            check=True,
        )
        .stdout.strip()
    )


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
