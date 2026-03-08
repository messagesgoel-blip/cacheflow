Deterministic Mission Control Implementation
- Replaced hardcoded provider counts with real derived data from connections API
- Removed all random telemetry fallback logic from sparkline and status bars
- Implemented deterministic task prioritization (Auth > Transfers > Background)
- Normalized operation labels for consistent action reporting
- Restored Provider Breakdown telemetry to satisfy E2E test requirements
- Cleaned up unused MissionControl import from global layout
