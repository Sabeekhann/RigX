import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { exists } from './fs.js';

export const PROPOSAL_SCHEMA_VERSION = 1;

// Phase 3 proposals are reviewable suggestions only. Nothing in this module
// writes to disk or mutates the repository; see AGENTS.md's "propose before
// mutate" rule and ROADMAP.md's "No automatic application by default."

function proposal({ id, category, title, rationale, findingIds, suggestion }) {
  return { id, category, title, rationale, findingIds, suggestion };
}

async function readJsonIfExists(target) {
  try {
    return JSON.parse(await readFile(target, 'utf8'));
  } catch {
    return null;
  }
}

async function detectLintTool(root) {
  const eslintConfigs = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', '.eslintrc', '.eslintrc.json'];
  for (const name of eslintConfigs) {
    if (await exists(path.join(root, name))) return 'eslint';
  }
  for (const name of ['biome.json', 'biome.jsonc']) {
    if (await exists(path.join(root, name))) return 'biome';
  }
  const packageJson = await readJsonIfExists(path.join(root, 'package.json'));
  const deps = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  if (deps.eslint) return 'eslint';
  if (deps['@biomejs/biome']) return 'biome';
  return null;
}

async function detectTestRunner(root) {
  const packageJson = await readJsonIfExists(path.join(root, 'package.json'));
  const deps = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  if (deps.vitest) return 'vitest';
  if (deps.jest) return 'jest';
  if (deps.mocha) return 'mocha';
  if (deps.ava) return 'ava';
  return null;
}

function runCommand(packageManager, script, npmSpecialCase) {
  if (packageManager === 'npm' && npmSpecialCase) return `npm ${npmSpecialCase}`;
  if (packageManager === 'yarn') return `yarn ${script}`;
  if (packageManager === 'bun') return `bun run ${script}`;
  return `${packageManager ?? 'npm'} run ${script}`;
}

async function verificationScriptSuggestion(root, label) {
  if (label === 'lint') {
    const tool = await detectLintTool(root);
    if (tool === 'eslint') return '"lint": "eslint ."';
    if (tool === 'biome') return '"lint": "biome check ."';
    return '"lint": "<your lint command>"';
  }
  if (label === 'typecheck') {
    return '"typecheck": "tsc --noEmit"';
  }
  const runner = await detectTestRunner(root);
  if (runner === 'vitest') return '"test": "vitest run"';
  if (runner === 'jest') return '"test": "jest"';
  if (runner === 'mocha') return '"test": "mocha"';
  if (runner === 'ava') return '"test": "ava"';
  return '"test": "node --test"';
}

function ciWorkflowSuggestion(inventory) {
  const packageManager = inventory.packageManager ?? 'npm';
  const install = {
    npm: 'npm ci',
    yarn: 'yarn install --frozen-lockfile',
    pnpm: 'pnpm install --frozen-lockfile',
    bun: 'bun install --frozen-lockfile',
  }[packageManager] ?? 'npm ci';

  const scripts = new Set(inventory.packageScripts);
  const steps = [];
  if (scripts.has('lint')) steps.push(runCommand(packageManager, 'lint'));
  if (scripts.has('typecheck')) steps.push(runCommand(packageManager, 'typecheck'));
  if (scripts.has('test')) steps.push(runCommand(packageManager, 'test', 'test'));
  if (steps.length === 0) steps.push(runCommand(packageManager, 'test', 'test'));

  return [
    'name: CI',
    'on: [push, pull_request]',
    'jobs:',
    '  verify:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    "        with: { node-version: '22' }",
    `      - run: ${install}`,
    ...steps.map((step) => `      - run: ${step}`),
  ].join('\n');
}

