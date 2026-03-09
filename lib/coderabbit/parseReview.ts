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

export function parseCodeRabbitReview(body: string): {
  hasBlockers: boolean;
  suggestions: string[];
  summary: string;
  raw: string;
} {
  const raw = body ?? "";
  const suggestions = extractSuggestions(raw);
  const hasHighSeverity = /\bseverity\s*:\s*high\b/i.test(raw);
  const hasEmergency = raw.includes("🚨");
  const hasIssuesActions = hasIssuesSectionActions(raw);

  return {
    hasBlockers: hasEmergency || hasIssuesActions || hasHighSeverity,
    suggestions,
    summary: firstParagraph(raw),
    raw,
  };
}
