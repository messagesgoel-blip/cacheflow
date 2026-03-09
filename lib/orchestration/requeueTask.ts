import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Task } from "../../scripts/lib/types";
import * as CodeRabbitParser from "../coderabbit/parseReview";

const ROOT = path.resolve(process.cwd());
const MANIFEST_PATH = path.join(ROOT, "docs", "orchestration", "task-manifest.json");
const AUDIT_PATH = path.join(ROOT, "logs", "codex-audit.jsonl");

export type RequeueReason = "pre-push-blocked" | "coderabbit-blocked" | "gate-failed";

type MutableTask = Task & {
  requeueCount?: number;
  linearIssueId?: string;
  promptFeedback?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function appendAudit(entry: Record<string, unknown>): void {
  appendFileSync(AUDIT_PATH, `${JSON.stringify({ ts: nowIso(), ...entry })}\n`, "utf8");
}

function blockedTemplate(reason: RequeueReason, feedback: string): string {
  const parserRecord = CodeRabbitParser as Record<string, unknown>;
  const fromParser =
    (typeof parserRecord.BLOCKED_TEMPLATE === "string" && parserRecord.BLOCKED_TEMPLATE) ||
    (typeof parserRecord.CODE_RABBIT_BLOCKED_TEMPLATE === "string" && parserRecord.CODE_RABBIT_BLOCKED_TEMPLATE) ||
    "## CodeRabbit Review: BLOCKED\nThe following issues must be resolved before the gate can pass:\n{{feedback}}\nFix all items above. Re-push. Do not advance to the next task until coderabbit-{pr}.yaml shows hasBlockers: false.";

  const reasonLine = reason === "pre-push-blocked" ? "Source: pre-push review" : reason === "gate-failed" ? "Source: sprint gate failure" : "Source: CodeRabbit review";
  return `${fromParser.replace("{{feedback}}", feedback)}\n${reasonLine}`;
}

export function requeueTask(task: Task, feedback: string, reason: RequeueReason): MutableTask {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as { tasks: MutableTask[] };
  const index = manifest.tasks.findIndex((item) => item.id === task.id);
  if (index === -1) {
    throw new Error(`Cannot requeue unknown task ${task.id}`);
  }

  const existing = manifest.tasks[index];
  const requeueCount = (existing.requeueCount ?? 0) + 1;
  const updated: MutableTask = {
    ...existing,
    requeueCount,
    promptFeedback: blockedTemplate(reason, feedback),
  };

  manifest.tasks[index] = updated;
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  appendAudit({ event: "requeue", taskId: task.id, reason, requeueCount, status: "pending" });

  if (requeueCount > 3) {
    appendAudit({
      event: "MANUAL_INTERVENTION_REQUIRED",
      taskId: task.id,
      reason,
      requeueCount,
      status: "blocked",
    });
    throw new Error(`MANUAL_INTERVENTION_REQUIRED: task ${task.id} exceeded requeue limit`);
  }

  return updated;
}
