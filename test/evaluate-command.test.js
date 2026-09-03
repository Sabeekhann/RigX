import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { runEvaluate } from '../src/commands/evaluate.js';

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

async function initRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-eval-cmd-'));
  await git(['init', '--initial-branch=main'], root);
  await git(['config', 'user.email', 'test@example.com'], root);
  await git(['config', 'user.name', 'RIGX Test'], root);
  return root;
}

// Uses a real .js file invoked as `node <file>`, rather than an inline
// `node -e "..."` string, so the fixture doesn't depend on shell/npm quoting
// behavior that differs between POSIX shells and Windows cmd.exe.
async function commitVerify(root, scriptExitCodes, message) {
  const scripts = {};
  for (const [name, exitCode] of Object.entries(scriptExitCodes)) {
    const filename = `verify-${name}.js`;
    await writeFile(path.join(root, filename), `process.exitCode = ${exitCode};\n`, 'utf8');
    scripts[name] = `node ${filename}`;
  }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts }), 'utf8');
  await git(['add', '-A'], root);
  await git(['commit', '-m', message], root);
}

test('evaluate command renders a regression as text', async () => {
  const root = await initRepo();
  await commitVerify(root, { test: 0 }, 'baseline');
  await git(['checkout', '-b', 'candidate'], root);
  await commitVerify(root, { test: 1 }, 'break test');

  const output = await runEvaluate(root, 'main', 'candidate', false);
  assert.match(output, /RIGX Evaluate/);
  assert.match(output, /PASS test/);
  assert.match(output, /FAIL test/);
  assert.match(output, /Regressions \(1\)/);
});

test('evaluate command reports no regressions when both sides pass', async () => {
  const root = await initRepo();
  await commitVerify(root, { test: 0 }, 'baseline');
  await git(['branch', 'candidate'], root);

  const output = await runEvaluate(root, 'main', 'candidate', false);
  assert.match(output, /No regressions detected/);
});

test('evaluate command returns valid JSON', async () => {
  const root = await initRepo();
  await commitVerify(root, { test: 0 }, 'baseline');
  await git(['branch', 'candidate'], root);

  const output = JSON.parse(await runEvaluate(root, 'main', 'candidate', true));
  assert.equal(output.schemaVersion, 1);
  assert.equal(output.baseline.ref, 'main');
  assert.equal(output.candidate.ref, 'candidate');
});
