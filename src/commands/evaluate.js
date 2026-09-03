import path from 'node:path';
import { compareRefs } from '../core/evaluation.js';

function renderScriptResult(item) {
  const label = item.outcome === 'success' ? 'PASS' : 'FAIL';
  return `    ${label} ${item.script} (${item.durationMs}ms)`;
}

function renderSide(label, side) {
  const lines = [`${label}: ${side.ref} (${side.commit.slice(0, 12)})`];
  if (side.scripts.length === 0) lines.push('    (no test/lint/typecheck scripts found to run)');
  else lines.push(...side.scripts.map(renderScriptResult));
  return lines.join('\n');
}

export async function runEvaluate(rootInput, baselineRef, candidateRef, json = false) {
  const root = path.resolve(rootInput);
  const result = await compareRefs(root, baselineRef, candidateRef);

  if (json) return `${JSON.stringify(result, null, 2)}\n`;

  const lines = [
    'RIGX Evaluate',
    '────────────────────────────────────────',
    renderSide('Baseline', result.baseline),
    '',
    renderSide('Candidate', result.candidate),
    '',
  ];

  if (result.regressions.length === 0) {
    lines.push('No regressions detected.');
  } else {
    lines.push(`Regressions (${result.regressions.length})`);
    for (const item of result.regressions) {
      lines.push(`  ✖ ${item.script}: passed on baseline, failed on candidate`);
    }
  }

  return lines.join('\n');
}
