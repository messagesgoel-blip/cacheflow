# Dashboard Sync - 2026-03-07

## Scope

- Regenerate tracked CacheFlow Grafana dashboard JSON files from source.
- Sync the regenerated files into the provisioned Grafana dashboard directory.
- Converge workspace, `origin/main`, and live repo history onto the same commit after the VPS/auth fixes.

## Dashboards Refreshed

- `monitoring/grafana-cacheflow-sprints.json`
- `monitoring/grafana-cacheflow-history.json`
- `monitoring/grafana-cacheflow-module-audit.json`
- `monitoring/grafana-cacheflow-engineering-health.json`

## Deployment Path

- Source generator: `scripts/generate_cacheflow_grafana_dashboards.py`
- Provisioned Grafana path: `/srv/storage/shared/apps/grafana/dashboards`
- Provisioning config: `/srv/storage/shared/apps/grafana/provisioning/dashboards/default.yml`

## Notes

- Grafana API writes were rejected because these dashboards are file-provisioned (`Cannot save provisioned dashboard`).
- Reload path used: copy JSON files into the provisioned directory and restart Grafana.
