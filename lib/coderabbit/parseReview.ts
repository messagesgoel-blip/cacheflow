/**
 * CodeRabbit Review Parser
 * 
 * Extracts structured signal from CodeRabbit review comments/payloads.
 */

export interface CodeRabbitReviewSignal {
  hasBlockers: boolean;
  actionableCount: number;
  summary?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function parseReview(payload: any): CodeRabbitReviewSignal {
  // Simple heuristic parsing for CodeRabbit payloads
  const body = payload.comment?.body || payload.review?.body || '';
  
  const hasBlockers = /🚨|blocking|critical issue|high severity/i.test(body);
  const actionableMatch = body.match(/actionable comments posted: (\d+)/i);
  const actionableCount = actionableMatch ? parseInt(actionableMatch[1], 10) : 0;
  
  let severity: CodeRabbitReviewSignal['severity'] = 'low';
  if (hasBlockers) severity = 'high';
  if (/critical/i.test(body)) severity = 'critical';
  if (actionableCount > 5) severity = 'medium';

  return {
    hasBlockers: hasBlockers || actionableCount > 0,
    actionableCount,
    severity,
    summary: body.slice(0, 200) + (body.length > 200 ? '...' : '')
  };
}
