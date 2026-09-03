import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { evaluateCandidate } from '../src/core/candidate.js';

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

async function initRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-candidate-repo-'));
  await git(['init', '--initial-branch=main'], root);
  await git(['config', 'user.email', 'test@example.com'], root);
  await git(['config', 'user.name', 'RIGX Test'], root);
  return root;
}

async function commit(root, message) {
  await git(['add', '-A'], root);
  await git(['commit', '-m', message], root);
}

test('evaluateCandidate applies a json-merge patch and verifies the added script runs', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'verify-test.js'), 'process.exitCode = 0;\n', 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
  await commit(root, 'baseline');

  const proposal = {
    id: 'verification-workflow.add-test-script',
    patch: { type: 'json-merge', file: 'package.json', mergePath: ['scripts'], values: { test: 'node verify-test.js' } },
  };

  const result = await evaluateCandidate(root, 'HEAD', proposal);
  assert.equal(result.outcome, 'applied');
  assert.equal(result.verified, true);
  assert.deepEqual(result.scripts.map((s) => s.outcome), ['success']);

  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.test, undefined);
});

test('evaluateCandidate reports failed when the added script does not pass', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'verify-test.js'), 'process.exitCode = 1;\n', 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
  await commit(root, 'baseline');

  const proposal = {
    id: 'verification-workflow.add-test-script',
    patch: { type: 'json-merge', file: 'package.json', mergePath: ['scripts'], values: { test: 'node verify-test.js' } },
  };

  const result = await evaluateCandidate(root, 'HEAD', proposal);
  assert.equal(result.outcome, 'failed');
  assert.equal(result.verified, false);
});

test('evaluateCandidate applies a create-file patch and reports it as unverified', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
  await commit(root, 'baseline');

  const proposal = {
    id: 'verification-workflow.add-ci-workflow',
    patch: { type: 'create-file', file: '.github/workflows/ci.yml', content: 'name: CI\n' },
  };

  const result = await evaluateCandidate(root, 'HEAD', proposal);
  assert.equal(result.outcome, 'applied');
  assert.equal(result.verified, null);
  assert.match(result.note, /no locally executable verification/);
});

test('evaluateCandidate reports an error when the target file already exists', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
  await commit(root, 'baseline with ci file');
  await execFileAsync('mkdir', ['-p', path.join(root, '.github/workflows')]);
  await writeFile(path.join(root, '.github/workflows/ci.yml'), 'name: existing\n', 'utf8');
  await commit(root, 'add existing ci file');

  const proposal = {
    id: 'verification-workflow.add-ci-workflow',
    patch: { type: 'create-file', file: '.github/workflows/ci.yml', content: 'name: CI\n' },
  };

  const result = await evaluateCandidate(root, 'HEAD', proposal);
  assert.equal(result.outcome, 'error');
  assert.match(result.message, /Refusing to overwrite/);
});

test('evaluateCandidate reports unsupported for a proposal with no patch', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
  await commit(root, 'baseline');

  const proposal = { id: 'instruction-restructuring.deduplicate', patch: null };

  const result = await evaluateCandidate(root, 'HEAD', proposal);
  assert.equal(result.outcome, 'unsupported');
});

test('evaluateCandidate leaves the caller\'s working directory untouched', async () => {
  const root = await initRepo();
  await writeFile(path.join(root, 'verify-test.js'), 'process.exitCode = 0;\n', 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
  await commit(root, 'baseline');

  const proposal = {
    id: 'verification-workflow.add-test-script',
    patch: { type: 'json-merge', file: 'package.json', mergePath: ['scripts'], values: { test: 'node verify-test.js' } },
  };

  await evaluateCandidate(root, 'HEAD', proposal);

  const { stdout: worktrees } = await git(['worktree', 'list'], root);
  assert.equal(worktrees.trim().split('\n').length, 1);
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.test, undefined);
});
