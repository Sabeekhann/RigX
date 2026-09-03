import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { exists } from './fs.js';

const INSTRUCTION_CANDIDATES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
];
const SKILL_DIR_CANDIDATES = ['.claude/skills', '.agents/skills', '.codex/skills', '.github/skills', 'skills'];
const HOOK_CANDIDATES = ['.claude/hooks', '.claude/settings.json', '.claude/settings.local.json'];
const MCP_CANDIDATES = ['.mcp.json', '.vscode/mcp.json', '.github/copilot/mcp.json'];

async function readTextIfExists(target) {
  try {
    return await readFile(target, 'utf8');
  } catch {
    return null;
  }
}

function relative(root, target) {
  return path.relative(root, target) || '.';
}

function linesOf(text) {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

async function collectInstructionFiles(root) {
  const output = [];
  for (const candidate of INSTRUCTION_CANDIDATES) {
    const full = path.join(root, candidate);
    const text = await readTextIfExists(full);
    if (text === null) continue;
    output.push({ path: candidate, lines: linesOf(text), bytes: Buffer.byteLength(text) });
  }

  const cursorRules = path.join(root, '.cursor/rules');
  if (await exists(cursorRules)) {
    try {
      const entries = await readdir(cursorRules, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !/\.(md|mdc)$/i.test(entry.name)) continue;
        const full = path.join(cursorRules, entry.name);
        const text = await readTextIfExists(full);
        if (text === null) continue;
        output.push({ path: relative(root, full), lines: linesOf(text), bytes: Buffer.byteLength(text) });
      }
    } catch {
      // Optional surface.
    }
  }
  return output;
}

async function collectExisting(root, candidates) {
  const output = [];
  for (const candidate of candidates) {
    if (await exists(path.join(root, candidate))) output.push(candidate);
  }
  return output;
}

async function collectWorkflows(root) {
  const dir = path.join(root, '.github/workflows');
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.(yml|yaml)$/i.test(entry.name))
      .map((entry) => `.github/workflows/${entry.name}`);
  } catch {
    return [];
  }
}

async function collectDocumentationSignals(root) {
  const signals = [];
  for (const candidate of ['README.md', 'docs', 'architecture', 'adr', 'ADRs']) {
    if (await exists(path.join(root, candidate))) signals.push(candidate);
  }

  const docs = path.join(root, 'docs');
  try {
    const entries = await readdir(docs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /(architecture|design|adr|decision|system)/i.test(entry.name)) {
        signals.push(`docs/${entry.name}`);
      }
    }
  } catch {
    // Optional directory.
  }
  return [...new Set(signals)];
}

async function detectPackageManager(root) {
  if (await exists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await exists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (await exists(path.join(root, 'bun.lockb')) || await exists(path.join(root, 'bun.lock'))) return 'bun';
  if (await exists(path.join(root, 'package-lock.json')) || await exists(path.join(root, 'package.json'))) return 'npm';
  return undefined;
}


async function hasGitHubRemote(root) {
  const gitConfig = await readTextIfExists(path.join(root, '.git/config'));
  return Boolean(gitConfig && /github\.com[:/]/i.test(gitConfig));
}

async function isTypeScriptRepository(root) {
  if (await exists(path.join(root, 'tsconfig.json'))) return true;
  const packageJson = await readTextIfExists(path.join(root, 'package.json'));
  if (!packageJson) return false;
  try {
    const parsed = JSON.parse(packageJson);
    return Boolean(parsed.devDependencies?.typescript || parsed.dependencies?.typescript);
  } catch {
    return false;
  }
}

async function hasLintSignal(root) {
  const names = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', '.eslintrc', '.eslintrc.json', 'biome.json', 'biome.jsonc'];
  for (const name of names) if (await exists(path.join(root, name))) return true;
  const packageJson = await readTextIfExists(path.join(root, 'package.json'));
  if (!packageJson) return false;
  try {
    const parsed = JSON.parse(packageJson);
    const deps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
    return Boolean(deps.eslint || deps['@biomejs/biome']);
  } catch {
    return false;
  }
}

async function packageScripts(root) {
  const packageJson = await readTextIfExists(path.join(root, 'package.json'));
  if (!packageJson) return [];
  try {
    const parsed = JSON.parse(packageJson);
    return Object.keys(parsed.scripts ?? {}).sort();
  } catch {
    return [];
  }
}

export async function inventoryRepository(rootInput) {
  const root = path.resolve(rootInput);
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`Not a directory: ${root}`);

  return {
    root,
    packageManager: await detectPackageManager(root),
    packageScripts: await packageScripts(root),
    instructionFiles: await collectInstructionFiles(root),
    skillDirectories: await collectExisting(root, SKILL_DIR_CANDIDATES),
    hookSurfaces: await collectExisting(root, HOOK_CANDIDATES),
    mcpSurfaces: await collectExisting(root, MCP_CANDIDATES),
    ciWorkflows: await collectWorkflows(root),
    documentationSignals: await collectDocumentationSignals(root),
  };
}

