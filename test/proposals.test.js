import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeRepository, inventoryRepository } from '../src/core/scanner.js';
import { generateProposals } from '../src/core/proposals.js';

async function tempRepo() {
  return mkdtemp(path.join(os.tmpdir(), 'rigx-proposals-'));
}

test('generateProposals proposes a CI workflow when none exists for a GitHub repository', async () => {
  const root = await tempRepo();
  await mkdir(path.join(root, '.git'), { recursive: true });
  await writeFile(path.join(root, '.git/config'), '[remote "origin"]\n\turl = https://github.com/example/example.git\n', 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }), 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const ciProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-ci-workflow');
  assert.ok(ciProposal);
  assert.equal(ciProposal.category, 'verification-workflow');
  assert.match(ciProposal.suggestion, /npm ci/);
  assert.match(ciProposal.suggestion, /npm test/);
});

test('generateProposals suggests a test script tailored to the detected test runner', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }), 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const testProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-test-script');
  assert.ok(testProposal);
  assert.match(testProposal.suggestion, /vitest run/);
});

test('generateProposals falls back to node --test when no test runner is detected', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({}), 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const testProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-test-script');
  assert.ok(testProposal);
  assert.match(testProposal.suggestion, /node --test/);
});

test('generateProposals suggests eslint when an eslint config is present', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }), 'utf8');
  await writeFile(path.join(root, 'eslint.config.js'), 'export default [];\n', 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const lintProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-lint-script');
  assert.ok(lintProposal);
  assert.match(lintProposal.suggestion, /eslint \./);
});

test('generateProposals proposes deduplication for repeated instruction text', async () => {
  const root = await tempRepo();
  const sharedLineOne = 'Never commit credentials, tokens, private keys, or secrets to this repository.';
  const sharedLineTwo = 'Run npm run check before considering any change complete and ready.';
  await writeFile(path.join(root, 'AGENTS.md'), `# Rules\n\n${sharedLineOne}\n${sharedLineTwo}\n`, 'utf8');
  await writeFile(path.join(root, 'CLAUDE.md'), `# Claude rules\n\n${sharedLineOne}\n${sharedLineTwo}\n`, 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const dedupeProposal = result.proposals.find((item) => item.id === 'instruction-restructuring.deduplicate');
  assert.ok(dedupeProposal);
  assert.equal(dedupeProposal.category, 'instruction-restructuring');
  assert.ok(dedupeProposal.suggestion.includes('AGENTS.md') && dedupeProposal.suggestion.includes('CLAUDE.md'));
});

test('generateProposals proposes conflict resolution for conflicting instruction values', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'AGENTS.md'), '# Rules\n\nPackage manager: npm\n', 'utf8');
  await writeFile(path.join(root, 'CLAUDE.md'), '# Claude rules\n\nPackage manager: pnpm\n', 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const conflictProposal = result.proposals.find((item) => item.id === 'instruction-restructuring.resolve-conflicts');
  assert.ok(conflictProposal);
  assert.match(conflictProposal.suggestion, /npm/);
  assert.match(conflictProposal.suggestion, /pnpm/);
});

test('generateProposals proposes an architecture doc when navigation signals are thin', async () => {
  const root = await tempRepo();

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const navProposal = result.proposals.find((item) => item.id === 'repository-navigation.add-architecture-doc');
  assert.ok(navProposal);
  assert.match(navProposal.suggestion, /docs\/architecture\.md/);
});

test('generateProposals returns no proposals when no mapped findings fired', async () => {
  const root = await tempRepo();
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'README.md'), '# Example\n', 'utf8');
  await writeFile(path.join(root, 'docs/architecture.md'), '# Architecture\n', 'utf8');
  await writeFile(path.join(root, 'AGENTS.md'), '# Rules\n', 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  assert.equal(result.proposals.length, 0);
});

test('generateProposals suggests biome when a biome config is present', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }), 'utf8');
  await writeFile(path.join(root, 'biome.json'), '{}\n', 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const lintProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-lint-script');
  assert.ok(lintProposal);
  assert.match(lintProposal.suggestion, /biome check \./);
});

