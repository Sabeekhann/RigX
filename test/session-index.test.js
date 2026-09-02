import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runIndex } from '../src/commands/index.js';
import { createObservation } from '../src/core/observation.js';
import { buildSessionSummaries, readSessionIndex, sessionIndexPath, writeSessionIndex } from '../src/core/session-index.js';
import { runInit } from '../src/commands/init.js';

const SECRET = 'private-session-index-marker-8c7a';

test('session summaries retain only bounded strict-mode metadata', () => {
  const events = [
    createObservation({ agent: 'codex', kind: 'session.start', sessionId: SECRET, timestamp: '2026-01-01T00:00:00Z' }),
    createObservation({ agent: 'codex', kind: 'tool.start', sessionId: SECRET, toolName: 'Bash', metadata: { command: SECRET } }),
    createObservation({ agent: 'codex', kind: 'tool.end', sessionId: SECRET, toolName: 'Bash', outcome: 'failure', metadata: { output: SECRET } }),
    createObservation({ agent: 'codex', kind: 'session.end', sessionId: SECRET, timestamp: '2026-01-01T00:01:00Z' }),
  ];
  const summaries = buildSessionSummaries(events);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].counts.toolStarts, 1);
  assert.equal(summaries[0].counts.toolFailures, 1);
  assert.equal(summaries[0].counts.toolStartsByCategory.shell, 1);
  assert.deepEqual(summaries[0].lifecycle, { started: true, ended: true });
  assert.ok(!JSON.stringify(summaries).includes(SECRET));
  assert.ok(!JSON.stringify(summaries).includes('Bash'));
});

test('session index is explicit, repository-local, ignored, and idempotent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-index-'));
  await runInit(root);
  const events = [createObservation({ agent: 'claude-code', kind: 'tool.start', sessionId: SECRET, toolName: 'Read' })];
  const first = await writeSessionIndex(root, events);
  const second = await writeSessionIndex(root, events);
  const serialized = await readFile(sessionIndexPath(root), 'utf8');
  const ignored = await readFile(path.join(root, '.rigx/.gitignore'), 'utf8');
  assert.equal(first.totalSessions, 1);
  assert.equal(second.totalSessions, 1);
  assert.match(ignored, /^state\/$/m);
  assert.ok(!serialized.includes(SECRET));
  assert.ok(!serialized.includes('Read'));
});

test('rewriting an index drops unknown persisted fields', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-index-sanitize-'));
  await runInit(root);
  const events = [createObservation({ agent: 'codex', kind: 'session.start', sessionId: SECRET })];
  const result = await writeSessionIndex(root, events);
  result.index.sessions[0].unexpectedRawValue = SECRET;
  await writeFile(sessionIndexPath(root), `${JSON.stringify(result.index)}\n`, 'utf8');
  await writeSessionIndex(root, events);
  assert.ok(!(await readFile(sessionIndexPath(root), 'utf8')).includes(SECRET));
});

test('index command normalizes an explicit stream and reports JSON metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-index-command-'));
  await runInit(root);
  const input = path.join(root, 'events.ndjson');
  await writeFile(input, `${JSON.stringify({
    hook_event_name: 'SessionStart',
    session_id: SECRET,
    transcript_path: `/private/${SECRET}.jsonl`,
  })}\n`, 'utf8');
  const output = JSON.parse(await runIndex({ root, agent: 'claude-code', input, json: true }));
  assert.equal(output.indexedEvents, 1);
  assert.equal(output.indexedSessions, 1);
  assert.equal(output.totalSessions, 1);
  assert.deepEqual(output.privacy, { mode: 'strict', rawContentStored: false, fullPathsStored: false });
  assert.ok(!JSON.stringify(output).includes(SECRET));
});

test('session indexing requires an initialized strict metadata-only boundary', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-index-uninitialized-'));
  await assert.rejects(() => writeSessionIndex(root, []), /rigx init/);
});

test('readSessionIndex reads back what writeSessionIndex persisted', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-index-read-'));
  await runInit(root);
  const events = [createObservation({ agent: 'codex', kind: 'tool.start', sessionId: SECRET, toolName: 'Bash', toolCategoryOverride: 'verification' })];
  await writeSessionIndex(root, events);
  const index = await readSessionIndex(root);
  assert.equal(index.sessions.length, 1);
  assert.equal(index.sessions[0].counts.toolStartsByCategory.verification, 1);
});

test('readSessionIndex returns an empty index when no file has been written yet', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-index-empty-'));
  const index = await readSessionIndex(root);
  assert.deepEqual(index.sessions, []);
});

test('a v1 session index without the verification category migrates cleanly', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-index-migrate-'));
  await runInit(root);
  const v1Index = {
    schemaVersion: 1,
    privacy: { mode: 'strict', rawContentStored: false, fullPathsStored: false },
    sessions: [{
      agent: 'codex',
      session: 'a'.repeat(20),
      firstObservedAt: null,
      lastObservedAt: null,
      lifecycle: { started: true, ended: true },
      counts: {
        events: 2,
        toolStarts: 1,
        toolEnds: 1,
        toolFailures: 0,
        agentErrors: 0,
        toolStartsByCategory: { shell: 1, filesystem: 0, search: 0, network: 0, subagent: 0, other: 0 },
      },
    }],
  };
  await mkdir(path.dirname(sessionIndexPath(root)), { recursive: true });
  await writeFile(sessionIndexPath(root), `${JSON.stringify(v1Index)}\n`, 'utf8');
  const index = await readSessionIndex(root);
  assert.equal(index.schemaVersion, 2);
  assert.equal(index.sessions[0].counts.toolStartsByCategory.verification, 0);
  assert.equal(index.sessions[0].counts.toolStartsByCategory.shell, 1);
});

test('readSessionIndex rejects a session index with an unsupported schema version', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-index-unsupported-'));
  await runInit(root);
  await mkdir(path.dirname(sessionIndexPath(root)), { recursive: true });
  await writeFile(sessionIndexPath(root), `${JSON.stringify({ schemaVersion: 99, sessions: [] })}\n`, 'utf8');
  await assert.rejects(() => readSessionIndex(root), /Unsupported session index schema/);
});
