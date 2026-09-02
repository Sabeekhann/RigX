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

test('doctor reports repeated instruction text across surfaces with confidence evidence', async () => {
  const root = await tempRepo();
  const sharedLineOne = 'Never commit credentials, tokens, private keys, or secrets to this repository.';
  const sharedLineTwo = 'Run npm run check before considering any change complete and ready.';
  await writeFile(path.join(root, 'AGENTS.md'), `# Rules\n\n${sharedLineOne}\n${sharedLineTwo}\n`, 'utf8');
  await writeFile(path.join(root, 'CLAUDE.md'), `# Claude rules\n\n${sharedLineOne}\n${sharedLineTwo}\n`, 'utf8');
  const report = JSON.parse(await runDoctor(root, true));
  const duplicates = report.findings.find((item) => item.id === 'instructions.duplicates');
  assert.ok(duplicates);
  assert.equal(duplicates.confidence, 'medium');
  assert.ok(duplicates.evidence.some((line) => line.includes('AGENTS.md') && line.includes('CLAUDE.md')));
});

test('every doctor finding carries a confidence field', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }), 'utf8');
  const report = JSON.parse(await runDoctor(root, true));
  assert.ok(report.findings.length > 0);
  for (const item of report.findings) {
    assert.ok(['low', 'medium', 'high'].includes(item.confidence));
  }
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
