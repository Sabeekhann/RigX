import path from 'node:path';
import { compareHarnessSnapshot } from '../core/snapshot.js';

export async function runStatus(rootInput, json = false) {
  const root = path.resolve(rootInput);
  const result = await compareHarnessSnapshot(root);
  if (json) return `${JSON.stringify(result, null, 2)}\n`;
  if (!result.hasBaseline) {
    return 'No harness baseline exists. Run `rigx snapshot .` first.';
  }
  if (result.clean) {
    return [
      'RIGX Status',
      '────────────────────────────────────────',
      'Harness drift: none',
      `Baseline: ${result.baselineCreatedAt}`,
    ].join('\n');
  }

  const lines = [
    'RIGX Status',
    '────────────────────────────────────────',
    'Harness drift: detected',
    `Baseline: ${result.baselineCreatedAt}`,
  ];
  for (const value of result.added) lines.push(`  + ${value}`);
  for (const value of result.removed) lines.push(`  - ${value}`);
  for (const value of result.changed) lines.push(`  ~ ${value}`);
  if (result.verificationChanged) lines.push('  ~ package verification scripts');
  return lines.join('\n');
}
