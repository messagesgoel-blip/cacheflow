#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


BASE = Path("/home/sanjay/cacheflow_work")
MONITORING = BASE / "monitoring"
STATE_FILE = BASE / "logs" / "orchestrator-state.json"


def current_execution_line() -> str:
    sprint = None

    if STATE_FILE.exists():
        try:
            state = json.loads(STATE_FILE.read_text())
            sprint = state.get("current_sprint")
        except Exception:
            sprint = None

    if sprint is None:
        return "- Current execution: see `logs/orchestrator-state.json`"

    sprint_num = int(sprint)
    version = "Version 1" if sprint_num <= 6 else "Version 2"
    suffix = " planning" if sprint_num >= 7 else ""
    return f"- Current execution: Sprint {sprint_num} / {version}{suffix}"


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
                },
                {
                    "matcher": {"id": "byName", "options": "__name__"},
                    "properties": [
                        {"id": "displayName", "value": "Name"},
                        {"id": "custom.align", "value": "left"}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "Value"},
                    "properties": [
                        {"id": "displayName", "value": "Stage Status"},
                        {"id": "custom.align", "value": "center"}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "roadmap_version"},
                    "properties": [
                        {"id": "displayName", "value": "Version"},
                        {"id": "custom.align", "value": "center"}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "stage"},
                    "properties": [
                        {"id": "displayName", "value": "Stage"},
                        {"id": "custom.align", "value": "left"}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "status"},
                    "properties": [
                        {"id": "displayName", "value": "Status"},
                        {"id": "custom.align", "value": "center"}
                    ]
                }
            ]
        }
    }


def write_dashboard(path: Path, payload: dict) -> None:
    dashboard_content = payload["dashboard"]
    path.write_text(json.dumps(dashboard_content, indent=2) + "\n")


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
                    current_execution_line(),
                    "- Legacy Sprint 0-5 details are no longer the primary dashboard surface",
                    "- Source of truth: `docs/roadmap.md` and `logs/orchestrator-state.json`",
                ]
            ),
        ),
        stat_panel(2, "Active Sprint", 0, 4, 4, 4, "cacheflow_current_sprint"),
        gauge_panel(3, "Version 1 Progress %", 4, 4, 5, 4, 'cacheflow_roadmap_version_progress_percent{roadmap_version="1"}'),
        gauge_panel(4, "Version 2 Progress %", 9, 4, 5, 4, 'cacheflow_roadmap_version_progress_percent{roadmap_version="2"}'),
        stat_panel(5, "Sprint 6 Active Items", 14, 4, 5, 4, 'count(cacheflow_roadmap_item_status{sprint="6",status=~"pending|running|under_review"})'),
        stat_panel(6, "Version 2 Planned Sprints", 19, 4, 5, 4, 'count(cacheflow_roadmap_item_status{roadmap_version="2",status=~"planned|pending|running|under_review"})'),
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
        stat_panel(4, "Sprint 6 Outstanding Rows", 12, 4, 6, 4, 'count(cacheflow_task_status{sprint="6",status=~"planned|pending|running|under_review"})'),
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


