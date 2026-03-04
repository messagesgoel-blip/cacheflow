import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorState, TaskManifest } from "./lib/types";

const ROOT = path.resolve(process.cwd());
const LOG_DIR = path.join(ROOT, "logs");
const STATE_PATH = path.join(LOG_DIR, "orchestrator-state.json");
const MANIFEST_PATH = path.join(ROOT, "docs", "orchestration", "task-manifest.json");
const AUDIT_PATH = path.join(LOG_DIR, "codex-audit.jsonl");

interface RecoverArgs {
  sprint: number;
  requeue: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseArgs(argv: string[]): RecoverArgs {
  let sprint: number | null = null;
  let requeue: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("--sprint=")) {
      sprint = Number(arg.slice("--sprint=".length));
      continue;
    }
    if (arg.startsWith("--requeue=")) {
      requeue = arg
        .slice("--requeue=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }
  }

  if (sprint === null || Number.isNaN(sprint)) {
    throw new Error("Missing required --sprint=<number>");
  }

  if (requeue.length === 0) {
    throw new Error("Missing required --requeue=<taskId,taskId>");
  }

  return { sprint, requeue };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function runGit(args: string[]): Promise<number> {
  return new Promise<number>((resolve) => {
    const child = spawn("git", args, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function appendAudit(event: Record<string, unknown>): Promise<void> {
  await appendFile(AUDIT_PATH, `${JSON.stringify(event)}\n`, "utf8");
}

async function ensureFileExists(filePath: string): Promise<void> {
  await stat(filePath);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const failureFile = path.join(LOG_DIR, "gate-failures", `sprint-${args.sprint}.md`);

  await ensureFileExists(failureFile);
  const gateFailureBody = await readFile(failureFile, "utf8");

  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing manifest: ${MANIFEST_PATH}`);
  }
  if (!existsSync(STATE_PATH)) {
    throw new Error(`Missing orchestrator state: ${STATE_PATH}`);
  }

  const manifest = await readJsonFile<TaskManifest>(MANIFEST_PATH);
  const state = await readJsonFile<OrchestratorState>(STATE_PATH);

  const knownIds = new Set(manifest.tasks.map((task) => task.id));
  const invalid = args.requeue.filter((taskId) => !knownIds.has(taskId));
  if (invalid.length > 0) {
    throw new Error(`Unknown task IDs in --requeue: ${invalid.join(", ")}`);
  }

  const deletedContracts: string[] = [];
  for (const taskId of args.requeue) {
    state.tasks[taskId] = "pending";
    const contractPath = path.join(ROOT, "docs", "contracts", `${taskId}.md`);
    if (existsSync(contractPath)) {
      await rm(contractPath, { force: true });
      deletedContracts.push(contractPath);
    }
  }

  state.current_sprint = args.sprint;
  state.current_wave = 1;
  state.current_state = "idle";
  state.last_updated = nowIso();
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  const previousTag = `sprint-${Math.max(0, args.sprint - 1)}-gate-pass`;
  // ASSUMPTION: rollback target is always previous sprint's gate-pass tag (or sprint-0-gate-pass for sprint 1 recoveries).
  const resetCode = await runGit(["reset", "--hard", previousTag]);
  if (resetCode !== 0) {
    throw new Error(`git reset --hard ${previousTag} failed`);
  }

  await appendAudit({
    ts: nowIso(),
    event: "rollback",
    sprint: args.sprint,
    task: args.requeue.join(","),
    agent: "codex",
    detail: `Recovered using ${previousTag}; deleted_contracts=${deletedContracts.length}; gate_failure=${gateFailureBody.slice(0, 240)}`,
  });

  console.log(`Recovery complete for sprint ${args.sprint}.`);
  console.log(`Requeued tasks: ${args.requeue.join(", ")}`);
  console.log(`Deleted contracts: ${deletedContracts.length === 0 ? "none" : deletedContracts.join(", ")}`);
  console.log(`Reset target: ${previousTag}`);
  console.log("Ready to re-dispatch with: npx ts-node scripts/orchestrate.ts");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`recover.ts failed: ${message}`);
  process.exit(1);
});
