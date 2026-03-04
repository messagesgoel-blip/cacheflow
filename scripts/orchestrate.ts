import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorState, Task, TaskManifest } from "./lib/types";
import { buildAgentPrompt } from "./lib/buildAgentPrompt";

const ROOT = path.resolve(process.cwd());
const LOG_DIR = path.join(ROOT, "logs");
const MANIFEST_PATH = path.join(ROOT, "docs", "orchestration", "task-manifest.json");
const STATE_PATH = path.join(LOG_DIR, "orchestrator-state.json");
const AUDIT_PATH = path.join(LOG_DIR, "codex-audit.jsonl");
const NOTIFICATIONS_PATH = path.join(LOG_DIR, "notifications.txt");
const CONFLICT_RESOLVED_FLAG = path.join(LOG_DIR, "conflict-resolved.flag");
const GATE_RESULTS_PATH = path.join(LOG_DIR, "gate-results.json");
const GATE_FAILURE_DIR = path.join(LOG_DIR, "gate-failures");
const TASK_LOG_DIR = path.join(LOG_DIR, "tasks");

const WAVE2_TIMEOUT_MS = 45 * 60 * 1000;
const WAVE1_CONTRACT_TIMEOUT_MS = 45 * 60 * 1000; // ASSUMPTION: contract generation timeout matches wave2 task timeout.
const CONTRACT_POLL_MS = 30 * 1000;

interface AuditEvent {
  ts: string;
  event: string;
  sprint: number;
  task: string;
  agent: string;
  detail: string;
  attempt?: number;
  reason?: string;
}

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

interface ProcessOptions {
  logPath?: string;
  appendLog?: boolean;
}

type TaskFailureReason = "timeout" | "non_zero_exit" | "task_no_complete_signal_after_retry";

interface TaskRunResult {
  ok: boolean;
  reason?: TaskFailureReason;
  result: ProcessResult;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function naturalSort(values: string[]): string[] {
  return [...values].sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function normalizeRepoPath(input: string): string {
  const trimmed = input.trim();
  const noLeading = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  return noLeading.replace(/\\/g, "/");
}

function looksLikePathPattern(input: string): boolean {
  const value = input.trim();
  return value.startsWith("/") || value.includes("/") || value.includes("*") || value.endsWith("/");
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const wildcard = escaped.replace(/\\\*\\\*/g, ".*").replace(/\\\*/g, "[^/]*");
  return new RegExp(`^${wildcard}$`);
}

function pathMatchesPattern(repoPath: string, target: string): boolean {
  const normalizedPath = normalizeRepoPath(repoPath);
  const normalizedTarget = normalizeRepoPath(target.replace(/\s+\(.*\)$/, "").replace(/\s+--.*$/, ""));
  if (!looksLikePathPattern(normalizedTarget)) {
    return false;
  }

  if (normalizedTarget.endsWith("/**")) {
    const prefix = normalizedTarget.slice(0, -3);
    return normalizedPath.startsWith(prefix);
  }

  if (normalizedTarget.endsWith("/")) {
    return normalizedPath.startsWith(normalizedTarget);
  }

  if (!normalizedTarget.includes("*")) {
    return normalizedPath === normalizedTarget || normalizedPath.startsWith(`${normalizedTarget}/`);
  }

  return patternToRegExp(normalizedTarget).test(normalizedPath);
}

async function ensureLogs(): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });
  await mkdir(GATE_FAILURE_DIR, { recursive: true });
  await mkdir(TASK_LOG_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function appendAudit(event: AuditEvent): Promise<void> {
  await appendFile(AUDIT_PATH, `${JSON.stringify(event)}\n`, "utf8");
}

async function notify(message: string): Promise<void> {
  const tsLine = `[${nowIso()}] ${message}`;
  const webhook = process.env.SLACK_WEBHOOK_URL;

  if (!webhook) {
    await appendFile(NOTIFICATIONS_PATH, `${tsLine}\n`, "utf8");
    return;
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      await appendFile(
        NOTIFICATIONS_PATH,
        `${tsLine} | slack_error=${response.status} ${response.statusText}\n`,
        "utf8",
      );
    }
  } catch (error) {
    await appendFile(NOTIFICATIONS_PATH, `${tsLine} | slack_exception=${String(error)}\n`, "utf8");
  }
}

