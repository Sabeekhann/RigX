import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { runCandidate } from '../src/commands/candidate.js';

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

async function initRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-candidate-cmd-'));
  await git(['init', '--initial-branch=main'], root);
  await git(['config', 'user.email', 'test@example.com'], root);
  await git(['config', 'user.name', 'RIGX Test'], root);
  return root;
}

async function commit(root, message) {
  await git(['add', '-A'], root);
  await git(['commit', '-m', message], root);
}

test('candidate command verifies the add-test-script proposal and renders text output', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({}), 'utf8');
  await commit(root, 'baseline with no test script');

  const output = await runCandidate(root, 'verification-workflow.add-test-script', false);
  assert.match(output, /RIGX Candidate/);
  assert.match(output, /Outcome: APPLIED/);
  assert.match(output, /PASS test/);
});

test('candidate command returns valid JSON', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({}), 'utf8');
  await commit(root, 'baseline with no test script');

  const output = JSON.parse(await runCandidate(root, 'verification-workflow.add-test-script', true));
  assert.equal(output.proposalId, 'verification-workflow.add-test-script');
  assert.equal(output.outcome, 'applied');
});

test('candidate command reports a clear message for an unknown proposal id', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({}), 'utf8');
  await commit(root, 'baseline');

  const output = await runCandidate(root, 'does-not-exist', false);
  assert.match(output, /No proposal with id "does-not-exist" was found/);
});
