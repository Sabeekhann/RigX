import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeDefaultConfig } from '../core/config.js';

const LOCAL_README = `# RIGX local state\n\nThis directory defines RIGX's local privacy boundary for this repository.\n\nDefault mode is **strict**:\n\n- no telemetry\n- no network uploads\n- no raw prompt persistence\n- no model-response persistence\n- no source-code persistence\n- no terminal-output persistence\n- no full session-path persistence\n- agent session observation is metadata-only\n\nGenerated proposals, caches, and session-derived local state should stay under ignored subdirectories unless you explicitly decide to commit an artifact.\n`;
const LOCAL_GITIGNORE = `state/\ncache/\nsessions/\n`;

async function writeIfMissing(file, content) {
  try {
    await readFile(file, 'utf8');
  } catch {
    await writeFile(file, content, 'utf8');
  }
}

export async function runInit(rootInput, force = false) {
  const root = path.resolve(rootInput);
  const dir = path.join(root, '.rigx');
  await mkdir(dir, { recursive: true });
  const result = await writeDefaultConfig(root, force);
  await writeIfMissing(path.join(dir, 'README.md'), LOCAL_README);
  await writeIfMissing(path.join(dir, '.gitignore'), LOCAL_GITIGNORE);

  return [
    result.created ? 'RIGX initialized.' : 'RIGX was already initialized.',
    `Config: ${path.relative(root, result.path)}`,
    'Privacy mode: strict',
    'Network uploads: denied',
    'Session observation: metadata only',
    '',
    'Next: rigx doctor .',
  ].join('\n');
}
