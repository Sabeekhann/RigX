import path from 'node:path';
import { normalizeEventInput } from './event-input.js';
import { writeSessionIndex } from '../core/session-index.js';

export async function runIndex({ root = '.', agent, input = '-', json = false } = {}) {
  const resolvedRoot = path.resolve(root);
  const events = await normalizeEventInput({ agent, input });
  const result = await writeSessionIndex(resolvedRoot, events);
  const output = {
    path: path.relative(resolvedRoot, result.file),
    indexedEvents: events.length,
    indexedSessions: result.indexedSessions,
    totalSessions: result.totalSessions,
    privacy: result.index.privacy,
  };

  if (json) return JSON.stringify(output, null, 2);
  return [
    'RIGX Session Index',
    '────────────────────────────────────────',
    `Index: ${output.path}`,
    `Indexed events: ${output.indexedEvents}`,
    `Indexed sessions: ${output.indexedSessions}`,
    `Total sessions: ${output.totalSessions}`,
    'Privacy mode: strict metadata only',
  ].join('\n');
}