function buildInitialState(manifest: TaskManifest): OrchestratorState {
  const tasks: Record<string, "pending" | "running" | "done" | "failed"> = {};
  for (const task of manifest.tasks) {
    tasks[task.id] = "pending";
  }

  const lowestSprint = Math.min(...manifest.tasks.map((task) => task.sprint));
  return {
    current_sprint: Number.isFinite(lowestSprint) ? lowestSprint : 0,
    current_wave: 0,
    current_state: "idle",
    tasks,
    last_updated: nowIso(),
  };
}

async function loadState(manifest: TaskManifest): Promise<OrchestratorState> {
  if (!existsSync(STATE_PATH)) {
    const initialState = buildInitialState(manifest);
    await writeState(initialState);
    return initialState;
  }

  const loaded = await readJsonFile<OrchestratorState>(STATE_PATH);
  for (const task of manifest.tasks) {
    if (!loaded.tasks[task.id]) {
      loaded.tasks[task.id] = "pending";
    }
  }

  loaded.last_updated = nowIso();
  await writeState(loaded);
  return loaded;
}

async function writeState(state: OrchestratorState): Promise<void> {
  const next: OrchestratorState = {
    ...state,
    last_updated: nowIso(),
  };
  await writeFile(STATE_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function getTasksForSprint(manifest: TaskManifest, sprint: number): Task[] {
  return manifest.tasks.filter((task) => task.sprint === sprint);
}

function findLowestIncompleteSprint(manifest: TaskManifest, state: OrchestratorState): number | null {
  const sprints = naturalSort([...new Set(manifest.tasks.map((task) => String(task.sprint)))]).map(Number);
  for (const sprint of sprints) {
    const sprintTasks = getTasksForSprint(manifest, sprint);
    if (sprintTasks.some((task) => state.tasks[task.id] !== "done")) {
      return sprint;
    }
  }
  return null;
}

async function runProcess(
  command: string,
  args: string[],
  timeoutMs: number,
  options?: ProcessOptions,
): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const logStream = options?.logPath
      ? createWriteStream(options.logPath, { flags: options.appendLog ? "a" : "w" })
      : null;

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const writeLog = (text: string): void => {
      if (logStream) {
        logStream.write(text);
      }
    };

    const finalizeLog = (exitCode: number): void => {
      if (!logStream) {
        return;
      }
      logStream.write(`\nEXIT_CODE: ${exitCode}\n`);
      logStream.end();
    };

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      writeLog(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      writeLog(text);
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
        }
      }, 5000).unref();
    }, timeoutMs);

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      const exitCode = code ?? 1;
      finalizeLog(exitCode);
      resolve({
        code: exitCode,
        stdout,
        stderr,
        timedOut,
      });
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      finalizeLog(1);
      resolve({
        code: 1,
        stdout,
        stderr: `${stderr}\n${String(error)}`,
        timedOut,
      });
    });
  });
}

function commandForTask(task: Task, prompt: string): { command: string; args: string[] } {
  switch (task.agent) {
    case "opencode":
      return { command: "opencode", args: ["run", prompt] };
    case "claudecode":
      return { command: "claude", args: ["--print", prompt] };
    case "gemini":
      return { command: "gemini", args: ["-p", prompt] };
    case "codex":
      // ASSUMPTION: codex CLI is available for codex-owned implementation tasks.
      return { command: "codex", args: ["exec", prompt] };
    default:
      return { command: "opencode", args: ["run", prompt] };
  }
}

function taskLogPath(sprint: number, taskId: string): string {
  const safeTaskId = taskId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(TASK_LOG_DIR, `${sprint}-${safeTaskId}.log`);
}

