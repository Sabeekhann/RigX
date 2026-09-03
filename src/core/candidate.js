import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exists } from './fs.js';
import { createWorktree, removeWorktree, runScript } from './evaluation.js';
import { inventoryRepository } from './scanner.js';

export const CANDIDATE_SCHEMA_VERSION = 1;

// Applies a proposal's `patch` (see src/core/proposals.js) inside `dir`, which
// must always be a throwaway worktree, never the caller's real working
// directory. Supported patch types are the only ones proposals.js emits:
//
//   json-merge  -- shallow-merge `values` into the object at `mergePath`
//                  within a JSON file (currently only package.json scripts).
//   create-file -- write `content` to `file`, refusing to overwrite an
//                  existing file so a stale worktree can't mask a real
//                  conflict as a pass.
async function applyPatch(dir, patch) {
  const target = path.join(dir, patch.file);

  if (patch.type === 'json-merge') {
    const raw = JSON.parse(await readFile(target, 'utf8'));
    let cursor = raw;
    for (const key of patch.mergePath) {
      cursor[key] = cursor[key] ?? {};
      cursor = cursor[key];
    }
    Object.assign(cursor, patch.values);
    await writeFile(target, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    return;
  }

  if (patch.type === 'create-file') {
    if (await exists(target)) {
      throw new Error(`Refusing to overwrite existing file: ${patch.file}`);
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, patch.content, 'utf8');
    return;
  }

  throw new Error(`Unsupported patch type: ${patch.type}`);
}

// Verifies an already-applied patch actually works. A json-merge patch that
// adds package.json scripts is verifiable by running each added script; a
// create-file patch (e.g. a CI workflow) has nothing RIGX can execute
// locally, so it is reported as applied-but-unverified rather than assumed
// to work.
async function verifyPatch(dir, patch, packageManager) {
  if (patch.type === 'json-merge') {
    const scripts = [];
    for (const script of Object.keys(patch.values)) {
      scripts.push(await runScript(dir, packageManager, script));
    }
    return { verified: scripts.every((item) => item.outcome === 'success'), scripts };
  }

  return { verified: null, scripts: [], note: 'This patch type has no locally executable verification step.' };
}

// Applies one proposal's patch inside an isolated worktree of `ref`, runs
// whatever verification is possible, and always discards the worktree --
// the caller's actual repository is never touched. `proposal` comes from
// generateProposals() in src/core/proposals.js.
export async function evaluateCandidate(root, ref, proposal) {
  if (!proposal.patch) {
    return {
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      proposalId: proposal.id,
      outcome: 'unsupported',
      message: 'This proposal has no literal file patch to apply and verify automatically; it requires manual review.',
    };
  }

  const { dir } = await createWorktree(root, ref);
  try {
    await applyPatch(dir, proposal.patch);
    const inventory = await inventoryRepository(dir);
    const result = await verifyPatch(dir, proposal.patch, inventory.packageManager);

    return {
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      proposalId: proposal.id,
      outcome: result.verified === false ? 'failed' : 'applied',
      verified: result.verified,
      scripts: result.scripts,
      note: result.note ?? null,
    };
  } catch (error) {
    return {
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      proposalId: proposal.id,
      outcome: 'error',
      message: error.message,
    };
  } finally {
    await removeWorktree(root, dir);
  }
}
