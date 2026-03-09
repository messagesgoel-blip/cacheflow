#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path

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
ROADMAP_FILE = BASE / "docs" / "roadmap.md"
OUT_FILE = BASE / "monitoring" / "cacheflow_roadmap_items.yaml"
ROADMAP_VERSION_TITLES = {
    "1": "Version 1",
    "2": "Version 2",
}
ROADMAP_STAGE_DEFS = {
    "V1-0": {"title": "Release Blocker", "roadmap_version": "1"},
    "V1-1": {"title": "Core Platform", "roadmap_version": "1"},
    "V1-2": {"title": "Power User Essentials", "roadmap_version": "1"},
    "V1-3": {"title": "Power User Completion", "roadmap_version": "1"},
    "V2-A": {"title": "Foundation", "roadmap_version": "2"},
    "V2-B": {"title": "Easy Wins", "roadmap_version": "2"},
    "V2-C": {"title": "Moderate", "roadmap_version": "2"},
    "V2-D": {"title": "Advanced", "roadmap_version": "2"},
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def stage_item(stage_key: str) -> dict:
    stage = ROADMAP_STAGE_DEFS[stage_key]
    return {
        "item_id": stage_key,
        "title": stage["title"],
        "sprint": "gate" if stage_key == "V1-0" else "0-5",
        "roadmap_version": stage["roadmap_version"],
        "roadmap_version_title": ROADMAP_VERSION_TITLES[stage["roadmap_version"]],
        "stage": stage_key,
        "stage_title": stage["title"],
        "item_type": "gate" if stage_key == "V1-0" else "stage",
    }


def parse_roadmap_items() -> list[dict]:
    lines = ROADMAP_FILE.read_text().splitlines()
    items = [stage_item("V1-0"), stage_item("V1-1")]
    current_stage = ""

    for raw_line in lines:
        line = raw_line.rstrip()

        stage_match = re.match(r"^###\s+(V[0-9A-Z-]+)\s+.+$", line)
        if stage_match:
            current_stage = stage_match.group(1)
            continue

        if current_stage in {"V1-2", "V1-3"}:
            exec_match = re.match(r"^####\s+([A-Z0-9.-]+)\s+(.+)$", line)
            if exec_match:
                item_id = exec_match.group(1).strip()
                title = exec_match.group(2).strip()
                stage = ROADMAP_STAGE_DEFS[current_stage]
                items.append(
                    {
                        "item_id": item_id,
                        "title": title,
                        "sprint": item_id.split(".", 1)[0],
                        "roadmap_version": stage["roadmap_version"],
                        "roadmap_version_title": ROADMAP_VERSION_TITLES[stage["roadmap_version"]],
                        "stage": current_stage,
                        "stage_title": stage["title"],
                        "item_type": "execution",
                    }
                )
            continue

        if current_stage in {"V2-A", "V2-B", "V2-C", "V2-D"}:
            sprint_match = re.match(r"^-\s+Sprint\s+(\d+):\s+(.+)$", line)
            if sprint_match:
                sprint = sprint_match.group(1).strip()
                title = sprint_match.group(2).strip()
                stage = ROADMAP_STAGE_DEFS[current_stage]
                items.append(
                    {
                        "item_id": sprint,
                        "title": title,
                        "sprint": sprint,
                        "roadmap_version": stage["roadmap_version"],
                        "roadmap_version_title": ROADMAP_VERSION_TITLES[stage["roadmap_version"]],
                        "stage": current_stage,
                        "stage_title": stage["title"],
                        "item_type": "backlog",
                    }
                )

    deduped = []
    seen = set()
    for item in items:
        item_id = item["item_id"]
        if item_id in seen:
            continue
        seen.add(item_id)
        deduped.append(item)
    return deduped


def main() -> None:
    payload = {
        "generated_at": now_iso(),
        "source_document": str(ROADMAP_FILE.relative_to(BASE)),
        "items": parse_roadmap_items(),
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(yaml.safe_dump(payload, sort_keys=False))
    print(f"wrote {len(payload['items'])} roadmap items to {OUT_FILE}")


if __name__ == "__main__":
    main()
