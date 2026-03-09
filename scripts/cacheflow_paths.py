from __future__ import annotations

import os
import subprocess
from pathlib import Path


def resolve_base() -> Path:
    explicit = os.environ.get("CACHEFLOW_BASE")
    if explicit:
        return Path(explicit).resolve()

    script_dir = Path(__file__).resolve().parent
    return script_dir.parent


def run_git(args: list[str], cwd: Path | None = None) -> str:
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
