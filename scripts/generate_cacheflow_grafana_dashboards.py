#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


BASE = Path("/home/sanjay/cacheflow_work")
MONITORING = BASE / "monitoring"


def text_panel(panel_id: int, title: str, x: int, y: int, w: int, h: int, content: str) -> dict:
    return {
        "id": panel_id,
        "type": "text",
        "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "options": {"mode": "markdown", "content": content},
    }


def stat_panel(panel_id: int, title: str, x: int, y: int, w: int, h: int, expr: str) -> dict:
    return {
        "id": panel_id,
        "type": "stat",
        "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "targets": [{"expr": expr, "refId": "A"}],
        "options": {"reduceOptions": {"calcs": ["lastNotNull"]}},
    }





def gauge_panel(panel_id: int, title: str, x: int, y: int, w: int, h: int, expr: str) -> dict:
    panel = stat_panel(panel_id, title, x, y, w, h, expr)
    panel["type"] = "gauge"
    panel["fieldConfig"] = {"defaults": {"min": 0, "max": 100}}
    return panel


def table_panel(panel_id: int, title: str, x: int, y: int, w: int, h: int, expr: str) -> dict:
    return {
        "id": panel_id,
        "type": "table",
        "title": title,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "targets": [{"expr": expr, "refId": "A", "format": "table", "instant": True}],
        "options": {"showHeader": True},
        "fieldConfig": {
            "defaults": {},
            "overrides": [
                {
                    "matcher": {"id": "byName", "options": "Time"},
                    "properties": [
                        {"id": "unit", "value": "dateTimeAsUS"},
                        {"id": "custom.align", "value": "auto"}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "Timestamp"},
                    "properties": [
                        {"id": "unit", "value": "dateTimeAsUS"},
                        {"id": "custom.align", "value": "auto"}
                    ]
                }
            ]
        }
    }


