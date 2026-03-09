#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from cacheflow_paths import resolve_base


BASE = resolve_base()
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
                        {"id": "custom.align", "value": "auto"},
                    ],
                },
                {
                    "matcher": {"id": "byName", "options": "Timestamp"},
                    "properties": [
                        {"id": "unit", "value": "dateTimeAsUS"},
                        {"id": "custom.align", "value": "auto"},
                    ],
                },
                {
                    "matcher": {"id": "byName", "options": "__name__"},
                    "properties": [{"id": "custom.hidden", "value": True}],
                },
                {
                    "matcher": {"id": "byName", "options": "Metric"},
                    "properties": [{"id": "custom.hidden", "value": True}],
                },
            ],
        },
    }


def write_dashboard(path: Path, payload: dict) -> None:
    dashboard_content = payload["dashboard"]
    path.write_text(json.dumps(dashboard_content, indent=2) + "\n")


def build_manager_dashboard() -> dict:
    panels = [
        text_panel(
            1,
            "Manager Summary",
            0,
            0,
            24,
            4,
            "\n".join(
                [
                    "# CacheFlow Manager Overview",
                    "- Current execution: see live Prometheus metrics and `logs/orchestrator-state.json`",
                    "- Audience: quick product and execution status at a glance",
                    "- Source of truth: `docs/roadmap.md`, `docs/orchestration/task-manifest.json`, `logs/orchestrator-state.json`, and generated metrics",
                ]
            ),
        ),
        stat_panel(2, "Active Sprint", 0, 4, 4, 4, "cacheflow_current_sprint"),
        gauge_panel(3, "Version 1 Progress %", 4, 4, 5, 4, 'cacheflow_roadmap_version_progress_percent{roadmap_version="1"}'),
        gauge_panel(4, "Version 2 Progress %", 9, 4, 5, 4, 'cacheflow_roadmap_version_progress_percent{roadmap_version="2"}'),
        stat_panel(5, "Active Tasks", 14, 4, 5, 4, 'count(cacheflow_task_status{status=~"running|under_review"})'),
        stat_panel(6, "Completed Tasks", 19, 4, 5, 4, "cacheflow_tasks_completed_total"),
        stat_panel(7, "Version 2 Open Items", 0, 8, 6, 4, 'count(cacheflow_roadmap_item_status{roadmap_version="2",status=~"planned|pending|running|under_review"})'),
        stat_panel(8, "Release Gates Cleared", 6, 8, 6, 4, "sum(cacheflow_gate_is_done)"),
        stat_panel(9, "Current Sprint Progress %", 12, 8, 6, 4, "cacheflow_sprint_progress"),
        stat_panel(10, "Recent Changes Logged", 18, 8, 6, 4, "count(cacheflow_history_entry)"),
        table_panel(11, "Roadmap Stage Status", 0, 12, 24, 10, "cacheflow_roadmap_stage_status"),
        table_panel(12, "Active Roadmap Items", 0, 22, 24, 10, 'cacheflow_roadmap_item_status{status=~"running|under_review|pending"}'),
        table_panel(13, "Current Active Tasks", 0, 32, 24, 10, 'cacheflow_task_status{status=~"running|under_review"}'),
        table_panel(14, "Recent History Entries", 0, 42, 24, 10, "cacheflow_history_entry"),
    ]
    return {
        "dashboard": {
            "id": None,
            "uid": "cacheflow-manager",
            "title": "CacheFlow Manager Overview",
            "tags": ["cacheflow", "manager", "roadmap", "overview"],
            "timezone": "browser",
            "schemaVersion": 42,
            "version": 1,
            "refresh": "30s",
            "time": {"from": "now-30d", "to": "now"},
            "panels": panels,
        },
        "overwrite": True,
    }


def build_execution_dashboard() -> dict:
    panels = [
        text_panel(
            1,
            "Execution Board",
            0,
            0,
            24,
            4,
            "\n".join(
                [
                    "# CacheFlow Detailed Execution Board",
                    "- Current execution: see live Prometheus metrics and `logs/orchestrator-state.json`",
                    "- Audience: operators and engineers",
                    "- Covers roadmap items, task detail, change history, and audit exceptions",
                ]
            ),
        ),
        stat_panel(2, "Active Sprint", 0, 4, 4, 4, "cacheflow_current_sprint"),
        gauge_panel(3, "Version 1 Progress %", 4, 4, 5, 4, 'cacheflow_roadmap_version_progress_percent{roadmap_version="1"}'),
        gauge_panel(4, "Version 2 Progress %", 9, 4, 5, 4, 'cacheflow_roadmap_version_progress_percent{roadmap_version="2"}'),
        stat_panel(5, "Running Tasks", 14, 4, 5, 4, 'count(cacheflow_task_status{status="running"})'),
        stat_panel(6, "Under Review Tasks", 19, 4, 5, 4, 'count(cacheflow_task_status{status="under_review"})'),
        gauge_panel(10, "V1-0 Release Blocker", 0, 8, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V1-0"}'),
        gauge_panel(11, "V1-1 Core Platform", 6, 8, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V1-1"}'),
        gauge_panel(12, "V1-2 Essentials", 12, 8, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V1-2"}'),
        gauge_panel(13, "V1-3 Completion", 18, 8, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V1-3"}'),
        gauge_panel(14, "V2-A Foundation", 0, 12, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V2-A"}'),
        gauge_panel(15, "V2-B Easy Wins", 6, 12, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V2-B"}'),
        gauge_panel(16, "V2-C Moderate", 12, 12, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V2-C"}'),
        gauge_panel(17, "V2-D Advanced", 18, 12, 6, 4, 'cacheflow_roadmap_stage_progress_percent{stage="V2-D"}'),
        table_panel(20, "All Roadmap Items", 0, 16, 24, 12, "cacheflow_roadmap_item_status"),
        table_panel(21, "Roadmap Stage Status", 0, 28, 24, 10, "cacheflow_roadmap_stage_status"),
        table_panel(22, "Task Rows by Gate", 0, 38, 24, 10, "cacheflow_task_status"),
        table_panel(23, "Recent State Changes", 0, 48, 24, 10, "cacheflow_history_entry"),
        table_panel(24, "Module Audit Exceptions", 0, 58, 24, 10, 'cacheflow_module_audit_score{completeness!="complete"}'),
    ]
    return {
        "dashboard": {
            "id": None,
            "uid": "cacheflow-execution",
            "title": "CacheFlow Detailed Execution Board",
            "tags": ["cacheflow", "execution", "roadmap", "tasks"],
            "timezone": "browser",
            "schemaVersion": 42,
            "version": 1,
            "refresh": "30s",
            "time": {"from": "now-30d", "to": "now"},
            "panels": panels,
        },
        "overwrite": True,
    }


def main() -> None:
    write_dashboard(MONITORING / "grafana-cacheflow-manager.json", build_manager_dashboard())
    write_dashboard(MONITORING / "grafana-cacheflow-execution.json", build_execution_dashboard())
    for obsolete in (
        MONITORING / "grafana-cacheflow-sprints.json",
        MONITORING / "grafana-cacheflow-history.json",
        MONITORING / "grafana-cacheflow-module-audit.json",
        MONITORING / "grafana-cacheflow-engineering-health.json",
    ):
        if obsolete.exists():
            obsolete.unlink()
    print("generated 2 Grafana dashboards")


if __name__ == "__main__":
    main()
