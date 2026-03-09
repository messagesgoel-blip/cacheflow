import fs from 'fs';
import path from 'path';
import { CodeRabbitReviewSignal } from './parseReview';

/**
 * Writes CodeRabbit review state to a persistent log/state file for orchestrator use.
 */
export async function writeReviewState(prNumber: number, signal: CodeRabbitReviewSignal) {
  const statePath = path.join(process.cwd(), 'logs', `pr-${prNumber}-review-state.json`);
  
  const state = {
    prNumber,
    ...signal,
    updatedAt: new Date().toISOString()
  };

  if (!fs.existsSync(path.dirname(statePath))) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
  }

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`CodeRabbit state written for PR #${prNumber}`);
}
