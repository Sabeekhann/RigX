import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { exists } from './fs.js';

export const PROPOSAL_SCHEMA_VERSION = 1;

// Phase 3 proposals are reviewable suggestions only. Nothing in this module
// writes to disk or mutates the repository; see AGENTS.md's "propose before
// mutate" rule and ROADMAP.md's "No automatic application by default."

// `patch` is present only for proposals with a literal, unambiguous file
// change (see docs/candidates.md) -- it is never applied automatically; it
// is what `rigx candidate` applies inside a throwaway worktree to verify the
// suggestion actually works. Proposals without one (most of them: they
// involve wording/judgment, not a mechanical file change) leave it null.
function proposal({ id, category, title, rationale, findingIds, suggestion, patch = null }) {
  return { id, category, title, rationale, findingIds, suggestion, patch };
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

// Returns { label, command } | null -- null means no confident deterministic
// command exists (e.g. lint with no detected tool), so callers must fall back
// to a display-only suggestion with no patch.
async function verificationScriptCommand(root, label) {
  if (label === 'lint') {
    const tool = await detectLintTool(root);
    if (tool === 'eslint') return { label, command: 'eslint .' };
    if (tool === 'biome') return { label, command: 'biome check .' };
    return null;
  }
  if (label === 'typecheck') {
    return { label, command: 'tsc --noEmit' };
  }
  const runner = await detectTestRunner(root);
  if (runner === 'vitest') return { label, command: 'vitest run' };
  if (runner === 'jest') return { label, command: 'jest' };
  if (runner === 'mocha') return { label, command: 'mocha' };
  if (runner === 'ava') return { label, command: 'ava' };
  return { label, command: 'node --test' };
}

function verificationScriptSuggestion(scriptCommand, label) {
  if (!scriptCommand) return `"${label}": "<your lint command>"`;
  return `"${scriptCommand.label}": "${scriptCommand.command}"`;
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
    const scriptCommand = await verificationScriptCommand(root, label);
    proposals.push(proposal({
      id: `verification-workflow.add-${label}-script`,
      category: 'verification-workflow',
      title: `Add a deterministic \`${label}\` script to package.json`,
      rationale: finding.title,
      findingIds: [finding.id],
      suggestion: verificationScriptSuggestion(scriptCommand, label),
      patch: scriptCommand
        ? { type: 'json-merge', file: 'package.json', mergePath: ['scripts'], values: { [scriptCommand.label]: scriptCommand.command } }
        : null,
    }));
  }

  const noCi = findingsById.get('verification.no-ci');
  if (noCi) {
    const ciYaml = ciWorkflowSuggestion(inventory);
    proposals.push(proposal({
      id: 'verification-workflow.add-ci-workflow',
      category: 'verification-workflow',
      title: 'Add a minimal CI workflow that runs the repository\'s verification scripts',
      rationale: noCi.title,
      findingIds: [noCi.id],
      suggestion: `Suggested .github/workflows/ci.yml:\n\n${ciYaml}`,
      patch: { type: 'create-file', file: '.github/workflows/ci.yml', content: `${ciYaml}\n` },
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

function deterministicHookProposals(findingsById, inventory) {
  const proposals = [];

  const noHooks = findingsById.get('tooling.no-hooks');
  const scripts = new Set(inventory.packageScripts);
  const verificationScript = ['test', 'lint', 'typecheck'].find((label) => scripts.has(label));
  if (noHooks && verificationScript) {
    const command = runCommand(inventory.packageManager, verificationScript, verificationScript === 'test' ? 'test' : undefined);
    proposals.push(proposal({
      id: 'deterministic-hooks.verify-after-edit',
      category: 'deterministic-hooks',
      title: 'Add a hook that runs verification automatically after file edits',
      rationale: noHooks.title,
      findingIds: [noHooks.id],
      suggestion: [
        'Suggested .claude/settings.json hook (adjust the matcher/command to your workflow):',
        '',
        JSON.stringify({
          hooks: {
            PostToolUse: [
              { matcher: 'Write|Edit', hooks: [{ type: 'command', command }] },
            ],
          },
        }, null, 2),
      ].join('\n'),
    }));
  }

  return proposals;
}

// Note: tool/MCP configuration changes are not yet mapped to a proposal.
// The absence of MCP config (tooling.no-mcp-config in scanner.js) is not
// itself evidence of a problem -- most repositories have no need for one --
// so proposing it unconditionally would be noise, the same reason
// scanner.js's skills.none finding has no proposal mapping either. A useful
// proposal here needs a real signal for *which* external tool would help,
// which RIGX cannot determine deterministically; see docs/proposals.md.

function taskSkillProposals(recurrenceFindingsById) {
  const proposals = [];

  const searchHeavy = recurrenceFindingsById.get('recurring-search-heavy-sessions');
  if (searchHeavy) {
    proposals.push(proposal({
      id: 'task-specific-skills.add-navigation-skill',
      category: 'task-specific-skills',
      title: 'Consider a focused repository-navigation skill',
      rationale: searchHeavy.title,
      findingIds: ['recurring-search-heavy-sessions'],
      suggestion: 'Search-heavy sessions recur across your indexed history (see `rigx recurrence`). Consider a skill or deterministic lookup script that documents where key subsystems live, so agents stop rediscovering the same structure by searching each time.',
    }));
  }

  return proposals;
}

function recoveryWorkflowProposals(recurrenceFindingsById) {
  const proposals = [];

  const recurringFailures = recurrenceFindingsById.get('recurring-tool-failures');
  if (recurringFailures) {
    proposals.push(proposal({
      id: 'recovery-workflows.add-failure-guidance',
      category: 'recovery-workflows',
      title: 'Add recovery guidance for repeated tool failures',
      rationale: recurringFailures.title,
      findingIds: ['recurring-tool-failures'],
      suggestion: 'Tool failures recur across your indexed sessions (see `rigx recurrence`). Consider adding a short "when a command fails" section to your instructions: stop after one retry, inspect the actual error output, and only retry after addressing the likely cause (permissions, missing dependency, wrong working directory) rather than repeating the same command.',
    }));
  }

  return proposals;
}

export async function generateProposals(root, inventory, findings = [], recurrenceFindings = []) {
  const findingsById = new Map(findings.map((item) => [item.id, item]));
  const recurrenceFindingsById = new Map(recurrenceFindings.map((item) => [item.code, item]));

  const proposals = [
    ...await verificationProposals(root, inventory, findingsById),
    ...instructionRestructuringProposals(findingsById),
    ...repositoryNavigationProposals(findingsById),
    ...deterministicHookProposals(findingsById, inventory),
    ...taskSkillProposals(recurrenceFindingsById),
    ...recoveryWorkflowProposals(recurrenceFindingsById),
  ];

  return {
    schemaVersion: PROPOSAL_SCHEMA_VERSION,
    proposals,
  };
}
