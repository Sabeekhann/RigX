import { access, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function exists(target) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function fileStats(target) {
  try {
    const value = await stat(target);
    return { bytes: value.size, mtimeMs: value.mtimeMs };
  } catch {
    return null;
  }
}

export async function countFilesRecursive(dir, predicate, maxDepth = 3) {
  async function walk(current, depth) {
    if (depth > maxDepth) return 0;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return 0;
    }

    let total = 0;
    for (const entry of entries) {
      if (entry.name.startsWith('.') && depth > 0) continue;
      const full = path.join(current, entry.name);
      if (entry.isFile() && predicate(entry.name)) total += 1;
      if (entry.isDirectory()) total += await walk(full, depth + 1);
    }
    return total;
  }

  return walk(dir, 0);
}

export function homePath(...parts) {
  return path.join(os.homedir(), ...parts);
}

export async function findExecutable(name) {
  const envPath = process.env.PATH ?? '';
  const extensions = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  for (const dir of envPath.split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, `${name}${extension}`);
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Keep looking.
      }
    }
  }
  return undefined;
}