def build_engineering_health_dashboard() -> dict:
    panels = [
        {
            "gridPos": {"h": 2, "w": 24, "x": 0, "y": 0},
            "id": 1,
            "options": {
                "code": {
                    "language": "plaintext",
                    "showLineNumbers": False,
                    "showMiniMap": False
                },
                "content": "## 🏗️ CacheFlow Sprint Health\nManager view · answers: **what's at risk**, **how far along each sprint is**, and **are we tracking to roadmap**.",
                "mode": "markdown"
            },
            "pluginVersion": "12.4.0",
            "targets": [{"refId": "A"}],
            "title": "CacheFlow — Engineering Health Dashboard",
            "type": "text"
        },
        {
            "description": "Which sprint is currently active",
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "displayName": "Active Sprint",
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]}
                },
                "overrides": []
            },
            "gridPos": {"h": 4, "w": 4, "x": 0, "y": 2},
            "id": 2,
            "options": {
                "colorMode": "value",
                "graphMode": "none",
                "justifyMode": "auto",
                "orientation": "auto",
                "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                "showPercentChange": False,
                "textMode": "auto",
                "wideLayout": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "cacheflow_current_sprint", "refId": "A"}],
            "title": "Active Sprint",
            "type": "stat"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "mappings": [],
                    "max": 100,
                    "min": 0,
                    "thresholds": {"mode": "absolute", "steps": [{"color": "red", "value": None}, {"color": "semi-dark-orange", "value": 50}, {"color": "semi-dark-yellow", "value": 75}, {"color": "semi-dark-green", "value": 90}]},
                    "unit": "percent"
                },
                "overrides": []
            },
            "gridPos": {"h": 6, "w": 6, "x": 4, "y": 2},
            "id": 3,
            "options": {
                "minVizHeight": 75,
                "minVizWidth": 75,
                "orientation": "auto",
                "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                "showThresholdLabels": False,
                "showThresholdMarkers": True,
                "sizing": "auto",
                "text": {}
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "100 * cacheflow_tasks_completed_total / clamp_min(cacheflow_total_tasks, 1)", "refId": "A"}],
            "title": "Overall Roadmap Progress",
            "type": "gauge"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "semi-dark-yellow", "value": None}, {"color": "semi-dark-red", "value": 10}]},
                    "unit": "none"
                },
                "overrides": []
            },
            "gridPos": {"h": 4, "w": 5, "x": 10, "y": 2},
            "id": 4,
            "options": {
                "colorMode": "value",
                "graphMode": "none",
                "justifyMode": "auto",
                "orientation": "auto",
                "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                "showPercentChange": False,
                "textMode": "auto",
                "wideLayout": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "count(cacheflow_task_status{status=\"running\"})", "refId": "A"}],
            "title": "⚠️ In Flight",
            "type": "stat"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "blue", "value": None}]},
                    "unit": "none"
                },
                "overrides": []
            },
            "gridPos": {"h": 4, "w": 5, "x": 15, "y": 2},
            "id": 5,
            "options": {
                "colorMode": "value",
                "graphMode": "none",
                "justifyMode": "auto",
                "orientation": "auto",
                "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                "showPercentChange": False,
                "textMode": "auto",
                "wideLayout": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "count(cacheflow_task_status{status=\"done\"})", "refId": "A"}],
            "title": "✅ Total Done",
            "type": "stat"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "purple", "value": None}]},
                    "unit": "none"
                },
                "overrides": []
            },
            "gridPos": {"h": 4, "w": 4, "x": 20, "y": 2},
            "id": 6,
            "options": {
                "colorMode": "value",
                "graphMode": "none",
                "justifyMode": "auto",
                "orientation": "auto",
                "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                "showPercentChange": False,
                "textMode": "auto",
                "wideLayout": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "sum(cacheflow_gate_is_done)", "refId": "A"}],
            "title": "🚩 Gates Cleared",
            "type": "stat"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "super-light-blue", "value": None}]},
                    "unit": "none"
                },
                "overrides": []
            },
            "gridPos": {"h": 2, "w": 24, "x": 0, "y": 6},
            "id": 7,
            "options": {
                "colorMode": "value",
                "graphMode": "none",
                "justifyMode": "auto",
                "orientation": "auto",
                "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                "showPercentChange": False,
                "textMode": "auto",
                "wideLayout": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "sum(cacheflow_sprint_commits_total)", "refId": "A"}],
            "title": "📦 Total Commits",
            "type": "stat"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "palette-classic"},
                    "custom": {
                        "axisBorderShow": False,
                        "axisCenteredZero": False,
                        "axisColorMode": "text",
                        "axisLabel": "",
                        "axisPlacement": "auto",
                        "barAlignment": 0,
                        "drawStyle": "line",
                        "fillOpacity": 0,
                        "gradientMode": "none",
                        "hideFrom": {"legend": False, "tooltip": False, "viz": False},
                        "insertNulls": False,
                        "lineInterpolation": "linear",
                        "lineWidth": 1,
                        "pointSize": 5,
                        "scaleDistribution": {"type": "linear"},
                        "showPoints": "auto",
                        "spanNulls": False,
                        "stacking": {"group": "A", "mode": "none"},
                        "thresholdsStyle": {"mode": "off"}
                    },
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 80}]}
                },
                "overrides": []
            },
            "gridPos": {"h": 7, "w": 12, "x": 0, "y": 8},
            "id": 8,
            "options": {
                "legend": {"calcs": [], "displayMode": "list", "placement": "bottom", "showLegend": True},
                "tooltip": {"mode": "single", "sort": "none"}
            },
            "targets": [{"expr": "cacheflow_sprint_progress_percent", "legendFormat": "Sprint {{sprint}}", "refId": "A"}],
            "title": "🗺️ Sprint Pipeline — Completion %",
            "type": "timeseries"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "palette-classic"},
                    "custom": {
                        "axisBorderShow": False,
                        "axisCenteredZero": False,
                        "axisColorMode": "text",
                        "axisLabel": "",
                        "axisPlacement": "auto",
                        "barAlignment": 0,
                        "drawStyle": "line",
                        "fillOpacity": 0,
                        "gradientMode": "none",
                        "hideFrom": {"legend": False, "tooltip": False, "viz": False},
                        "insertNulls": False,
                        "lineInterpolation": "linear",
                        "lineWidth": 1,
                        "pointSize": 5,
                        "scaleDistribution": {"type": "linear"},
                        "showPoints": "auto",
                        "spanNulls": False,
                        "stacking": {"group": "A", "mode": "none"},
                        "thresholdsStyle": {"mode": "off"}
                    },
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 80}]}
                },
                "overrides": []
            },
            "gridPos": {"h": 7, "w": 12, "x": 12, "y": 8},
            "id": 9,
            "options": {
                "legend": {"calcs": [], "displayMode": "list", "placement": "bottom", "showLegend": True},
                "tooltip": {"mode": "single", "sort": "none"}
            },
            "targets": [
                {"expr": "cacheflow_sprint_done_tasks", "legendFormat": "Sprint {{sprint}} done", "refId": "A"},
                {"expr": "cacheflow_sprint_total_tasks", "legendFormat": "Sprint {{sprint}} total", "refId": "B"}
            ],
            "title": "📊 Done / Total Tasks per Sprint",
            "type": "timeseries"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "custom": {
                        "align": "auto",
                        "cellOptions": {"type": "auto"},
                        "inspect": False
                    },
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 80}]}
                },
                "overrides": [
                    {"matcher": {"id": "byName", "options": "Time"}, "properties": [{"id": "unit", "value": "dateTimeAsUS"}]},
                    {"matcher": {"id": "byName", "options": "Value"}, "properties": [{"id": "unit", "value": "none"}]}
                ]
            },
            "gridPos": {"h": 8, "w": 24, "x": 0, "y": 15},
            "id": 10,
            "options": {
                "cellHeight": "sm",
                "footer": {"countRows": False, "fields": "", "reducer": ["sum"], "show": False},
                "showHeader": True
            },
            "pluginVersion": "12.4.0",
            "targets": [
                {"expr": "count by (gate) (cacheflow_task_status)", "format": "table", "instant": True, "range": False, "refId": "A"},
                {"expr": "count by (gate) (cacheflow_task_status{status=\"done\"})", "format": "table", "instant": True, "range": False, "refId": "B"},
                {"expr": "count by (gate) (cacheflow_task_status{status=\"running\"})", "format": "table", "instant": True, "range": False, "refId": "C"}
            ],
            "title": "📋 Tasks by Gate",
            "transformations": [
                {"id": "merge", "options": {}},
                {"id": "organize", "options": {"excludeByName": {}, "indexByName": {"Value": 2, "Value #B": 3, "Value #C": 4, "gate": 0}, "renameByName": {"Value": "Total", "Value #B": "Done", "Value #C": "Running", "gate": "Gate"}}}
            ],
            "type": "table"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "custom": {
                        "align": "auto",
                        "cellOptions": {"type": "auto"},
                        "inspect": False
                    },
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 80}]}
                },
                "overrides": [
                    {"matcher": {"id": "byName", "options": "Time"}, "properties": [{"id": "unit", "value": "dateTimeAsUS"}]},
                    {"matcher": {"id": "byName", "options": "Value"}, "properties": [{"id": "unit", "value": "none"}]}
                ]
            },
            "gridPos": {"h": 10, "w": 24, "x": 0, "y": 23},
            "id": 11,
            "options": {
                "cellHeight": "sm",
                "footer": {"countRows": False, "fields": "", "reducer": ["sum"], "show": False},
                "showHeader": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "cacheflow_task_status{status=\"planned\", sprint=~\"$sprint\", agent=~\"$agent\"}", "format": "table", "instant": True, "range": False, "refId": "A"}],
            "title": "📋 Backlog / Planned",
            "type": "table"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "custom": {
                        "align": "auto",
                        "cellOptions": {"type": "auto"},
                        "inspect": False
                    },
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 80}]}
                },
                "overrides": [
                    {"matcher": {"id": "byName", "options": "Time"}, "properties": [{"id": "unit", "value": "dateTimeAsUS"}]},
                    {"matcher": {"id": "byName", "options": "Value"}, "properties": [{"id": "unit", "value": "none"}]}
                ]
            },
            "gridPos": {"h": 10, "w": 24, "x": 0, "y": 33},
            "id": 12,
            "options": {
                "cellHeight": "sm",
                "footer": {"countRows": False, "fields": "", "reducer": ["sum"], "show": False},
                "showHeader": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "cacheflow_task_status{status=\"running\", sprint=~\"$sprint\", agent=~\"$agent\"}", "format": "table", "instant": True, "range": False, "refId": "A"}],
            "title": "🚀 In Progress / Active",
            "type": "table"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "custom": {
                        "align": "auto",
                        "cellOptions": {"type": "auto"},
                        "inspect": False
                    },
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 80}]}
                },
                "overrides": [
                    {"matcher": {"id": "byName", "options": "Time"}, "properties": [{"id": "unit", "value": "dateTimeAsUS"}]},
                    {"matcher": {"id": "byName", "options": "Value"}, "properties": [{"id": "unit", "value": "none"}]}
                ]
            },
            "gridPos": {"h": 10, "w": 24, "x": 0, "y": 43},
            "id": 13,
            "options": {
                "cellHeight": "sm",
                "footer": {"countRows": False, "fields": "", "reducer": ["sum"], "show": False},
                "showHeader": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "cacheflow_task_status{status=\"done\", sprint=~\"$sprint\", agent=~\"$agent\"}", "format": "table", "instant": True, "range": False, "refId": "A"}],
            "title": "✅ Completed / Done",
            "type": "table"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "custom": {
                        "align": "auto",
                        "cellOptions": {"type": "auto"},
                        "inspect": False
                    },
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 80}]}
                },
                "overrides": [
                    {"matcher": {"id": "byName", "options": "Time"}, "properties": [{"id": "unit", "value": "dateTimeAsUS"}]},
                    {"matcher": {"id": "byName", "options": "Value"}, "properties": [{"id": "unit", "value": "none"}]}
                ]
            },
            "gridPos": {"h": 10, "w": 24, "x": 0, "y": 53},
            "id": 14,
            "options": {
                "cellHeight": "sm",
                "footer": {"countRows": False, "fields": "", "reducer": ["sum"], "show": False},
                "showHeader": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "cacheflow_task_status{sprint=~\"$sprint\", agent=~\"$agent\"}", "format": "table", "instant": True, "range": False, "refId": "A"}],
            "title": "📋 All Tasks",
            "type": "table"
        },
        {
            "fieldConfig": {
                "defaults": {
                    "color": {"mode": "thresholds"},
                    "custom": {
                        "align": "auto",
                        "cellOptions": {"type": "auto"},
                        "inspect": False
                    },
                    "mappings": [],
                    "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 80}]}
                },
                "overrides": [
                    {"matcher": {"id": "byName", "options": "Time"}, "properties": [{"id": "unit", "value": "dateTimeAsUS"}]},
                    {"matcher": {"id": "byName", "options": "Value"}, "properties": [{"id": "unit", "value": "none"}]}
                ]
            },
            "gridPos": {"h": 8, "w": 24, "x": 0, "y": 63},
            "id": 15,
            "options": {
                "cellHeight": "sm",
                "footer": {"countRows": False, "fields": "", "reducer": ["sum"], "show": False},
                "showHeader": True
            },
            "pluginVersion": "12.4.0",
            "targets": [{"expr": "cacheflow_history_entry{ts!=\"\"}", "format": "table", "instant": True, "range": False, "refId": "A"}],
            "title": "📜 Task History (Recent)",
            "type": "table"
        }
    ]
    
    templating = {
        "list": [
            {
                "current": {},
                "datasource": {"type": "prometheus", "uid": "prometheus"},
                "definition": "label_values(cacheflow_task_status, sprint)",
                "hide": 0,
                "includeAll": True,
                "label": "Sprint",
                "multi": True,
                "name": "sprint",
                "options": [],
                "query": {"expr": "label_values(cacheflow_task_status, sprint)"},
                "refresh": 1,
                "regex": "",
                "skipUrlSync": False,
                "sort": 1,
                "type": "query"
            },
            {
                "current": {},
                "datasource": {"type": "prometheus", "uid": "prometheus"},
                "definition": "label_values(cacheflow_task_status, agent)",
                "hide": 0,
                "includeAll": True,
                "label": "Agent",
                "multi": True,
                "name": "agent",
                "options": [],
                "query": {"expr": "label_values(cacheflow_task_status, agent)"},
                "refresh": 1,
                "regex": "",
                "skipUrlSync": False,
                "sort": 1,
                "type": "query"
            }
        ]
    }
    
    return {
        "dashboard": {
            "id": None,
            "uid": "ad2pj27",
            "title": "CacheFlow — Engineering Health",
            "tags": ["cacheflow", "health", "manager", "sprint"],
            "timezone": "browser",
            "schemaVersion": 42,
            "version": 1,
            "refresh": "30s",
            "time": {"from": "now-30d", "to": "now"},
            "panels": panels,
            "templating": templating
        },
        "overwrite": True,
    }


def main() -> None:
    write_dashboard(MONITORING / "grafana-cacheflow-sprints.json", build_sprints_dashboard())
    write_dashboard(MONITORING / "grafana-cacheflow-history.json", build_history_dashboard())
    write_dashboard(MONITORING / "grafana-cacheflow-module-audit.json", build_module_audit_dashboard())
    write_dashboard(MONITORING / "grafana-cacheflow-engineering-health.json", build_engineering_health_dashboard())
    print("generated 4 Grafana dashboards")


if __name__ == "__main__":
    main()