async function runTaskWithRetry(task: Task, sprint: number, wave: "wave1" | "wave2"): Promise<TaskRunResult> {
  const prompt = buildAgentPrompt(task);
  const { command, args } = commandForTask(task, prompt);
  const requiredMarker = `TASK_COMPLETE:${task.id}`;
  const logPath = taskLogPath(sprint, task.id);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (attempt === 2) {
      await appendAudit({
        ts: nowIso(),
        event: "retry",
        sprint,
        task: task.id,
        agent: task.agent,
        detail: `${wave} retry attempt 2`,
        attempt: 2,
      });
      await appendFile(logPath, "\n--- RETRY ATTEMPT 2 ---\n", "utf8");
    }

    await appendAudit({
      ts: nowIso(),
      event: "dispatch",
      sprint,
      task: task.id,
      agent: task.agent,
      detail: `${wave} command=${command}${attempt > 1 ? ` attempt=${attempt}` : ""}`,
    });

    const result = await runProcess(command, args, WAVE2_TIMEOUT_MS, {
      logPath,
      appendLog: attempt > 1,
    });

    if (result.timedOut) {
      return { ok: false, reason: "timeout", result };
    }

    if (result.code !== 0) {
      return { ok: false, reason: "non_zero_exit", result };
    }

    if (result.stdout.includes(requiredMarker) || result.stderr.includes(requiredMarker)) {
      return { ok: true, result };
    }

    if (attempt === 1) {
      await appendAudit({
        ts: nowIso(),
        event: "warning",
        sprint,
        task: task.id,
        agent: task.agent,
        detail: "task_no_complete_signal (attempt 1)",
      });
      continue;
    }
  }

  return {
    ok: false,
    reason: "task_no_complete_signal_after_retry",
    result: { code: 0, stdout: "", stderr: "", timedOut: false },
  };
}

async function ensureAgentClisAvailable(manifest: TaskManifest): Promise<void> {
  const needed = new Set<string>();
  for (const task of manifest.tasks) {
    if (task.agent === "opencode") needed.add("opencode");
    if (task.agent === "claudecode") needed.add("claude");
    if (task.agent === "gemini") needed.add("gemini");
    if (task.agent === "codex") needed.add("codex");
  }

  const missing: string[] = [];
  for (const command of needed) {
    const check = await runProcess("bash", ["-lc", `command -v ${command}`], 60_000);
    if (check.code !== 0) {
      missing.push(command);
    }
  }

  if (missing.length > 0) {
    await notify(`Missing required agent CLIs: ${missing.join(", ")}`);
    throw new Error(`Missing required agent CLIs: ${missing.join(", ")}`);
  }
}

function resolveContractPath(task: Task): string {
  const withoutLeading = task.contract_path.startsWith("/") ? task.contract_path.slice(1) : task.contract_path;
  return path.join(ROOT, withoutLeading);
}

async function pollForContract(task: Task): Promise<boolean> {
  const start = Date.now();
  const contractPath = resolveContractPath(task);
  while (Date.now() - start <= WAVE1_CONTRACT_TIMEOUT_MS) {
    if (existsSync(contractPath)) {
      return true;
    }
    await sleep(CONTRACT_POLL_MS);
  }
  return false;
}

async function readDirtyPaths(): Promise<string[]> {
  const result = await runProcess("git", ["status", "--porcelain"], 60_000);
  if (result.code !== 0) {
    return [];
  }

  const paths: string[] = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trimEnd();
    if (!trimmed) {
      continue;
    }
    const filePath = trimmed.slice(3).trim();
    if (filePath) {
      paths.push(normalizeRepoPath(filePath));
    }
  }
  return paths;
}

async function waitForConflictResolution(sprint: number, detail: string): Promise<void> {
  await notify(
    `Sprint ${sprint}: wave2 conflict detected. Waiting for ${path.basename(CONFLICT_RESOLVED_FLAG)}. ${detail}`,
  );
  while (true) {
    if (existsSync(CONFLICT_RESOLVED_FLAG)) {
      await rm(CONFLICT_RESOLVED_FLAG, { force: true });
      return;
    }
    await sleep(10_000);
  }
}

