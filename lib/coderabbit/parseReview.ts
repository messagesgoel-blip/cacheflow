export type CodeRabbitSeverity = "none" | "low" | "medium" | "high" | "critical";

export interface CodeRabbitReviewSignal {
  hasBlockers: boolean;
  actionableCount: number;
  summary: string;
  severity: CodeRabbitSeverity;
  suggestions: string[];
  raw: string;
}

export const BLOCKED_TEMPLATE =
  "## CodeRabbit Review: BLOCKED\nThe following issues must be resolved before the gate can pass:\n{{feedback}}\nFix all items above. Re-push. Do not advance to the next task until coderabbit-{pr}.yaml shows hasBlockers: false.";

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
  if (/\bseverity\s*:\s*high\b/i.test(body) || body.includes("🚨")) {
    return "high";
  }
  if (/\bseverity\s*:\s*medium\b/i.test(body)) {
    return "medium";
  }
  if (/\bseverity\s*:\s*low\b/i.test(body)) {
    return "low";
  }
  return "none";
}

export function parseReview(payload: unknown): CodeRabbitReviewSignal {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const comment = record.comment && typeof record.comment === "object" ? (record.comment as Record<string, unknown>) : {};
  const review = record.review && typeof record.review === "object" ? (record.review as Record<string, unknown>) : {};
  const bodyCandidate = comment.body ?? review.body;
  const raw = typeof bodyCandidate === "string" ? bodyCandidate : "";
  const actionableMatch = raw.match(/actionable comments posted: (\d+)/i);
  const actionableCount = actionableMatch ? Number.parseInt(actionableMatch[1] ?? "0", 10) : 0;
  const severity = detectHighestSeverity(raw);
  const suggestions = extractSuggestions(raw);
  const hasBlockers = severity === "critical" || severity === "high" || actionableCount > 0 || hasIssuesSectionActions(raw);

  return {
    hasBlockers,
    actionableCount,
    summary: firstParagraph(raw),
    severity,
    suggestions,
    raw,
  };
}
