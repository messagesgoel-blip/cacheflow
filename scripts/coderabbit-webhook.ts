/**
 * CodeRabbit Webhook Handler (CLI entry point)
 * 
 * Invoked when CodeRabbit signals a review completion via webhook.
 * Parses the signal and writes state for the orchestrator.
 */

import { parseReview } from '../lib/coderabbit/parseReview';
import { writeReviewState } from '../lib/coderabbit/writeReviewState';

async function main() {
  const payloadStr = process.env.WEBHOOK_PAYLOAD;
  if (!payloadStr) {
    console.error('WEBHOOK_PAYLOAD not set');
    process.exit(1);
  }

  const prNumberStr = process.env.PR_NUMBER;
  if (!prNumberStr) {
    console.error('PR_NUMBER not set');
    process.exit(1);
  }

  try {
    const payload = JSON.parse(payloadStr);
    const prNumber = parseInt(prNumberStr, 10);
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      throw new Error(`Invalid PR_NUMBER: ${prNumberStr}`);
    }
    const signal = parseReview(payload);
    
    await writeReviewState(prNumber, signal);
    
    if (signal.hasBlockers) {
      console.log('CodeRabbit: Blocking issues found.');
    } else {
      console.log('CodeRabbit: Review clean.');
    }
  } catch (err) {
    console.error('Failed to handle CodeRabbit webhook:', err);
    process.exit(1);
  }
}

main();