async function detectWave2Conflicts(tasks: Task[]): Promise<string[]> {
  const dirty = await readDirtyPaths();
  if (dirty.length === 0) {
    return [];
  }

  // ASSUMPTION: local git dirty paths are the safest proxy for unresolved cross-agent conflicts.
  const conflicts: string[] = [];
  for (const task of tasks) {
    const hits = task.files.filter((pattern) => dirty.some((p) => pathMatchesPattern(p, pattern)));
    if (hits.length > 0) {
      conflicts.push(`${task.id}: ${hits.join(", ")}`);
    }
  }
  return conflicts;
}

function parsePlaywrightFailures(report: unknown): { failedCount: number; details: string[] } {
  const details: string[] = [];

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
      return;
    }

    const record = node as Record<string, unknown>;
    const status = typeof record.status === "string" ? record.status : "";
    const title = typeof record.title === "string" ? record.title : "";

    if (status === "failed") {
      details.push(title || JSON.stringify(record));
    }

    for (const value of Object.values(record)) {
      visit(value);
    }
  };

  visit(report);
  return { failedCount: details.length, details };
}

async function runGate(sprint: number, criteria: string[]): Promise<{ pass: boolean; detail: string }> {
  await rm(GATE_RESULTS_PATH, { force: true });

  const gateCommand = `npx playwright test --reporter=json > "${GATE_RESULTS_PATH}"`;
  const result = await runProcess("bash", ["-lc", gateCommand], 90 * 60 * 1000);

  let reportData: unknown = {};
  if (existsSync(GATE_RESULTS_PATH)) {
    try {
      const raw = await readFile(GATE_RESULTS_PATH, "utf8");
      reportData = JSON.parse(raw);
    } catch {
      reportData = {};
    }
  }

  const parsed = parsePlaywrightFailures(reportData);
  const hasFailures = result.code !== 0 || parsed.failedCount > 0;
  const failedCriteria = new Set<string>();
  for (const failureTitle of parsed.details) {
    for (const criterion of criteria) {
      if (failureTitle.includes(criterion)) {
        failedCriteria.add(criterion);
      }
    }
  }

  const detail = hasFailures
    ? `Playwright failures=${parsed.failedCount}; failed_criteria=${[...failedCriteria].join(", ") || "unmapped"}; criteria=${criteria.join(", ")}; exit=${result.code}`
    : `All criteria passed: ${criteria.join(", ")}`;

  return {
    pass: !hasFailures,
    detail,
  };
}

async function writeGateFailure(sprint: number, detail: string): Promise<string> {
  const filePath = path.join(GATE_FAILURE_DIR, `sprint-${sprint}.md`);
  const content = [
    `# Sprint ${sprint} Gate Failure`,
    "",
    `- timestamp: ${nowIso()}`,
    `- detail: ${detail}`,
    "",
    "## Next Action",
    "Run recovery with requeue IDs, then restart orchestrator.",
  ].join("\n");
  await writeFile(filePath, `${content}\n`, "utf8");
  return filePath;
}

async function halt(reason: string, sprint: number, taskId: string): Promise<never> {
  const ts = nowIso().replace(/[:.]/g, "-");
  const haltPath = path.join(LOG_DIR, `halt-${ts}.md`);
  const body = [
    "# HALT",
    "",
    `- timestamp: ${nowIso()}`,
    `- sprint: ${sprint}`,
    `- task: ${taskId}`,
    `- reason: ${reason}`,
  ].join("\n");
  await writeFile(haltPath, `${body}\n`, "utf8");
  await appendAudit({
    ts: nowIso(),
    event: "gate_fail",
    sprint,
    task: taskId,
    agent: "codex",
    detail: `HALT: ${reason}`,
  });
  await notify(`HALT sprint=${sprint} task=${taskId} reason=${reason}`);
  throw new Error(reason);
}

