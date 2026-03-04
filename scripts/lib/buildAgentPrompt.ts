import type { Agent, Task } from "./types";

const ROLE_TEXT: Record<Agent, string> = {
  opencode:
    "You are OpenCode (backend/API/DB). You must not touch frontend UX or unrelated client-visible API contracts.",
  claudecode:
    "You are ClaudeCode (frontend/auth/UX). You must not touch API route implementations, Prisma schema, or token storage internals.",
  gemini:
    "You are Gemini (QA/tests/infra). You must not touch production source logic outside explicitly listed test/workflow scope.",
  codex:
    "You are Codex (master orchestrator implementation tasks). You must not deploy to production or rotate secrets.",
};

function normalizePromptPath(value: string): string {
  return value.trim().replace(/^\//, "");
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return "- (none)";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildAgentPrompt(task: Task): string {
  const criteria = task.acceptance_criteria.map((criterion) => criterion.trim()).filter(Boolean);
  const targetFiles = task.files.map((file) => normalizePromptPath(file)).filter(Boolean);
  const dependencies = task.depends_on_contracts
    .map((taskId) => normalizePromptPath(`/docs/contracts/${taskId}.md`))
    .filter(Boolean);
  const normalizedContractPath = normalizePromptPath(task.contract_path);

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
    ROLE_TEXT[task.agent],
    "",
    "ACCEPTANCE CRITERIA:",
    formatList(criteria),
    "",
    "TARGET FILES:",
    formatList(targetFiles),
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
