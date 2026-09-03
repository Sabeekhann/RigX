import { execFile } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { exists } from './fs.js';
import { inventoryRepository } from './scanner.js';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 10 * 1024 * 1024;

export const EVALUATION_SCHEMA_VERSION = 1;
const DEFAULT_SCRIPTS = ['test', 'lint', 'typecheck'];

async function git(args, cwd) {
  return execFileAsync('git', args, { cwd, maxBuffer: MAX_BUFFER });
}

async function resolveCommit(root, ref) {
  const { stdout } = await git(['rev-parse', '--verify', `${ref}^{commit}`], root);
  return stdout.trim();
}

// Detached-HEAD worktrees of a specific commit are allowed even when the
// branch that commit belongs to is checked out elsewhere -- resolving to a
// SHA first, rather than worktree-adding the ref by name, avoids git's
// "already checked out" refusal for the common baseline-vs-current-branch case.
export async function createWorktree(root, ref) {
  const commit = await resolveCommit(root, ref);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rigx-worktree-'));
  await rm(dir, { recursive: true, force: true });
  await git(['worktree', 'add', '--detach', dir, commit], root);

  const nodeModules = path.join(root, 'node_modules');
  if (await exists(nodeModules)) {
    try {
      await symlink(nodeModules, path.join(dir, 'node_modules'), 'dir');
    } catch {
      // Best-effort only: some platforms/permissions disallow symlinks, in
      // which case scripts requiring node_modules will fail deterministically
      // and that failure is reported like any other script result.
    }
  }

  return { dir, commit };
}

export async function removeWorktree(root, dir) {
  try {
    await git(['worktree', 'remove', '--force', dir], root);
  } catch {
    await rm(dir, { recursive: true, force: true });
  }
}

function runArgs(packageManager, script) {
  if (packageManager === 'npm' && script === 'test') return ['npm', ['test']];
  if (packageManager === 'yarn') return ['yarn', [script]];
  return [packageManager ?? 'npm', ['run', script]];
}

async function runScript(dir, packageManager, script) {
  const [command, args] = runArgs(packageManager, script);
  const startedAt = Date.now();
  try {
    // npm/yarn/pnpm/bun are .cmd shims on Windows; child_process.execFile
    // does not itself invoke a shell to interpret them (unlike a real .exe),
    // so it fails to run them there without shell:true. This only affects
    // Windows -- git is a real .exe everywhere and is invoked separately.
    await execFileAsync(command, args, { cwd: dir, maxBuffer: MAX_BUFFER, shell: process.platform === 'win32' });
    return { script, outcome: 'success', durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      script,
      outcome: 'failure',
      durationMs: Date.now() - startedAt,
      exitCode: Number.isInteger(error.code) ? error.code : null,
    };
  }
}

async function evaluateRef(root, ref, requestedScripts) {
  const { dir, commit } = await createWorktree(root, ref);
  try {
    const inventory = await inventoryRepository(dir);
    const available = new Set(inventory.packageScripts);
    const scripts = (requestedScripts ?? DEFAULT_SCRIPTS).filter((script) => available.has(script));

    const results = [];
    for (const script of scripts) results.push(await runScript(dir, inventory.packageManager, script));

    return { ref, commit, scripts: results };
  } finally {
    await removeWorktree(root, dir);
  }
}

function findRegressions(baseline, candidate) {
  const candidateByScript = new Map(candidate.scripts.map((item) => [item.script, item]));
  const regressions = [];
  for (const base of baseline.scripts) {
    const match = candidateByScript.get(base.script);
    if (base.outcome === 'success' && match?.outcome === 'failure') {
      regressions.push({ script: base.script, baseline: 'success', candidate: 'failure' });
    }
  }
  return regressions;
}

// Runs the repository's own deterministic verification scripts (test/lint/
// typecheck by default) against two isolated Git worktrees -- never the
// caller's actual working directory -- and reports pass/fail and duration
// per script, plus any success-to-failure regression between them.
//
// Dependencies are not reinstalled: node_modules is symlinked from the
// caller's working directory into each worktree when present, trading full
// reproducibility for a fast, local-only comparison. This assumes baseline
// and candidate do not differ in their dependency tree.
export async function compareRefs(root, baselineRef, candidateRef, scripts) {
  const baseline = await evaluateRef(root, baselineRef, scripts);
  const candidate = await evaluateRef(root, candidateRef, scripts);

  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    baseline,
    candidate,
    regressions: findRegressions(baseline, candidate),
  };
}