async function dispatchWave1(
  manifest: TaskManifest,
  state: OrchestratorState,
  sprint: number,
): Promise<void> {
  state.current_wave = 1;
  state.current_state = "dispatching_wave1";
  await writeState(state);

  const tasks = getTasksForSprint(manifest, sprint)
    .filter((task) => task.wave === 1)
    .filter((task) => state.tasks[task.id] !== "done");

  for (const task of tasks) {
    state.tasks[task.id] = "running";
    state.current_state = "dispatching_wave1";
    await writeState(state);

    const outcome = await runTaskWithRetry(task, sprint, "wave1");
    if (!outcome.ok && outcome.reason === "timeout") {
      state.tasks[task.id] = "failed";
      await writeState(state);
      await appendAudit({
        ts: nowIso(),
        event: "task_timeout",
        sprint,
        task: task.id,
        agent: task.agent,
        detail: `timeout after ${WAVE2_TIMEOUT_MS}ms`,
      });
      await halt(`wave1 timeout: ${task.id}`, sprint, task.id);
    }

    if (!outcome.ok && outcome.reason === "non_zero_exit") {
      state.tasks[task.id] = "failed";
      await writeState(state);
      await halt(`wave1 task exited non-zero: ${task.id}`, sprint, task.id);
    }

    if (!outcome.ok && outcome.reason === "task_no_complete_signal_after_retry") {
      state.tasks[task.id] = "failed";
      await writeState(state);
      await appendAudit({
        ts: nowIso(),
        event: "halt",
        sprint,
        task: task.id,
        agent: "codex",
        detail: "task_no_complete_signal_after_retry",
        reason: "task_no_complete_signal_after_retry",
      });
      await halt("task_no_complete_signal_after_retry", sprint, task.id);
    }

    if (task.produces_contract) {
      state.current_state = "awaiting_contract";
      await writeState(state);
      const hasContract = await pollForContract(task);
      if (!hasContract) {
        state.tasks[task.id] = "failed";
        await writeState(state);
        await halt(`missing contract ${task.contract_path}`, sprint, task.id);
      }

      await appendAudit({
        ts: nowIso(),
        event: "contract_verified",
        sprint,
        task: task.id,
        agent: task.agent,
        detail: task.contract_path,
      });
    }

    state.tasks[task.id] = "done";
    await writeState(state);
  }
}

async function dispatchWave2(
  manifest: TaskManifest,
  state: OrchestratorState,
  sprint: number,
): Promise<void> {
  state.current_wave = 2;
  state.current_state = "dispatching_wave2";
  await writeState(state);

  const tasks = getTasksForSprint(manifest, sprint)
    .filter((task) => task.wave === 2)
    .filter((task) => state.tasks[task.id] !== "done");

  if (tasks.length === 0) {
    return;
  }

  const conflicts = await detectWave2Conflicts(tasks);
  if (conflicts.length > 0) {
    const detail = conflicts.join(" | ");
    await appendAudit({
      ts: nowIso(),
      event: "dispatch",
      sprint,
      task: "wave2",
      agent: "codex",
      detail: `conflict_detected: ${detail}`,
    });
    await waitForConflictResolution(sprint, detail);
  }

  state.current_state = "awaiting_wave2";
  for (const task of tasks) {
    state.tasks[task.id] = "running";
  }
  await writeState(state);

  const execution = tasks.map(async (task) => {
    const outcome = await runTaskWithRetry(task, sprint, "wave2");
    return { task, outcome };
  });

  const results = await Promise.all(execution);

  for (const { task, outcome } of results) {
    if (!outcome.ok && outcome.reason === "timeout") {
      state.tasks[task.id] = "failed";
      await writeState(state);
      await appendAudit({
        ts: nowIso(),
        event: "task_timeout",
        sprint,
        task: task.id,
        agent: task.agent,
        detail: `timeout after ${WAVE2_TIMEOUT_MS}ms`,
      });
      await halt(`wave2 timeout: ${task.id}`, sprint, task.id);
    }

    if (!outcome.ok && outcome.reason === "non_zero_exit") {
      state.tasks[task.id] = "failed";
      await writeState(state);
      await halt(`wave2 non-zero exit: ${task.id}`, sprint, task.id);
    }

    if (!outcome.ok && outcome.reason === "task_no_complete_signal_after_retry") {
      state.tasks[task.id] = "failed";
      await writeState(state);
      await appendAudit({
        ts: nowIso(),
        event: "halt",
        sprint,
        task: task.id,
        agent: "codex",
        detail: "task_no_complete_signal_after_retry",
        reason: "task_no_complete_signal_after_retry",
      });
      await halt("task_no_complete_signal_after_retry", sprint, task.id);
    }

    state.tasks[task.id] = "done";
    await writeState(state);
  }
}

