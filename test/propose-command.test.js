import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runPropose } from '../src/commands/propose.js';
import { runInit } from '../src/commands/init.js';
import { createObservation } from '../src/core/observation.js';
import { sessionIndexPath, writeSessionIndex } from '../src/core/session-index.js';

async function tempRepo() {
  return mkdtemp(path.join(os.tmpdir(), 'rigx-propose-command-'));
}

test('propose command renders reviewable proposals as text without applying anything', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'AGENTS.md'), '# Rules\n\nPackage manager: npm\n', 'utf8');
  await writeFile(path.join(root, 'CLAUDE.md'), '# Claude rules\n\nPackage manager: pnpm\n', 'utf8');

  const output = await runPropose(root, false);
  assert.match(output, /RIGX Proposals/);
  assert.match(output, /reviewable suggestions only/);
  assert.match(output, /instruction-restructuring/);
});

test('propose command returns valid JSON with schema version and proposal list', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'AGENTS.md'), '# Rules\n\nPackage manager: npm\n', 'utf8');
  await writeFile(path.join(root, 'CLAUDE.md'), '# Claude rules\n\nPackage manager: pnpm\n', 'utf8');

  const output = JSON.parse(await runPropose(root, true));
  assert.equal(output.schemaVersion, 1);
  assert.ok(output.proposals.length > 0);
});

test('propose command surfaces recovery-workflow proposals from indexed session history', async () => {
  const root = await tempRepo();
  await runInit(root);
  for (const sessionId of ['session-a', 'session-b', 'session-c']) {
    const events = [
      createObservation({ agent: 'claude-code', kind: 'tool.start', sessionId, toolName: 'Bash' }),
      createObservation({ agent: 'claude-code', kind: 'tool.end', sessionId, toolName: 'Bash', outcome: 'failure' }),
    ];
    await writeSessionIndex(root, events);
  }

  const output = JSON.parse(await runPropose(root, true));
  const recoveryProposal = output.proposals.find((item) => item.id === 'recovery-workflows.add-failure-guidance');
  assert.ok(recoveryProposal);
});

test('propose command tolerates an unreadable or unsupported session index instead of failing', async () => {
  const root = await tempRepo();
  await runInit(root);
  await mkdir(path.dirname(sessionIndexPath(root)), { recursive: true });
  await writeFile(sessionIndexPath(root), JSON.stringify({ schemaVersion: 99, sessions: [] }), 'utf8');

  const output = await runPropose(root, false);
  assert.match(output, /RIGX Proposals/);
});

test('propose command reports clearly when no proposals apply', async () => {
  const root = await tempRepo();
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'README.md'), '# Example\n', 'utf8');
  await writeFile(path.join(root, 'docs/architecture.md'), '# Architecture\n', 'utf8');

  const output = await runPropose(root, false);
  assert.match(output, /No deterministic findings currently map to a reviewable proposal/);
});