async function verificationProposals(root, inventory, findingsById) {
  const proposals = [];

  for (const label of ['test', 'lint', 'typecheck']) {
    const finding = findingsById.get(`verification.missing-${label}`);
    if (!finding) continue;
    proposals.push(proposal({
      id: `verification-workflow.add-${label}-script`,
      category: 'verification-workflow',
      title: `Add a deterministic \`${label}\` script to package.json`,
      rationale: finding.title,
      findingIds: [finding.id],
      suggestion: await verificationScriptSuggestion(root, label),
    }));
  }

  const noCi = findingsById.get('verification.no-ci');
  if (noCi) {
    proposals.push(proposal({
      id: 'verification-workflow.add-ci-workflow',
      category: 'verification-workflow',
      title: 'Add a minimal CI workflow that runs the repository\'s verification scripts',
      rationale: noCi.title,
      findingIds: [noCi.id],
      suggestion: `Suggested .github/workflows/ci.yml:\n\n${ciWorkflowSuggestion(inventory)}`,
    }));
  }

  return proposals;
}

function instructionRestructuringProposals(findingsById) {
  const proposals = [];

  const duplicates = findingsById.get('instructions.duplicates');
  if (duplicates) {
    proposals.push(proposal({
      id: 'instruction-restructuring.deduplicate',
      category: 'instruction-restructuring',
      title: 'Consolidate repeated instruction text into one canonical source',
      rationale: duplicates.title,
      findingIds: [duplicates.id],
      suggestion: [
        'Move the repeated line(s) below into a single instruction file and have the other surfaces reference it instead of repeating the text:',
        ...duplicates.evidence.map((line) => `  - ${line}`),
      ].join('\n'),
    }));
  }

  const conflicts = findingsById.get('instructions.conflicts');
  if (conflicts) {
    proposals.push(proposal({
      id: 'instruction-restructuring.resolve-conflicts',
      category: 'instruction-restructuring',
      title: 'Resolve conflicting values declared across instruction surfaces',
      rationale: conflicts.title,
      findingIds: [conflicts.id],
      suggestion: [
        'Pick one authoritative value for each key below and remove the conflicting line(s) from the other file(s):',
        ...conflicts.evidence.map((line) => `  - ${line}`),
      ].join('\n'),
    }));
  }

  const combinedSize = findingsById.get('instructions.combined-size');
  if (combinedSize) {
    proposals.push(proposal({
      id: 'instruction-restructuring.consolidate-combined-size',
      category: 'instruction-restructuring',
      title: 'Consolidate overlapping guidance spread across instruction surfaces',
      rationale: combinedSize.title,
      findingIds: [combinedSize.id],
      suggestion: 'Move shared guidance into one canonical instruction file and have the other surfaces reference it instead of duplicating full sections.',
    }));
  }

  return proposals;
}

function repositoryNavigationProposals(findingsById) {
  const proposals = [];

  const docsThin = findingsById.get('legibility.docs-thin');
  if (docsThin) {
    proposals.push(proposal({
      id: 'repository-navigation.add-architecture-doc',
      category: 'repository-navigation',
      title: 'Add a minimal architecture/navigation document',
      rationale: docsThin.title,
      findingIds: [docsThin.id],
      suggestion: [
        'Suggested docs/architecture.md outline:',
        '',
        '# Architecture',
        '',
        '## Overview',
        '<one paragraph: what this repository does and its main components>',
        '',
        '## Key directories',
        '<top-level directories and what lives in each>',
        '',
        '## How to verify a change',
        '<link to the deterministic test/lint/typecheck commands>',
      ].join('\n'),
    }));
  }

  return proposals;
}

export async function generateProposals(root, inventory, findings = []) {
  const findingsById = new Map(findings.map((item) => [item.id, item]));

  const proposals = [
    ...await verificationProposals(root, inventory, findingsById),
    ...instructionRestructuringProposals(findingsById),
    ...repositoryNavigationProposals(findingsById),
  ];

  return {
    schemaVersion: PROPOSAL_SCHEMA_VERSION,
    proposals,
  };
}
