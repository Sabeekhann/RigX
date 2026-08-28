import { readFile } from 'node:fs/promises';
import { normalizeClaudeEvent } from '../adapters/claude-events.js';
import { normalizeCodexEvent } from '../adapters/codex-events.js';
import { parseNdjson } from '../core/ndjson.js';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))).toString('utf8');
}

function normalizer(agent) {
  if (agent === 'claude' || agent === 'claude-code') return normalizeClaudeEvent;
  if (agent === 'codex') return normalizeCodexEvent;
  throw new Error('observe requires --agent claude-code or --agent codex.');
}

export async function runObserve({ agent, input = '-', json = false } = {}) {
  const raw = input === '-' ? await readStdin() : await readFile(input, 'utf8');
  const normalize = normalizer(agent);
  const events = parseNdjson(raw).map(normalize).filter(Boolean);

  if (json) return JSON.stringify({ schemaVersion: 1, events }, null, 2);
  if (events.length === 0) return 'RIGX Observe\n────────────────────────────────────────\nNo supported events found.';
  return events.map((event) => JSON.stringify(event)).join('\n');
}