function finding(id, category, title, evidence, recommendation, deduction, severity = 'warning', confidence = 'high') {
  return { id, category, severity, confidence, title, evidence, recommendation, deduction };
}

async function duplicateInstructionEvidence(root, files) {
  const lineToFiles = new Map();
  const original = new Map();

  for (const file of files) {
    const text = await readTextIfExists(path.join(root, file.path));
    if (!text) continue;
    for (const raw of text.split(/\r?\n/)) {
      const trimmed = raw.trim();
      if (trimmed.length < 32 || /^(#|```|---|<!--)/.test(trimmed)) continue;
      const normalized = trimmed.replace(/\s+/g, ' ').toLowerCase();
      if (!lineToFiles.has(normalized)) lineToFiles.set(normalized, new Set());
      lineToFiles.get(normalized).add(file.path);
      original.set(normalized, trimmed);
    }
  }

  return [...lineToFiles.entries()]
    .filter(([, fileSet]) => fileSet.size >= 2)
    .slice(0, 5)
    .map(([normalized, fileSet]) => {
      const snippet = original.get(normalized);
      const short = snippet.length > 100 ? `${snippet.slice(0, 97)}...` : snippet;
      return `${[...fileSet].join(', ')} repeat: “${short}”`;
    });
}

const KEY_VALUE_LINE = /^[-*]?\s*([A-Za-z][A-Za-z0-9 /_-]{2,40}):\s*(.+?)\s*$/;

function normalizeKey(key) {
  return key.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeValue(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[.`'"]+$/, '');
}

// Deliberately syntactic: two files stating the same "key: value" line with a
// different value is a provable, deterministic conflict. This does not
// attempt semantic contradiction detection (e.g. free-form prose disagreeing).
async function detectInstructionConflicts(root, files) {
  const keyToEntries = new Map();

  for (const file of files) {
    const text = await readTextIfExists(path.join(root, file.path));
    if (!text) continue;
    for (const raw of text.split(/\r?\n/)) {
      const match = KEY_VALUE_LINE.exec(raw.trim());
      if (!match) continue;
      const key = normalizeKey(match[1]);
      const value = normalizeValue(match[2]);
      if (!value) continue;
      if (!keyToEntries.has(key)) keyToEntries.set(key, new Map());
      keyToEntries.get(key).set(file.path, value);
    }
  }

  const conflicts = [];
  for (const [key, byFile] of keyToEntries.entries()) {
    const distinctValues = new Set(byFile.values());
    if (byFile.size < 2 || distinctValues.size < 2) continue;
    const detail = [...byFile.entries()].map(([file, value]) => `${file}: “${value}”`).join(' vs. ');
    conflicts.push(`${key}: ${detail}`);
  }

  return conflicts.slice(0, 5);
}

export async function analyzeRepository(inventory) {
  const findings = [];
  const root = inventory.root;

  if (inventory.instructionFiles.length === 0) {
    findings.push(finding(
      'instructions.none',
      'instructions',
      'No repository-level agent instructions detected',
      ['No AGENTS.md, CLAUDE.md, Copilot instructions, or Cursor rule files were found.'],
      'Add a concise repository-level map only if your agents need durable project guidance.',
      18,
    ));
  }

  for (const file of inventory.instructionFiles) {
    if (file.lines >= 500) {
      findings.push(finding(
        `instructions.large:${file.path}`,
        'instructions',
        `Large instruction surface: ${file.path}`,
        [`${file.path} contains ${file.lines} lines (${file.bytes} bytes).`],
        'Consider keeping the root instruction file concise and linking to deeper task-specific documentation or skills.',
        8,
      ));
    }
  }

  const duplicates = await duplicateInstructionEvidence(root, inventory.instructionFiles);
  if (duplicates.length >= 2) {
    findings.push(finding(
      'instructions.duplicates',
      'instructions',
      'Repeated instruction text spans multiple agent surfaces',
      duplicates,
      'Prefer one canonical source for shared rules and project them into vendor-specific surfaces where possible.',
      Math.min(10, 2 + duplicates.length * 2),
      'warning',
      'medium',
    ));
  }

  const conflicts = await detectInstructionConflicts(root, inventory.instructionFiles);
  if (conflicts.length > 0) {
    findings.push(finding(
      'instructions.conflicts',
      'instructions',
      'Different agent surfaces declare different values for the same key',
      conflicts,
      'Reconcile the conflicting values into one canonical source; contradictory instructions across surfaces force an agent to guess which one applies.',
      Math.min(10, 4 + conflicts.length * 3),
      'warning',
      'medium',
    ));
  }

  const totalInstructionLines = inventory.instructionFiles.reduce((sum, file) => sum + file.lines, 0);
  const hasOversizedFile = inventory.instructionFiles.some((file) => file.lines >= 500);
  if (inventory.instructionFiles.length >= 2 && totalInstructionLines >= 600 && !hasOversizedFile) {
    findings.push(finding(
      'instructions.combined-size',
      'instructions',
      'Combined instruction surface is large even though no single file is',
      [`${inventory.instructionFiles.length} instruction files totalling ${totalInstructionLines} lines: ${inventory.instructionFiles.map((file) => `${file.path} (${file.lines})`).join(', ')}.`],
      'A large combined instruction surface is still context an agent must load; consolidate overlapping guidance or link to task-specific documentation instead of repeating it per-surface.',
      6,
      'warning',
      'high',
    ));
  }

  if (inventory.documentationSignals.length <= 1) {
    findings.push(finding(
      'legibility.docs-thin',
      'repository-legibility',
      'Few repository navigation or architecture signals detected',
      inventory.documentationSignals.length === 0
        ? ['No README/docs/architecture/ADR signals were detected.']
        : [`Detected only: ${inventory.documentationSignals.join(', ')}`],
      'Add concise architecture/navigation documentation when agents repeatedly rediscover the same subsystem boundaries.',
      12,
    ));
  }

  if (inventory.packageManager) {
    const scripts = new Set(inventory.packageScripts);
    const checks = [
      { label: 'test', aliases: ['test'], relevant: true, deduction: 12 },
      { label: 'lint', aliases: ['lint'], relevant: await hasLintSignal(root), deduction: 7 },
      { label: 'typecheck', aliases: ['typecheck', 'type-check', 'check:types'], relevant: await isTypeScriptRepository(root), deduction: 7 },
    ];
    for (const check of checks) {
      if (check.relevant && !check.aliases.some((name) => scripts.has(name))) {
        findings.push(finding(
          `verification.missing-${check.label}`,
          'verification',
          `No standard ${check.label} script detected`,
          [`package.json scripts: ${inventory.packageScripts.length ? inventory.packageScripts.join(', ') : '(none)'}`],
          `Expose a deterministic ${check.label} command when the repository supports that check, so agents do not have to rediscover it.`,
          check.deduction,
        ));
      }
    }
  }

  if (inventory.ciWorkflows.length === 0 && await hasGitHubRemote(root)) {
    findings.push(finding(
      'verification.no-ci',
      'verification',
      'No GitHub Actions workflow detected for a GitHub repository',
      ['A GitHub remote is configured, but .github/workflows contains no YAML workflow files.'],
      'Consider a deterministic CI feedback loop for the checks agents are expected to satisfy.',
      7,
    ));
  }

  if (inventory.skillDirectories.length === 0) {
    findings.push(finding(
      'skills.none',
      'skills',
      'No repository-local agent skill directory detected',
      ['Checked common Claude/Codex/shared skill locations.'],
      'Do not add skills just for the score; add them only for repeated, procedural tasks that benefit from reusable instructions.',
      0,
      'info',
    ));
  }

  if (inventory.hookSurfaces.length === 0) {
    findings.push(finding(
      'tooling.no-hooks',
      'tooling',
      'No Claude hook surface detected',
      ['No .claude/hooks or Claude settings file was found in the repository.'],
      'Use deterministic hooks for requirements that must always run; do not rely on prompt reminders for enforceable checks.',
      0,
      'info',
    ));
  }

  if (!(await exists(path.join(root, '.rigx/config.json')))) {
    findings.push(finding(
      'privacy.uninitialized',
      'privacy',
      'RIGX privacy boundary has not been initialized',
      ['.rigx/config.json does not exist.'],
      'Run `rigx init` to create an explicit local privacy policy before enabling session observation.',
      10,
    ));
  }

  return findings;
}
