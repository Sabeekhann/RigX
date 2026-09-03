import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { runCli } from '../src/cli.js';

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

async function initEvaluateFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rigx-cli-evaluate-'));
  await git(['init', '--initial-branch=main'], root);
  await git(['config', 'user.email', 'test@example.com'], root);
  await git(['config', 'user.name', 'RIGX Test'], root);
  await writeFile(path.join(root, 'verify-test.js'), 'process.exitCode = 0;\n', 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node verify-test.js' } }), 'utf8');
  await git(['add', '-A'], root);
  await git(['commit', '-m', 'baseline'], root);
  await git(['branch', 'candidate'], root);
  return root;
}

const PACKAGE_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

async function capture(stream, fn) {
  let value = '';
  const original = stream.write;
  stream.write = (chunk) => {
    value += String(chunk);
    return true;
  };
  try {
    const code = await fn();
    return { code, value };
  } finally {
    stream.write = original;
  }
}

test('version reports the same version declared in package.json', async () => {
  const result = await capture(process.stdout, () => runCli(['--version']));
  assert.equal(result.code, 0);
  assert.equal(result.value.trim(), PACKAGE_VERSION);
});

test('evaluate requires both --baseline and --candidate', async () => {
  const result = await capture(process.stderr, () => runCli(['evaluate', '.', '--baseline', 'main']));
  assert.equal(result.code, 1);
  assert.match(result.value, /--baseline.*--candidate/);
});

test('evaluate runs through the full CLI dispatcher and reports no regressions', async () => {
  const root = await initEvaluateFixture();
  const result = await capture(process.stdout, () => runCli(['evaluate', root, '--baseline', 'main', '--candidate', 'candidate', '--json']));
  assert.equal(result.code, 0);
  const output = JSON.parse(result.value);
  assert.equal(output.schemaVersion, 1);
  assert.equal(output.regressions.length, 0);
});

test('help documents the deterministic alpha command surface', async () => {
  const result = await capture(process.stdout, () => runCli(['--help']));
  assert.equal(result.code, 0);
  for (const command of ['init', 'doctor', 'agents', 'privacy', 'observe', 'patterns', 'index', 'recurrence', 'propose', 'evaluate', 'snapshot', 'status']) {
    assert.match(result.value, new RegExp(`rigx ${command}`));
  }
});
