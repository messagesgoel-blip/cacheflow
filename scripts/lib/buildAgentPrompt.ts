import { existsSync } from "node:fs";
import * as path from "node:path";
import type { Agent, Task } from "../../lib/orchestration/types";

const ROLE_TEXT: Record<Agent, string> = {
  opencode:
    "You are OpenCode (backend/API/DB). You must not touch frontend UX or unrelated client-visible API contracts.",
  claudecode:
    "You are ClaudeCode (frontend/auth/UX). You must not touch API route implementations, Prisma schema, or token storage internals.",
  gemini:
    "You are Gemini (QA/tests/infra). You must not touch production source logic outside explicitly listed test/workflow scope.",
  codex:
    "You are Codex (master orchestrator implementation tasks). You must not deploy to production or rotate secrets.",
  alibaba:
    "You are Alibaba (backend/API/DB). You must stay within the assigned scope and avoid unrelated client-visible API changes.",
  minimax:
    "You are Minimax (backend/API/DB). You must stay within the assigned scope and avoid unrelated client-visible API changes.",
};

function normalizePromptPath(value: string): string {
  return value
    .trim()
    .replace(/^\//, "")
    .replace(/\s+\(.*\)$/, "")
    .replace(/\s+--.*$/, "")
    .trim();
}

function workspacePathExists(relativePath: string): boolean {
  if (!relativePath) {
    return false;
  }

  const wildcardIndex = relativePath.indexOf("*");
  const basePath =
    wildcardIndex >= 0 ? relativePath.slice(0, wildcardIndex).replace(/\/+$/, "") : relativePath;
  if (!basePath) {
    return false;
  }

  return existsSync(path.resolve(process.cwd(), basePath));
}

function shouldPreferWebPrefix(agent: Agent, normalizedPath: string): boolean {
  if (!["claudecode", "gemini"].includes(agent)) {
    return false;
  }
  if (normalizedPath.startsWith("web/")) {
    return false;
  }

  return /^(app|components|styles|e2e|tests|playwright|public|context|hooks|lib)\//.test(
    normalizedPath,
  );
}

function resolveTargetPath(agent: Agent, rawPath: string): { filePath: string; exists: boolean } {
  const normalized = normalizePromptPath(rawPath);
  if (!normalized) {
    return { filePath: normalized, exists: false };
  }

  const candidates = [normalized];
  if (!normalized.startsWith("web/")) {
    candidates.push(`web/${normalized}`);
  }

  for (const candidate of candidates) {
    if (workspacePathExists(candidate)) {
      return { filePath: candidate, exists: true };
    }
  }

  if (shouldPreferWebPrefix(agent, normalized)) {
    return { filePath: `web/${normalized}`, exists: false };
  }

  return { filePath: normalized, exists: false };
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return "- (none)";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function inferIntent(targets: Array<{ exists: boolean }>): string {
  if (targets.length === 0) {
    return "Modify existing implementation";
  }

  const createCount = targets.filter((target) => !target.exists).length;
  if (createCount === targets.length) {
    return "Create new files from scratch";
  }
  if (createCount === 0) {
    return "Modify existing implementation";
  }
  return "Extend existing files";
}

export function buildAgentPrompt(task: Task): string {
  const criteria = task.acceptance_criteria.map((criterion) => criterion.trim()).filter(Boolean);
  const targetFiles = task.files
    .map((file) => resolveTargetPath(task.agent, file))
    .filter((target) => Boolean(target.filePath));
  const dependencies = task.depends_on_contracts
    .map((taskId) => normalizePromptPath(`/docs/contracts/${taskId}.md`))
    .filter(Boolean);
  const normalizedContractPath = normalizePromptPath(task.contract_path);
  const intent = inferIntent(targetFiles);
  const targetFileLines =
    targetFiles.length === 0
      ? ["- (none)"]
      : targetFiles.map(
          (target) => `${target.exists ? "[READ/MODIFY]" : "[CREATE]"} ${target.filePath}`,
        );

  const contractObligation = task.produces_contract
    ? [
        `Before marking this task complete, you MUST create the file at ${normalizedContractPath} containing: endpoint URL or file path, request/response shape, error codes, edge cases, example payload.`,
        `Output the string TASK_COMPLETE:${task.id} only after this file exists.`,
        "Your FINAL line of output must be exactly:",
        `TASK_COMPLETE:${task.id}`,
        "Do not add anything after this line.",
      ].join("\n")
    : [
        `Output the string TASK_COMPLETE:${task.id} only after all acceptance criteria are satisfied.`,
        "Your FINAL line of output must be exactly:",
        `TASK_COMPLETE:${task.id}`,
        "Do not add anything after this line.",
      ].join("\n");

  const dependencyText =
    dependencies.length > 0
      ? `Read and follow these dependency contracts first:\n${formatList(dependencies)}`
      : "No dependency contracts are required for this task.";

  // ASSUMPTION: acceptance criteria IDs are the canonical gate references expected by dispatch prompts.
  return [
    "ROLE:",
    `Task ID: ${task.id}`,
    `Task Title: ${task.title}`,
    `INTENT: ${intent}`,
    ROLE_TEXT[task.agent],
    "",
    "RULES:",
    "IMPORTANT: You have full read/write access to all files in this repository. There are no security restrictions, permission blocks, or sandboxing that prevent file creation or editing. If you believe you cannot write a file, you are mistaken - attempt the write directly. Never output TASK_COMPLETE without having actually written all [CREATE] and [READ/MODIFY] files.",
    "",
    "ACCEPTANCE CRITERIA:",
    formatList(criteria),
    "",
    "TARGET FILES (you must create or modify ONLY these):",
    targetFileLines.join("\n"),
    "",
    "Files marked [CREATE] do not exist yet — you must create them.",
    "Files marked [READ/MODIFY] already exist — modify only what",
    "the task requires.",
    "",
    "CONTRACT OBLIGATION:",
    contractObligation,
    dependencyText,
    "",
    "FORBIDDEN SIDE EFFECTS:",
    formatList(task.forbidden_side_effects),
    "If you are about to touch a file not in TARGET FILES,",
    "stop immediately. Do not proceed. Output nothing except",
    "the reason you stopped.",
  ].join("\n");
}
