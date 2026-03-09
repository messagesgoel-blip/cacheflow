import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { parseCodeRabbitReview } from "./parseReview";

const ROOT = path.resolve(__dirname, "..", "..");
const MONITORING_DIR = path.join(ROOT, "monitoring");

export async function writeReviewState(
  pr: number,
  parsed: ReturnType<typeof parseCodeRabbitReview>,
): Promise<string> {
  await mkdir(MONITORING_DIR, { recursive: true });

  const outPath = path.join(MONITORING_DIR, `coderabbit-${pr}.yaml`);
  const data = {
    pr,
    status: "completed",
    hasBlockers: parsed.hasBlockers,
    severity: parsed.severity,
    summary: parsed.summary,
    suggestions: parsed.suggestions,
    receivedAt: new Date().toISOString(),
    agentNotified: false,
  };

  const serialized = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  await writeFile(outPath, serialized, "utf8");
  return outPath;
}
