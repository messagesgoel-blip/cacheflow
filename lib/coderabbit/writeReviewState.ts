import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { CodeRabbitReviewSignal } from './parseReview';

/**
 * Writes CodeRabbit review state to a persistent log/state file for orchestrator use.
 */
export async function writeReviewState(prNumber: number, signal: CodeRabbitReviewSignal) {
  const root = path.resolve(__dirname, "..", "..");
  const monitoringDir = path.join(root, "monitoring");
  const statePath = path.join(monitoringDir, `coderabbit-${prNumber}.yaml`);

  const state = {
    prNumber,
    status: "completed",
    hasBlockers: signal.hasBlockers,
    severity: signal.severity,
    summary: signal.summary,
    suggestions: signal.suggestions,
    actionableCount: signal.actionableCount,
    receivedAt: new Date().toISOString(),
    agentNotified: false,
  };

  await mkdir(monitoringDir, { recursive: true });

  await writeFile(
    statePath,
    yaml.dump(state, { lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false }),
    "utf8",
  );
  console.log(`CodeRabbit state written for PR #${prNumber}`);
}
