import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInit } from '../src/commands/init.js';
import { runRecurrence } from '../src/commands/recurrence.js';
import { createObservation } from '../src/core/observation.js';
import { writeSessionIndex } from '../src/core/session-index.js';

async function indexedRepo(sessionsByAgent) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-recurrence-'));
  await runInit(root);
  for (const [agent, sessionId, toolFailures] of sessionsByAgent) {
    const events = [createObservation({ agent, kind: 'tool.start', sessionId, toolName: 'Bash' })];
    for (let i = 0; i < toolFailures; i += 1) {
      events.push(createObservation({ agent, kind: 'tool.end', sessionId, toolName: 'Bash', outcome: 'failure' }));
    }
    await writeSessionIndex(root, events);
  }
  return root;
}

test('recurrence reports no indexed sessions before rigx index has run', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-recurrence-empty-'));
  await runInit(root);
  const output = await runRecurrence(root, false);
  assert.match(output, /rigx index/);
});

test('recurrence surfaces cross-session recurrence findings and a per-agent comparison', async () => {
  const root = await indexedRepo([
    ['claude-code', 'session-a', 1],
    ['claude-code', 'session-b', 1],
    ['claude-code', 'session-c', 1],
    ['codex', 'session-d', 0],
  ]);

  const output = JSON.parse(await runRecurrence(root, true));
  assert.ok(output.findings.some((item) => item.code === 'recurring-tool-failures'));
  assert.equal(output.agents['claude-code'].sessions, 3);
  assert.equal(output.agents.codex.sessions, 1);
});

test('recurrence renders findings and the per-agent comparison as text', async () => {
  const root = await indexedRepo([
    ['claude-code', 'session-a', 1],
    ['claude-code', 'session-b', 1],
    ['claude-code', 'session-c', 1],
    ['codex', 'session-d', 0],
  ]);

  const output = await runRecurrence(root, false);
  assert.match(output, /RIGX Recurrence/);
  assert.match(output, /WARNING recurring-tool-failures \(confidence: low\)/);
  assert.match(output, /Recommendation:/);
  assert.match(output, /Per-agent comparison/);
  assert.match(output, /claude-code: sessions=3/);
  assert.match(output, /codex: sessions=1/);
});
