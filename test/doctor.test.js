import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runDoctor } from '../src/commands/doctor.js';
import { runInit } from '../src/commands/init.js';

async function tempRepo() {
  return mkdtemp(path.join(os.tmpdir(), 'rigx-'));
}

test('doctor reports missing harness surfaces without inventing stale claims', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }), 'utf8');
  const report = JSON.parse(await runDoctor(root, true));
  assert.ok(report.findings.some((item) => item.id === 'instructions.none'));
  assert.ok(report.findings.some((item) => item.id === 'verification.missing-test'));
  assert.ok(!report.findings.some((item) => /stale/i.test(item.title)));
});

test('init creates strict local privacy config and doctor recognizes it', async () => {
  const root = await tempRepo();
  await mkdir(path.join(root, '.github/workflows'), { recursive: true });
  await writeFile(path.join(root, 'README.md'), '# Example\n', 'utf8');
  await writeFile(path.join(root, 'AGENTS.md'), '# Rules\n', 'utf8');
  await writeFile(path.join(root, '.github/workflows/ci.yml'), 'name: ci\n', 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {
    test: 'node --test', lint: 'eslint .', typecheck: 'tsc --noEmit',
  } }), 'utf8');
  await runInit(root);
  const report = JSON.parse(await runDoctor(root, true));
  assert.ok(!report.findings.some((item) => item.id === 'privacy.uninitialized'));
});
