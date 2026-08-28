import path from 'node:path';
import { writeHarnessSnapshot } from '../core/snapshot.js';

export async function runSnapshot(rootInput, json = false) {
  const root = path.resolve(rootInput);
  const { target, snapshot } = await writeHarnessSnapshot(root);
  if (json) return `${JSON.stringify(snapshot, null, 2)}\n`;
  return [
    'Harness snapshot created.',
    `Lock: ${path.relative(root, target)}`,
    `Harness files: ${snapshot.files.length}`,
    `Verification scripts: ${snapshot.verification.names.length}`,
    'Raw file contents stored: no',
  ].join('\n');
}
