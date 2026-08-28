import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInit } from '../src/commands/init.js';

async function tempRepo() {
  return mkdtemp(path.join(os.tmpdir(), 'rigx-'));
}

test('strict mode denies persistence of sensitive session content by default', async () => {
  const root = await tempRepo();
  await runInit(root);
  const config = JSON.parse(await readFile(path.join(root, '.rigx/config.json'), 'utf8'));
  assert.equal(config.privacy.mode, 'strict');
  assert.equal(config.privacy.network, 'deny');
  assert.equal(config.privacy.sessionObservation, 'metadata-only');
  assert.equal(config.privacy.persistRawPrompts, false);
  assert.equal(config.privacy.persistModelResponses, false);
  assert.equal(config.privacy.persistSourceCode, false);
  assert.equal(config.privacy.persistTerminalOutput, false);
  assert.equal(config.privacy.persistFullPaths, false);
});
