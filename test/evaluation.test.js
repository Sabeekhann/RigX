import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { compareRefs, createWorktree, removeWorktree } from '../src/core/evaluation.js';

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

async function initRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-eval-repo-'));
  await git(['init', '--initial-branch=main'], root);
  await git(['config', 'user.email', 'test@example.com'], root);
  await git(['config', 'user.name', 'RIGX Test'], root);
  return root;
}

async function commitPackageJson(root, scripts, message) {
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts }), 'utf8');
  await git(['add', 'package.json'], root);
  await git(['commit', '-m', message], root);
}

test('compareRefs runs verification scripts in isolated worktrees and reports no regression when both pass', async () => {
  const root = await initRepo();
  await commitPackageJson(root, { test: 'node -e "process.exit(0)"' }, 'baseline');
  await git(['branch', 'candidate'], root);

  const result = await compareRefs(root, 'main', 'candidate');
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.baseline.scripts.map((s) => s.outcome), ['success']);
  assert.deepEqual(result.candidate.scripts.map((s) => s.outcome), ['success']);
  assert.equal(result.regressions.length, 0);
});

test('compareRefs detects a regression when candidate fails a script the baseline passed', async () => {
  const root = await initRepo();
  await commitPackageJson(root, { test: 'node -e "process.exit(0)"' }, 'baseline');
  await git(['checkout', '-b', 'candidate'], root);
  await commitPackageJson(root, { test: 'node -e "process.exit(1)"' }, 'break test');

  const result = await compareRefs(root, 'main', 'candidate');
  assert.equal(result.baseline.scripts[0].outcome, 'success');
  assert.equal(result.candidate.scripts[0].outcome, 'failure');
  assert.deepEqual(result.regressions, [{ script: 'test', baseline: 'success', candidate: 'failure' }]);
});

test('compareRefs does not flag a pre-existing failure as a regression', async () => {
  const root = await initRepo();
  await commitPackageJson(root, { test: 'node -e "process.exit(1)"' }, 'baseline already failing');
  await git(['branch', 'candidate'], root);

  const result = await compareRefs(root, 'main', 'candidate');
  assert.equal(result.baseline.scripts[0].outcome, 'failure');
  assert.equal(result.candidate.scripts[0].outcome, 'failure');
  assert.equal(result.regressions.length, 0);
});

test('compareRefs works when the candidate ref is the currently checked-out branch', async () => {
  const root = await initRepo();
  await commitPackageJson(root, { test: 'node -e "process.exit(0)"' }, 'baseline');
  await git(['checkout', '-b', 'feature'], root);
  await commitPackageJson(root, { test: 'node -e "process.exit(0)"', lint: 'node -e "process.exit(0)"' }, 'feature work');

  const result = await compareRefs(root, 'main', 'feature');
  assert.equal(result.candidate.scripts[0].outcome, 'success');
});

test('compareRefs reports an empty script list when no test/lint/typecheck scripts exist', async () => {
  const root = await initRepo();
  await commitPackageJson(root, { build: 'echo build' }, 'no verification scripts');
  await git(['branch', 'candidate'], root);

  const result = await compareRefs(root, 'main', 'candidate');
  assert.deepEqual(result.baseline.scripts, []);
  assert.deepEqual(result.candidate.scripts, []);
  assert.equal(result.regressions.length, 0);
});

test('compareRefs leaves the caller\'s working directory untouched', async () => {
  const root = await initRepo();
  await commitPackageJson(root, { test: 'node -e "process.exit(0)"' }, 'baseline');
  await git(['checkout', '-b', 'candidate'], root);
  await commitPackageJson(root, { test: 'node -e "process.exit(1)"' }, 'candidate change');

  await compareRefs(root, 'main', 'candidate');

  const { stdout: branch } = await git(['branch', '--show-current'], root);
  assert.equal(branch.trim(), 'candidate');
  const { stdout: worktrees } = await git(['worktree', 'list'], root);
  assert.equal(worktrees.trim().split('\n').length, 1);
});

test('createWorktree symlinks an existing node_modules into the worktree', async () => {
  const root = await initRepo();
  await commitPackageJson(root, { test: 'node -e "process.exit(0)"' }, 'baseline');
  await mkdir(path.join(root, 'node_modules'), { recursive: true });
  await writeFile(path.join(root, 'node_modules', 'marker.txt'), 'present', 'utf8');

  const { dir } = await createWorktree(root, 'main');
  try {
    const linked = await stat(path.join(dir, 'node_modules', 'marker.txt'));
    assert.ok(linked.isFile());
  } finally {
    await removeWorktree(root, dir);
  }
});

test('removeWorktree is safe to call even after the worktree directory is already gone', async () => {
  const root = await initRepo();
  await commitPackageJson(root, { test: 'node -e "process.exit(0)"' }, 'baseline');

  const { dir } = await createWorktree(root, 'main');
  await rm(dir, { recursive: true, force: true });

  await removeWorktree(root, dir);
  await assert.rejects(() => stat(dir));
});
