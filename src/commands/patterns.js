import { normalizeEventInput } from './event-input.js';
import { analyzePatterns } from '../core/patterns.js';

function renderFinding(item) {
  const label = item.severity.toUpperCase().padEnd(7);
  const evidence = Object.entries(item.evidence)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return `${label} ${item.code}\n${item.title}\nEvidence: ${evidence}\nRecommendation: ${item.recommendation}`;
}

export async function runPatterns({ agent, input = '-', json = false } = {}) {
  const events = await normalizeEventInput({ agent, input });
  const result = analyzePatterns(events);

  if (json) return JSON.stringify(result, null, 2);

  const header = [
    'RIGX Patterns',
    '────────────────────────────────────────',
    `Observed events: ${result.analyzedEvents}`,
    `Observed sessions: ${result.analyzedSessions}`,
    `Findings: ${result.findings.length}`,
  ].join('\n');

  if (result.findings.length === 0) return `${header}\n\nNo deterministic patterns crossed the current thresholds.`;
  return `${header}\n\n${result.findings.map(renderFinding).join('\n\n')}`;
}
