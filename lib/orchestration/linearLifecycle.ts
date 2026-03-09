import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const AUDIT_PATH = path.join(ROOT, "logs", "codex-audit.jsonl");
const LINEAR_SYNC_SCRIPT = path.join(ROOT, "scripts", "linear-sprint-sync.sh");
const LINEAR_CREATE_SCRIPT = path.join(ROOT, "scripts", "linear-create-issue.sh");
const LINEAR_COMMAND_TIMEOUT_MS = 60_000;

function nowIso(): string {
  return new Date().toISOString();
}

function appendAudit(entry: Record<string, unknown>): void {
  appendFileSync(AUDIT_PATH, `${JSON.stringify({ ts: nowIso(), ...entry })}\n`, "utf8");
}

function quoteArg(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function runLinearCommand(cmd: string, context: string): string {
  try {
    const result = spawnSync("bash", ["-lc", cmd], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      timeout: LINEAR_COMMAND_TIMEOUT_MS,
    });
    if (result.status !== 0) {
      const stderr = (result.stderr || result.stdout || "").trim();
      appendAudit({ event: "linear", status: "warn", severity: "warn", detail: `${context}; ${stderr}` });
      return "";
    }
    appendAudit({ event: "linear", status: "ok", detail: context });
    return (result.stdout || "").trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    appendAudit({ event: "linear", status: "warn", severity: "warn", detail: `${context}; ${detail}` });
    return "";
  }
}

export function markTaskStarted(issueId: string): void {
  runLinearCommand(`bash ${quoteArg(LINEAR_SYNC_SCRIPT)} ${quoteArg(issueId)} ${quoteArg("In Progress")}`, `markTaskStarted:${issueId}`);
}

export function markTaskDone(issueId: string): void {
  runLinearCommand(`bash ${quoteArg(LINEAR_SYNC_SCRIPT)} ${quoteArg(issueId)} ${quoteArg("Done")}`, `markTaskDone:${issueId}`);
}

export function markTaskBlocked(issueId: string, reason: string): void {
  const safeReason = reason.slice(0, 1200);
  runLinearCommand(
    `bash ${quoteArg(LINEAR_SYNC_SCRIPT)} ${quoteArg(issueId)} ${quoteArg("Blocked")} ${quoteArg(safeReason)}`,
    `markTaskBlocked:${issueId}`,
  );
}

export function createRegressionIssue(title: string, description: string, teamKey: string): string {
  const output = runLinearCommand(
    `bash ${quoteArg(LINEAR_CREATE_SCRIPT)} ${quoteArg(title)} ${quoteArg(teamKey)} ${quoteArg(description)}`,
    `createRegressionIssue:${title}`,
  );

  const issueId = output.split(/\r?\n/).map((line) => line.trim()).find((line) => /^\w+-\d+$/.test(line)) ?? "";
  if (!issueId) {
    appendAudit({
      event: "linear",
      status: "warn",
      severity: "warn",
      detail: `createRegressionIssue returned no issue id for title=${title}`,
    });
  }
  return issueId;
}
