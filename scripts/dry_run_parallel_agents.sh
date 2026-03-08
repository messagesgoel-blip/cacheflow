#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${CACHEFLOW_COORD_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
COORD="$ROOT/agent-coord.sh"

TASK_SHARED="DRYRUN-SHARED@DRYRUN"
TASK_ALPHA="DRYRUN-ALPHA@DRYRUN"
TASK_BETA="DRYRUN-BETA@DRYRUN"

cleanup() {
  "$COORD" release_task "$TASK_SHARED" >/dev/null 2>&1 || true
  "$COORD" release_task "$TASK_ALPHA" >/dev/null 2>&1 || true
  "$COORD" release_task "$TASK_BETA" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ ! -x "$COORD" ]; then
  echo "missing executable coordinator: $COORD"
  exit 1
fi

echo "[dry-run] root=$ROOT"
cleanup

echo
echo "[scenario 1] contention on one task"
set +e
"$COORD" claim_task "$TASK_SHARED" AgentAlpha dryrun-host > /tmp/dryrun-claim-1.log 2>&1
rc1=$?
"$COORD" claim_task "$TASK_SHARED" AgentBravo dryrun-host > /tmp/dryrun-claim-2.log 2>&1
rc2=$?
set -e
echo "AgentAlpha claim rc=$rc1"
echo "AgentBravo claim rc=$rc2 (expected non-zero due to lock contention)"
tail -n 1 /tmp/dryrun-claim-1.log || true
tail -n 2 /tmp/dryrun-claim-2.log || true

echo
echo "[scenario 2] parallel claims on independent tasks"
set +e
"$COORD" claim_task "$TASK_ALPHA" AgentAlpha dryrun-host > /tmp/dryrun-claim-a.log 2>&1 &
pid_a=$!
"$COORD" claim_task "$TASK_BETA" AgentBeta dryrun-host > /tmp/dryrun-claim-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; rc_a=$?
wait "$pid_b"; rc_b=$?
set -e
echo "AgentAlpha independent claim rc=$rc_a"
echo "AgentBeta independent claim rc=$rc_b"
tail -n 1 /tmp/dryrun-claim-a.log || true
tail -n 1 /tmp/dryrun-claim-b.log || true

echo
echo "[scenario 3] active lock visibility"
"$COORD" get_active_tasks

echo
echo "[scenario 4] cleanup releases"
"$COORD" release_task "$TASK_SHARED" >/tmp/dryrun-release-1.log 2>&1 || true
"$COORD" release_task "$TASK_ALPHA" >/tmp/dryrun-release-a.log 2>&1 || true
"$COORD" release_task "$TASK_BETA" >/tmp/dryrun-release-b.log 2>&1 || true
cat /tmp/dryrun-release-1.log /tmp/dryrun-release-a.log /tmp/dryrun-release-b.log | sed '/^$/d'

echo
echo "[final] active locks after cleanup"
"$COORD" get_active_tasks

echo
echo "dry-run complete"

