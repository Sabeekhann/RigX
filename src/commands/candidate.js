import path from 'node:path';
import { evaluateCandidate } from '../core/candidate.js';
import { generateProposals } from '../core/proposals.js';
import { analyzeRecurrence } from '../core/recurrence.js';
import { analyzeRepository, inventoryRepository } from '../core/scanner.js';
import { readSessionIndex } from '../core/session-index.js';

async function loadRecurrenceFindings(root) {
  try {
    const index = await readSessionIndex(root);
    return analyzeRecurrence(index.sessions).findings;
  } catch {
    return [];
  }
}

async function findProposal(root, proposalId) {
  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const recurrenceFindings = await loadRecurrenceFindings(root);
  const { proposals } = await generateProposals(root, inventory, findings, recurrenceFindings);
  return proposals.find((item) => item.id === proposalId) ?? null;
}

function renderResult(result) {
  const lines = ['RIGX Candidate', '────────────────────────────────────────', `Proposal: ${result.proposalId}`];

  if (result.outcome === 'unsupported') {
    lines.push('', result.message);
    return lines.join('\n');
  }
  if (result.outcome === 'error') {
    lines.push('', `ERROR applying patch: ${result.message}`);
    return lines.join('\n');
  }

  lines.push(`Outcome: ${result.outcome.toUpperCase()}`);
  if (result.scripts.length > 0) {
    lines.push('', 'Verification:');
    for (const item of result.scripts) {
      const label = item.outcome === 'success' ? 'PASS' : 'FAIL';
      lines.push(`  ${label} ${item.script} (${item.durationMs}ms)`);
    }
  }
  if (result.note) lines.push('', result.note);

  return lines.join('\n');
}

// Verifies a single `rigx propose` suggestion inside a throwaway Git
// worktree of the repository's current HEAD -- never the caller's real
// working directory. See src/core/candidate.js and docs/candidates.md.
export async function runCandidate(rootInput, proposalId, json = false) {
  const root = path.resolve(rootInput);
  const proposal = await findProposal(root, proposalId);

  if (!proposal) {
    const message = `No proposal with id "${proposalId}" was found. Run \`rigx propose\` to see current proposal ids.`;
    if (json) return `${JSON.stringify({ error: message }, null, 2)}\n`;
    return message;
  }

  const result = await evaluateCandidate(root, 'HEAD', proposal);

  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  return renderResult(result);
}
