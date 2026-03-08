#!/bin/bash
# run-release-burnin.sh - Stability burn-in runner for CacheFlow

REPORT_DIR="/srv/storage/screenshots/cacheflow"
SUMMARY_FILE="$REPORT_DIR/burnin-summary.json"
PERF_FILE="$REPORT_DIR/perf-guardrails.json"
mkdir -p "$REPORT_DIR"

# Specs to run in burn-in
SPECS=("e2e/phase3-interactions.spec.ts" "e2e/phase4-information-architecture.spec.ts" "e2e/phase5-power-user.spec.ts")
LOOPS=5

echo "Starting stability burn-in: $LOOPS loops across ${#SPECS[@]} specs"

RESULTS='{"runs": [], "summary": {"total_runs": 0, "passed": 0, "failed": 0}, "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'

total_runs=0
passed=0
failed=0

for ((i=1; i<=LOOPS; i++)); do
  echo "--- LOOP $i ---"
  
  for spec in "${SPECS[@]}"; do
    echo "Running $spec (Run $i)..."
    total_runs=$((total_runs + 1))
    
    # Reset DB Fixtures (Favorites and Audit Logs for Phase 5 stability)
    docker exec cacheflow-postgres psql -U cacheflow -d cacheflow -c "DELETE FROM user_favorites; DELETE FROM audit_logs;" > /dev/null 2>&1
    
    # Run test
    npx playwright test "$spec" -c playwright.localhost.config.ts
    exit_code=$?
    
    run_entry='{"loop": '$i', "spec": "'$spec'", "status": "'$( [ $exit_code -eq 0 ] && echo "PASS" || echo "FAIL" )'"}'
    RESULTS=$(echo $RESULTS | jq ".runs += [$run_entry]")
    
    if [ $exit_code -eq 0 ]; then
      passed=$((passed + 1))
    else
      failed=$((failed + 1))
      echo "FAIL: $spec in loop $i"
      # Fail fast if requested, but we want a full report? 
      # "fail fast on first non-zero exit" - per scope.
      RESULTS=$(echo $RESULTS | jq ".summary.total_runs = $total_runs | .summary.passed = $passed | .summary.failed = $failed")
      echo $RESULTS > "$SUMMARY_FILE"
      exit 1
    fi
  done
done

RESULTS=$(echo $RESULTS | jq ".summary.total_runs = $total_runs | .summary.passed = $passed | .summary.failed = $failed")
echo $RESULTS > "$SUMMARY_FILE"

echo "Burn-in complete. Passed: $passed, Failed: $failed"

