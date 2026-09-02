import path from 'node:path';
import { readSessionIndex } from '../core/session-index.js';
import { analyzeRecurrence, compareAgents } from '../core/recurrence.js';

function renderFinding(item) {
  const label = item.severity.toUpperCase().padEnd(7);
  const evidence = Object.entries(item.evidence)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return `${label} ${item.code} (confidence: ${item.confidence})\n${item.title}\nEvidence: ${evidence}\nRecommendation: ${item.recommendation}`;
}

function renderAgentComparison(agents) {
  const names = Object.keys(agents);
  if (names.length === 0) return 'No indexed sessions to compare.';
  return names
    .map((name) => {
      const stats = agents[name];
      return `${name}: sessions=${stats.sessions}, searchHeavyRate=${stats.searchHeavyRate}, toolFailureRate=${stats.toolFailureRate}, verificationSkipRate=${stats.verificationSkipRate}`;
    })
    .join('\n');
}

export async function runRecurrence(rootInput, json = false) {
  const root = path.resolve(rootInput);
  const index = await readSessionIndex(root);

  if (index.sessions.length === 0) {
    return json
      ? JSON.stringify({ analyzedSessions: 0, findings: [], agents: {} }, null, 2)
      : 'No indexed sessions found. Run `rigx index` first.';
  }

  const recurrence = analyzeRecurrence(index.sessions);
  const comparison = compareAgents(index.sessions);

  if (json) {
    return JSON.stringify({ ...recurrence, agents: comparison.agents }, null, 2);
  }

  const header = [
    'RIGX Recurrence',
    '────────────────────────────────────────',
    `Indexed sessions: ${recurrence.analyzedSessions}`,
    `Findings: ${recurrence.findings.length}`,
  ].join('\n');

  const findingsSection = recurrence.findings.length === 0
    ? 'No deterministic cross-session patterns crossed the current thresholds.'
    : recurrence.findings.map(renderFinding).join('\n\n');

  const agentSection = [
    'Per-agent comparison',
    '────────────────────────────────────────',
    renderAgentComparison(comparison.agents),
  ].join('\n');

  return [header, '', findingsSection, '', agentSection].join('\n');
}
