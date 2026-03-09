from __future__ import annotations

import os
from pathlib import Path


def resolve_base() -> Path:
    explicit = os.environ.get("CACHEFLOW_BASE")
    if explicit:
        return Path(explicit).resolve()

    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    if (repo_root / ".git").exists():
        return repo_root

    return repo_root
