#!/usr/bin/env bash
set -euo pipefail

# CacheFlow Performance Baseline - Day 87
# Measures: API response times, worker throughput, memory usage

API_BASE="${API_BASE:-http://cacheflow-api:8100}"
RUN_DIR="${RUN_DIR:-/tmp/cacheflow-perf-$(date +%Y%m%d_%H%M%S)}"

mkdir -p "$RUN_DIR"

echo "=== CacheFlow Performance Baseline ==="
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "API_BASE: $API_BASE"
echo "RUN_DIR: $RUN_DIR"
echo

# Detect accessible API endpoint
detect_api() {
  if curl -sS --connect-timeout 2 "$API_BASE/health" >/dev/null 2>&1; then
    echo "Using API: $API_BASE"
    return 0
  fi
  # Try localhost
  if curl -sS --connect-timeout 2 "http://127.0.0.1:8100/health" >/dev/null 2>&1; then
    API_BASE="http://127.0.0.1:8100"
    echo "Using API: $API_BASE"
    return 0
  fi
  echo "WARNING: API not accessible, some tests will be skipped"
  return 1
}

detect_api || true
echo

# Test 1: API Health Check Latency
echo "--- Test 1: API Health Check Latency ---"
if curl -sS --connect-timeout 2 "$API_BASE/health" >/dev/null 2>&1; then
  for i in {1..10}; do
    start=$(date +%s%N)
    curl -sS "$API_BASE/health" >/dev/null
    end=$(date +%s%N)
    echo $(( (end - start) / 1000000 )) >> "$RUN_DIR/health_latency.txt"
  done
  avg=$(awk '{sum+=$1; count++} END {print int(sum/count)}' "$RUN_DIR/health_latency.txt")
  echo "Average health check latency: ${avg}ms"
else
  echo "API not accessible, skipping latency test"
fi
echo

# Test 2: Worker container memory usage
echo "--- Test 2: Worker Memory Usage ---"
mem_info=$(docker stats cacheflow-worker --no-stream --format "{{.MemUsage}}" 2>/dev/null || echo "N/A")
echo "Worker memory: $mem_info"

# Test 3: API container CPU/Memory
echo "--- Test 3: API Container Stats ---"
docker stats cacheflow-api --no-stream --format "CPU: {{.CPUPerc}} | Mem: {{.MemUsage}}" 2>/dev/null || echo "API stats not available"
echo

# Test 4: Database connection pool
echo "--- Test 4: DB Connection Pool ---"
db_stats=$(docker exec cacheflow-postgres psql -U cacheflow -d cacheflow -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='cacheflow'" 2>/dev/null || echo "0")
echo "Active DB connections: $db_stats"
echo

# Test 5: File count in database
echo "--- Test 5: Database File Count ---"
file_count=$(docker exec cacheflow-postgres psql -U cacheflow -d cacheflow -t -c "SELECT COUNT(*) FROM files" 2>/dev/null | tr -d ' ' || echo "0")
echo "Total files in DB: $file_count"
echo

# Test 6: Sync status summary
echo "--- Test 6: Sync Status Summary ---"
docker exec cacheflow-worker node -e "
const { getSyncStatus } = require('./sync-worker.js');
getSyncStatus().then(s => console.log(JSON.stringify(s, null, 2))).catch(e => console.log('Error:', e.message));
" 2>/dev/null || echo "Sync status not available via API"
echo

# Test 7: Queue depth
echo "--- Test 7: Redis Queue Depth ---"
queue_len=$(docker exec cacheflow-redis redis-cli LLEN sync:queue 2>/dev/null || echo "0")
echo "Pending sync queue items: $queue_len"
echo

echo "=== Baseline Complete ==="
echo "Results saved to: $RUN_DIR"
