export type CodeRabbitSeverity = "none" | "low" | "medium" | "high" | "critical";

export const BLOCKED_TEMPLATE = [
  "The latest CodeRabbit review for PR #{{pr}} found blocking issues.",
  "",
  "{{feedback}}",
  "",
  "Review state is saved in `monitoring/coderabbit-{{pr}}.yaml`.",
].join("\n");

function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraph(body: string): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return "";
  }

  return stripMarkdown(paragraphs[0] ?? "");
}

function extractSuggestions(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("> [!"));
}

function hasIssuesSectionActions(body: string): boolean {
  const lines = body.split(/\r?\n/);
  let inIssues = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+issues\b/i.test(line)) {
      inIssues = true;
      continue;
    }

    if (inIssues && /^##\s+/.test(line)) {
      break;
    }

    if (inIssues && /^(?:-|\*|\d+\.|>\s*\[!)/.test(line)) {
      return true;
    }
  }

  return false;
}

function detectHighestSeverity(body: string): CodeRabbitSeverity {
  if (/\bseverity\s*:\s*critical\b/i.test(body) || /\bcritical\b/i.test(body)) {
    return "critical";
  }

  if (/\bseverity\s*:\s*high\b/i.test(body) || /\bhigh\b/i.test(body)) {
    return "high";
  }

  if (/\bseverity\s*:\s*medium\b/i.test(body) || /\bmedium\b/i.test(body)) {
    return "medium";
  }

  if (/\bseverity\s*:\s*low\b/i.test(body) || /\blow\b/i.test(body)) {
    return "low";
  }

  return "none";
}

export function parseCodeRabbitReview(body: string): {
  hasBlockers: boolean;
  severity: CodeRabbitSeverity;
  suggestions: string[];
  summary: string;
  raw: string;
} {
  const raw = typeof body === "string" ? body : "";
  const suggestions = extractSuggestions(raw);
  const severity = detectHighestSeverity(raw);
  const hasEmergency = raw.includes("🚨");
  const hasIssuesActions = hasIssuesSectionActions(raw);

  return {
    hasBlockers:
      hasEmergency ||
      hasIssuesActions ||
      severity === "critical" ||
      severity === "high",
    severity,
    suggestions,
    summary: firstParagraph(raw),
    raw,
  };
}
