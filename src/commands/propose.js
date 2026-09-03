import path from 'node:path';
import { analyzeRepository, inventoryRepository } from '../core/scanner.js';
import { generateProposals } from '../core/proposals.js';
import { readSessionIndex } from '../core/session-index.js';
import { analyzeRecurrence } from '../core/recurrence.js';

function renderProposal(item, index) {
  return [
    `${index + 1}. [${item.category}] ${item.title}`,
    `   Based on: ${item.rationale}`,
    ...item.suggestion.split('\n').map((line) => `   ${line}`),
  ].join('\n');
}

async function loadRecurrenceFindings(root) {
  try {
    const index = await readSessionIndex(root);
    return analyzeRecurrence(index.sessions).findings;
  } catch {
    return [];
  }
}

export async function runPropose(rootInput, json = false) {
  const root = path.resolve(rootInput);
  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const recurrenceFindings = await loadRecurrenceFindings(root);
  const result = await generateProposals(root, inventory, findings, recurrenceFindings);

  if (json) return `${JSON.stringify(result, null, 2)}\n`;

  const header = [
    'RIGX Proposals',
    '────────────────────────────────────────',
    `Repository: ${path.basename(root)}`,
    `Proposals: ${result.proposals.length}`,
    '',
    'These are reviewable suggestions only. RIGX does not apply any of them automatically.',
  ].join('\n');

  if (result.proposals.length === 0) {
    return `${header}\n\nNo deterministic findings currently map to a reviewable proposal.`;
  }

  return [header, '', result.proposals.map(renderProposal).join('\n\n')].join('\n');
}
