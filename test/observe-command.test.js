import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runObserve } from '../src/commands/observe.js';

const SECRET = 'private-observe-command-value';

test('observe normalizes explicit NDJSON files and returns valid JSON', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-observe-'));
  const file = path.join(root, 'events.ndjson');
  await writeFile(file, `${JSON.stringify({
    hook_event_name: 'PreToolUse',
    session_id: 'session-test',
    tool_name: 'Bash',
    tool_input: { command: `echo ${SECRET}` },
    cwd: `/private/${SECRET}`,
  })}\n`, 'utf8');

  const output = await runObserve({ agent: 'claude-code', input: file, json: true });
  const parsed = JSON.parse(output);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].kind, 'tool.start');
  assert.ok(!output.includes(SECRET));
});

test('observe rejects unknown agents instead of falling back to generic parsing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-observe-'));
  const file = path.join(root, 'events.ndjson');
  await writeFile(file, '{}\n', 'utf8');
  await assert.rejects(() => runObserve({ agent: 'unknown', input: file }), /requires --agent/);
});