def write_dashboard(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


def build_sprints_dashboard() -> dict:
    panels = [
        text_panel(
            1,
            "Canonical Roadmap",
            0,
            0,
            24,
            4,
            "\n".join(
                [
                    "# CacheFlow Canonical Roadmap",
                    "- Primary product sequence: Version 1, then Version 2",
                    "- Current execution: Sprint 6 / Version 1",
                    "- Legacy Sprint 0-5 details are no longer the primary dashboard surface",
                    "- Source of truth: `docs/roadmap.md` and `logs/orchestrator-state.json`",
                ]
            ),
        ),
        stat_panel(2, "Active Sprint", 0, 4, 4, 4, "cacheflow_current_sprint"),
        gauge_panel(3, "Version 1 Progress %", 4, 4, 5, 4, 'cacheflow_roadmap_version_progress_percent{roadmap_version="1"}'),
        gauge_panel(4, "Version 2 Progress %", 9, 4, 5, 4, 'cacheflow_roadmap_version_progress_percent{roadmap_version="2"}'),
        stat_panel(5, "Sprint 6 Active Items", 14, 4, 5, 4, 'count(cacheflow_roadmap_item_status{sprint="6",status=~"pending|running"})'),
        stat_panel(6, "Version 2 Planned Sprints", 19, 4, 5, 4, 'count(cacheflow_roadmap_item_status{roadmap_version="2",status=~"planned|pending|running"})'),
        gauge_panel(10, "V1-0 Release Blocker", 0, 8, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V1-0"}'),
        gauge_panel(11, "V1-1 Core Platform", 6, 8, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V1-1"}'),
        gauge_panel(12, "V1-2 Essentials", 12, 8, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V1-2"}'),
        gauge_panel(13, "V1-3 Completion", 18, 8, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V1-3"}'),
        gauge_panel(14, "V2-A Foundation", 0, 12, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V2-A"}'),
        gauge_panel(15, "V2-B Easy Wins", 6, 12, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V2-B"}'),
        gauge_panel(16, "V2-C Moderate", 12, 12, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V2-C"}'),
        gauge_panel(17, "V2-D Advanced", 18, 12, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V2-D"}'),
        table_panel(20, "Sprint 6 Roadmap Items", 0, 16, 24, 10, 'cacheflow_roadmap_item_status{sprint="6"}'),
        table_panel(21, "Version 2 Planned Sprints", 0, 26, 24, 12, 'cacheflow_roadmap_item_status{roadmap_version="2"}'),
        table_panel(22, "Roadmap Stage Status", 0, 38, 24, 10, "cacheflow_roadmap_stage_status"),
        table_panel(23, "Recent History Entries", 0, 48, 24, 8, 'cacheflow_history_entry{roadmap_version="1"}'),
    ]
    return {
        "dashboard": {
            "id": None,
            "uid": "cacheflow-sprints",
            "title": "CacheFlow Canonical Roadmap Tracker",
            "tags": ["cacheflow", "roadmap", "sprint", "gate"],
            "timezone": "browser",
            "schemaVersion": 41,
            "version": 6,
            "refresh": "30s",
            "time": {"from": "now-30d", "to": "now"},
            "panels": panels,
        },
        "overwrite": True,
    }


def build_history_dashboard() -> dict:
    panels = [
        text_panel(
            1,
            "Scope & Overview",
            0,
            0,
            24,
            4,
            "\n".join(
                [
                    "# CacheFlow Roadmap History",
                    "- Focused on current roadmap execution, not a raw dump of every legacy task row",
                    "- Detailed raw task rows are scoped to Sprint 6",
                    "- Historical core-platform audit remains on the separate module audit dashboard",
                ]
            ),
        ),
        stat_panel(2, "Core Platform Tasks Done (V1-1)", 0, 4, 6, 4, 'count(cacheflow_task_status{roadmap_stage="V1-1",status="done"})'),
        stat_panel(3, "Sprint 6 Gate Rows Total", 6, 4, 6, 4, 'count(cacheflow_task_status{sprint="6"})'),
        stat_panel(4, "Sprint 6 Outstanding Rows", 12, 4, 6, 4, 'count(cacheflow_task_status{sprint="6",status=~"planned|pending|running"})'),
        stat_panel(5, "Total History Entries", 18, 4, 6, 4, "count(cacheflow_history_entry)"),
        table_panel(10, "Recent State Changes", 0, 8, 24, 12, "cacheflow_history_entry"),
        table_panel(11, "Sprint 6 Raw Gate Detail", 0, 20, 24, 10, 'cacheflow_task_status{sprint="6"}'),
        table_panel(12, "Version 1 Roadmap Stage Detail", 0, 30, 12, 9, 'cacheflow_roadmap_stage_status{roadmap_version="1"}'),
        table_panel(13, "Version 2 Roadmap Stage Detail", 12, 30, 12, 9, 'cacheflow_roadmap_stage_status{roadmap_version="2"}'),
        table_panel(14, "Version 2 Backlog Item Detail", 0, 39, 24, 12, 'cacheflow_roadmap_item_status{roadmap_version="2"}'),
    ]
    return {
        "dashboard": {
            "id": None,
            "uid": "cacheflow-history",
            "title": "CacheFlow Canonical Roadmap History",
            "tags": ["cacheflow", "roadmap", "history"],
            "schemaVersion": 41,
            "version": 5,
            "timezone": "browser",
            "refresh": "1m",
            "time": {"from": "now-30d", "to": "now"},
            "panels": panels,
        },
        "overwrite": True,
    }


def build_module_audit_dashboard() -> dict:
    panels = [
        text_panel(
            1,
            "Scope & Overview",
            0,
            0,
            24,
            4,
            "\n".join(
                [
                    "# CacheFlow V1-1 Core Platform Audit",
                    "- Historical completeness audit for the delivered Sprint 0-5 core platform",
                    "- This dashboard is archival detail, not the active Sprint 6 execution board",
                    "- Current roadmap execution lives on the canonical roadmap dashboards",
                ]
            ),
        ),
        stat_panel(2, "Total Modules (V1-1)", 0, 4, 6, 4, 'cacheflow_module_audit_total{scope="sprints_0_5"}'),
        stat_panel(3, "Complete Modules", 6, 4, 6, 4, 'cacheflow_module_audit_complete_total{scope="sprints_0_5"}'),
        stat_panel(4, "Partially Complete Modules", 12, 4, 6, 4, 'cacheflow_module_audit_partial_total{scope="sprints_0_5"}'),
        stat_panel(5, "Incomplete Modules", 18, 4, 6, 4, 'cacheflow_module_audit_incomplete_total{scope="sprints_0_5"}'),
        table_panel(6, "V1-1 Module Audit Details", 0, 8, 24, 14, 'cacheflow_module_audit_score{sprint=~"0|1|2|3|4|5"}'),
        table_panel(7, "Incomplete & Partial Modules (Exceptions)", 0, 22, 24, 10, 'cacheflow_module_audit_score{sprint=~"0|1|2|3|4|5",completeness!="complete"}'),
    ]
    return {
        "dashboard": {
            "id": None,
            "uid": "cacheflow-module-audit",
            "title": "CacheFlow V1-1 Core Platform Audit",
            "tags": ["cacheflow", "audit", "roadmap", "v1"],
            "timezone": "browser",
            "schemaVersion": 42,
            "version": 3,
            "refresh": "1m",
            "time": {"from": "now-30d", "to": "now"},
            "panels": panels,
        },
        "overwrite": True,
    }


def main() -> None:
    write_dashboard(MONITORING / "grafana-cacheflow-sprints.json", build_sprints_dashboard())
    write_dashboard(MONITORING / "grafana-cacheflow-history.json", build_history_dashboard())
    write_dashboard(MONITORING / "grafana-cacheflow-module-audit.json", build_module_audit_dashboard())
    print("generated 3 Grafana dashboards")


if __name__ == "__main__":
    main()
