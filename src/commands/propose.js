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

// A missing index (never ran `rigx index`) is the expected, silent case --
// readSessionIndex already returns an empty index for that (ENOENT). Any
// other failure (an unsupported/corrupted index) is a real problem the user
// should see, not a silent "no recurrence findings" fallback -- so it is
// surfaced as a warning rather than thrown, since propose's repository-scan
// proposals should still work even when the optional session index can't be
// read.
async function loadRecurrenceFindings(root) {
  try {
    const index = await readSessionIndex(root);
    return { findings: analyzeRecurrence(index.sessions).findings, warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { findings: [], warning: `Could not read the session index: ${message}` };
  }
}

export async function runPropose(rootInput, json = false) {
  const root = path.resolve(rootInput);
  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const { findings: recurrenceFindings, warning: recurrenceWarning } = await loadRecurrenceFindings(root);
  const result = await generateProposals(root, inventory, findings, recurrenceFindings);

  if (json) return `${JSON.stringify({ ...result, recurrenceWarning }, null, 2)}\n`;

  const header = [
    'RIGX Proposals',
    '────────────────────────────────────────',
    `Repository: ${path.basename(root)}`,
    `Proposals: ${result.proposals.length}`,
    '',
    'These are reviewable suggestions only. RIGX does not apply any of them automatically.',
  ];
  if (recurrenceWarning) header.push('', `WARNING: ${recurrenceWarning}`);

  if (result.proposals.length === 0) {
    return `${header.join('\n')}\n\nNo deterministic findings currently map to a reviewable proposal.`;
  }

  return [...header, '', result.proposals.map(renderProposal).join('\n\n')].join('\n');
}
