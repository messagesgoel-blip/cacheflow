const path = require('path');

const SUPPORTED_MERGE_TYPES = {
  '.txt': 'text',
  '.md':  'text',
  '.docx': 'text',
  '.py':  'code',
  '.js':  'code',
  '.ts':  'code',
  '.tsx': 'code',
  '.csv': 'csv',
  '.json': 'json',
};

const SYSTEM_PROMPTS = {
  text: `You are an expert at merging conflicting document versions.
Produce a single clean merged version that preserves the best content from both.
If sections are irreconcilable, keep both with a clear separator.
Return ONLY the merged content, no explanation.`,

  code: `You are an expert software engineer resolving a file merge conflict.
Produce a clean three-way merge that preserves intent from both versions.
For any truly unresolvable conflict, insert a marker:
<<<< CONFLICT: [brief description] >>>>
Return ONLY the merged code, no explanation, no markdown fences.`,

  csv: `You are merging two CSV files.
Deduplicate rows that are identical. Where rows differ for the same apparent key,
keep both rows and add a CONFLICT column with value 'CONFLICT'.
Return ONLY the merged CSV content.`,

  json: `You are merging two JSON objects/arrays.
For object keys present in both, prefer the version with the more recent data.
For arrays, merge and deduplicate.
Mark any unresolvable key conflicts with a "_conflict" suffix key.
Return ONLY valid JSON, no explanation.`,
};

async function performAiMerge(localContent, remoteContent, fileExt, model = 'claude-opus-4-5-20250101') {
  const mergeType = SUPPORTED_MERGE_TYPES[fileExt.toLowerCase()];
  if (!mergeType) {
    throw new Error(`Unsupported file type for AI merge: ${fileExt}`);
  }

  const systemPrompt = SYSTEM_PROMPTS[mergeType];
  const userMessage = `VERSION A (local):\n\n${localContent}\n\n---\n\nVERSION B (remote):\n\n${remoteContent}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const mergedContent = data.content?.[0]?.text;
  if (!mergedContent) throw new Error('Anthropic returned empty merge result');

  // ZERO-RETENTION: content is returned to caller only — never written to DB
  return { mergedContent, mergeType, model, inputTokens: data.usage?.input_tokens };
}

module.exports = { performAiMerge, SUPPORTED_MERGE_TYPES };

