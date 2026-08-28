import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CONFIG_DIR = '.rigx';
export const CONFIG_FILE = 'config.json';

export function defaultConfig() {
  return {
    schemaVersion: 1,
    privacy: {
      mode: 'strict',
      sessionObservation: 'metadata-only',
      persistRawPrompts: false,
      persistModelResponses: false,
      persistSourceCode: false,
      persistTerminalOutput: false,
      persistFullPaths: false,
      network: 'deny',
    },
    agents: {
      claudeCode: true,
      codex: true,
    },
  };
}

export function configPath(root) {
  return path.join(root, CONFIG_DIR, CONFIG_FILE);
}

export async function loadConfig(root) {
  try {
    const raw = await readFile(configPath(root), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== 1 || !parsed.privacy || !parsed.agents) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeDefaultConfig(root, force = false) {
  const dir = path.join(root, CONFIG_DIR);
  const file = configPath(root);
  await mkdir(dir, { recursive: true });

  if (!force) {
    try {
      await readFile(file, 'utf8');
      return { path: file, created: false };
    } catch {
      // Continue and create it.
    }
  }

  await writeFile(file, `${JSON.stringify(defaultConfig(), null, 2)}\n`, 'utf8');
  return { path: file, created: true };
}
