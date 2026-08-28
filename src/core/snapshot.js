import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exists } from './fs.js';
import { loadConfig } from './config.js';

const LOCK_PATH = '.rigx/harness.lock.json';

const FILE_SURFACES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  '.mcp.json',
  '.vscode/mcp.json',
  '.github/copilot/mcp.json',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.rigx/config.json',
  'docs/architecture.md',
];

const DIRECTORY_SURFACES = [
  '.claude/hooks',
  '.claude/skills',
  '.agents/skills',
  '.codex/skills',
  '.cursor/rules',
  '.github/skills',
  '.github/workflows',
  'skills',
];

function normalizeRelative(value) {
  return value.replaceAll('\\', '/');
}

async function walkRegularFiles(root, current, output, depth = 0) {
  if (depth > 8) return;
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await walkRegularFiles(root, full, output, depth + 1);
      continue;
    }
    if (entry.isFile()) output.push(normalizeRelative(path.relative(root, full)));
  }
}

export async function listHarnessFiles(rootInput) {
  const root = path.resolve(rootInput);
  const files = [];

  for (const candidate of FILE_SURFACES) {
    if (await exists(path.join(root, candidate))) files.push(candidate);
  }

  for (const candidate of DIRECTORY_SURFACES) {
    const full = path.join(root, candidate);
    if (!(await exists(full))) continue;
    await walkRegularFiles(root, full, files);
  }

  return [...new Set(files)].sort();
}

async function hashFile(file) {
  const hash = createHash('sha256');
  let bytes = 0;
  const stream = createReadStream(file);
  for await (const chunk of stream) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { sha256: hash.digest('hex'), bytes };
}

async function verificationFingerprint(root) {
  let raw;
  try {
    raw = await readFile(path.join(root, 'package.json'), 'utf8');
  } catch {
    return { names: [], sha256: null };
  }

  try {
    const parsed = JSON.parse(raw);
    const scripts = parsed.scripts ?? {};
    const names = Object.keys(scripts).sort();
    const canonical = JSON.stringify(Object.fromEntries(names.map((name) => [name, scripts[name]])));
    return {
      names,
      sha256: createHash('sha256').update(canonical).digest('hex'),
    };
  } catch {
    return { names: [], sha256: null };
  }
}

export async function buildHarnessSnapshot(rootInput) {
  const root = path.resolve(rootInput);
  const config = await loadConfig(root);
  const files = [];
  for (const relativePath of await listHarnessFiles(root)) {
    const full = path.join(root, relativePath);
    const info = await lstat(full);
    if (!info.isFile()) continue;
    const hashed = await hashFile(full);
    files.push({ path: relativePath, ...hashed });
  }

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    privacyMode: config?.privacy?.mode ?? 'strict',
    contentStored: false,
    files,
    verification: await verificationFingerprint(root),
  };
}

export async function writeHarnessSnapshot(rootInput) {
  const root = path.resolve(rootInput);
  const snapshot = await buildHarnessSnapshot(root);
  const target = path.join(root, LOCK_PATH);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return { target, snapshot };
}

export async function readHarnessSnapshot(rootInput) {
  const root = path.resolve(rootInput);
  try {
    const raw = await readFile(path.join(root, LOCK_PATH), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function compareHarnessSnapshot(rootInput) {
  const root = path.resolve(rootInput);
  const baseline = await readHarnessSnapshot(root);
  if (!baseline) return { hasBaseline: false, added: [], removed: [], changed: [], verificationChanged: false };

  const current = await buildHarnessSnapshot(root);
  const before = new Map(baseline.files.map((item) => [item.path, item]));
  const after = new Map(current.files.map((item) => [item.path, item]));
  const added = [...after.keys()].filter((item) => !before.has(item));
  const removed = [...before.keys()].filter((item) => !after.has(item));
  const changed = [...after.keys()].filter((item) => before.has(item) && before.get(item).sha256 !== after.get(item).sha256);

  return {
    hasBaseline: true,
    baselineCreatedAt: baseline.createdAt,
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
    verificationChanged: baseline.verification?.sha256 !== current.verification?.sha256,
    clean: added.length === 0 && removed.length === 0 && changed.length === 0 && baseline.verification?.sha256 === current.verification?.sha256,
  };
}