test('generateProposals detects lint/test tools from dependencies when no config file exists', async () => {
  const root = await tempRepo();
  await writeFile(root + '/package.json', JSON.stringify({
    scripts: {},
    devDependencies: { eslint: '^9.0.0', jest: '^29.0.0' },
  }), 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const lintProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-lint-script');
  const testProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-test-script');
  assert.match(lintProposal.suggestion, /eslint \./);
  assert.match(testProposal.suggestion, /jest/);
});

test('generateProposals proposes a typecheck script for TypeScript repositories', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' }, devDependencies: { typescript: '^5.0.0' } }), 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const typecheckProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-typecheck-script');
  assert.ok(typecheckProposal);
  assert.match(typecheckProposal.suggestion, /tsc --noEmit/);
});

test('generateProposals uses yarn/bun run syntax for the CI workflow when detected', async () => {
  const root = await tempRepo();
  await mkdir(path.join(root, '.git'), { recursive: true });
  await writeFile(path.join(root, '.git/config'), '[remote "origin"]\n\turl = https://github.com/example/example.git\n', 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test', lint: 'eslint .' } }), 'utf8');
  await writeFile(path.join(root, 'yarn.lock'), '', 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const ciProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-ci-workflow');
  assert.ok(ciProposal);
  assert.match(ciProposal.suggestion, /yarn install --frozen-lockfile/);
  assert.match(ciProposal.suggestion, /yarn lint/);
  assert.match(ciProposal.suggestion, /yarn test/);
});

test('generateProposals proposes consolidation for a large combined instruction surface', async () => {
  const root = await tempRepo();
  const lines = Array.from({ length: 320 }, (_, i) => `This is a moderately long guidance line number ${i} about how agents should behave in this repository.`).join('\n');
  await writeFile(path.join(root, 'AGENTS.md'), lines, 'utf8');
  await writeFile(path.join(root, 'CLAUDE.md'), lines, 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const combinedProposal = result.proposals.find((item) => item.id === 'instruction-restructuring.consolidate-combined-size');
  assert.ok(combinedProposal);
});

test('generateProposals detects biome from dependencies when no config file exists', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: {}, devDependencies: { '@biomejs/biome': '^1.0.0' } }), 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const lintProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-lint-script');
  assert.ok(lintProposal);
  assert.match(lintProposal.suggestion, /biome check \./);
});

test('generateProposals uses bun run syntax for the CI workflow when detected', async () => {
  const root = await tempRepo();
  await mkdir(path.join(root, '.git'), { recursive: true });
  await writeFile(path.join(root, '.git/config'), '[remote "origin"]\n\turl = https://github.com/example/example.git\n', 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }), 'utf8');
  await writeFile(path.join(root, 'bun.lock'), '', 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const ciProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-ci-workflow');
  assert.ok(ciProposal);
  assert.match(ciProposal.suggestion, /bun install --frozen-lockfile/);
  assert.match(ciProposal.suggestion, /bun run test/);
});

test('generateProposals tolerates a malformed package.json when detecting tools', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'package.json'), '{ not valid json', 'utf8');
  await writeFile(path.join(root, 'eslint.config.js'), 'export default [];\n', 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  const lintProposal = result.proposals.find((item) => item.id === 'verification-workflow.add-lint-script');
  assert.ok(lintProposal);
  assert.match(lintProposal.suggestion, /eslint \./);
});

test('every proposal references the finding id(s) it is based on', async () => {
  const root = await tempRepo();
  await writeFile(path.join(root, 'AGENTS.md'), '# Rules\n\nPackage manager: npm\n', 'utf8');
  await writeFile(path.join(root, 'CLAUDE.md'), '# Claude rules\n\nPackage manager: pnpm\n', 'utf8');

  const inventory = await inventoryRepository(root);
  const findings = await analyzeRepository(inventory);
  const result = await generateProposals(root, inventory, findings);

  assert.ok(result.proposals.length > 0);
  for (const item of result.proposals) {
    assert.ok(Array.isArray(item.findingIds) && item.findingIds.length > 0);
  }
});
