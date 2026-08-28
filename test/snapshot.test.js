import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInit } from '../src/commands/init.js';
import { runSnapshot } from '../src/commands/snapshot.js';
import { runStatus } from '../src/commands/status.js';

async function tempRepo() {
  return mkdtemp(path.join(os.tmpdir(), 'rigx-'));
}

test('snapshot stores hashes but not instruction contents', async () => {
  const root = await tempRepo();
  const secretText = 'private-instruction-do-not-copy-9f3d';
  await writeFile(path.join(root, 'AGENTS.md'), `${secretText}\n`, 'utf8');
  await runInit(root);
  await runSnapshot(root);

  const raw = await readFile(path.join(root, '.rigx/harness.lock.json'), 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.contentStored, false);
  assert.ok(parsed.files.length >= 1);
  assert.ok(parsed.files.every((file) => file.sha256));
  assert.ok(parsed.files.some((file) => file.path === 'AGENTS.md'));
  assert.ok(!raw.includes(secretText));
});

test('status detects changed harness files', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'AGENTS.md'), 'first\n', 'utf8');
  await runInit(root);
  await runSnapshot(root);
  assert.match(await runStatus(root), /drift: none/);

  await writeFile(path.join(root, 'AGENTS.md'), 'second\n', 'utf8');
  const status = await runStatus(root);
  assert.match(status, /drift: detected/);
  assert.match(status, /AGENTS\.md/);
});
