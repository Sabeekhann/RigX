import { readFile } from 'node:fs/promises';
import { normalizeClaudeEvent } from '../adapters/claude-events.js';
import { normalizeCodexEvent } from '../adapters/codex-events.js';
import { parseNdjson } from '../core/ndjson.js';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))).toString('utf8');
}

export function eventNormalizer(agent) {
  if (agent === 'claude' || agent === 'claude-code') return normalizeClaudeEvent;
  if (agent === 'codex') return normalizeCodexEvent;
  throw new Error('event input requires --agent claude-code or --agent codex.');
}

export async function normalizeEventInput({ agent, input = '-' } = {}) {
  const raw = input === '-' ? await readStdin() : await readFile(input, 'utf8');
  const normalize = eventNormalizer(agent);
  return parseNdjson(raw).map(normalize).filter(Boolean);
}