async function runSprint(manifest: TaskManifest, state: OrchestratorState, sprint: number): Promise<void> {
  const sprintMeta = manifest.sprints[String(sprint)];
  const planLine = `Sprint ${sprint} · Wave 1: ${sprintMeta.wave1.join(", ")} → Wave 2: ${sprintMeta.wave2.join(", ")} → Gate: ${sprintMeta.gate_criteria.join(", ")}`;
  console.log(planLine);

  await appendAudit({
    ts: nowIso(),
    event: "dispatch",
    sprint,
    task: "plan",
    agent: "codex",
    detail: planLine,
  });

  await sleep(10_000);

  await dispatchWave1(manifest, state, sprint);
  await dispatchWave2(manifest, state, sprint);

  state.current_wave = 3;
  state.current_state = "running_gate";
  await writeState(state);

  const gate = await runGate(sprint, sprintMeta.gate_criteria);
  if (gate.pass) {
    const tag = `sprint-${sprint}-gate-pass`;
    const tagCheck = await runProcess("git", ["tag", "--list", tag], 60_000);
    if (!tagCheck.stdout.split(/\r?\n/).includes(tag)) {
      const tagResult = await runProcess("git", ["tag", tag], 60_000);
      if (tagResult.code !== 0) {
        await halt(`failed to create git tag ${tag}`, sprint, "gate");
      }
    }

    state.current_state = "gate_passed";
    state.current_wave = 0;
    state.current_sprint = sprint + 1;
    await writeState(state);

    await appendAudit({
      ts: nowIso(),
      event: "gate_pass",
      sprint,
      task: "gate",
      agent: "codex",
      detail: gate.detail,
    });
    return;
  }

  state.current_state = "gate_failed";
  state.current_wave = 0;
  await writeState(state);

  const failureFile = await writeGateFailure(sprint, gate.detail);
  await appendAudit({
    ts: nowIso(),
    event: "gate_fail",
    sprint,
    task: "gate",
    agent: "codex",
    detail: `${gate.detail}; failure_file=${failureFile}`,
  });

  await notify(`Gate failed for sprint ${sprint}. Details: ${gate.detail}. File: ${failureFile}`);
  await halt(`gate failed for sprint ${sprint}`, sprint, "gate");
}

async function main(): Promise<void> {
  await ensureLogs();

  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing manifest at ${MANIFEST_PATH}`);
  }

  const manifest = await readJsonFile<TaskManifest>(MANIFEST_PATH);
  await ensureAgentClisAvailable(manifest);
  const state = await loadState(manifest);
  const sprintLimitEnv = process.env.SPRINT_LIMIT;
  const sprintLimit = sprintLimitEnv === undefined ? null : Number(sprintLimitEnv);

  if (sprintLimitEnv !== undefined && !Number.isFinite(sprintLimit)) {
    throw new Error(`Invalid SPRINT_LIMIT: ${sprintLimitEnv}`);
  }

  while (true) {
    const sprint = findLowestIncompleteSprint(manifest, state);
    if (sprint === null) {
      state.current_state = "idle";
      state.current_wave = 0;
      await writeState(state);
      console.log("All manifest tasks are done.");
      break;
    }

    if (sprintLimit !== null && sprint > sprintLimit) {
      state.current_state = "idle";
      state.current_wave = 0;
      await writeState(state);
      console.log(`Sprint limit ${sprintLimit} reached. Stopping before sprint ${sprint}.`);
      break;
    }

    await runSprint(manifest, state, sprint);

    if (sprintLimit !== null && sprint >= sprintLimit) {
      state.current_state = "idle";
      state.current_wave = 0;
      await writeState(state);
      console.log(`Sprint ${sprint} gate passed. Sprint limit ${sprintLimit} reached; stopping.`);
      break;
    }
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await appendFile(NOTIFICATIONS_PATH, `[${nowIso()}] orchestrator_error: ${message}\n`, "utf8");
  console.error(message);
  process.exit(1);
});
