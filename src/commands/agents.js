import { detectClaudeCode } from '../adapters/claude.js';
import { detectCodex } from '../adapters/codex.js';
import os from 'node:os';
import path from 'node:path';

function printablePath(value, strict) {
  if (!strict) return value;
  const home = path.resolve(os.homedir());
  const resolved = path.resolve(value);
  if (resolved === home) return '~';
  if (resolved.startsWith(`${home}${path.sep}`)) {
    return `~/${path.relative(home, resolved).replaceAll('\\', '/')}`;
  }
  return `<redacted>/${path.basename(resolved)}`;
}

function formatSurface(surface, strict) {
  const lines = [
    `${surface.label}: ${surface.installed ? 'detected' : 'not detected'}`,
    `  local data: ${surface.localDataExists ? 'yes' : 'no'}`,
    `  data root: ${printablePath(surface.localDataRoot, strict)}`,
    `  session surface: ${surface.sessionSurfaceExists ? 'detected' : 'not detected'}`,
    '  transcript content read: no',
  ];
  for (const [key, value] of Object.entries(surface.metadata)) lines.push(`  ${key}: ${value}`);
  return lines;
}

export async function runAgents(strict = true, json = false) {
  const surfaces = await Promise.all([detectClaudeCode(), detectCodex()]);
  if (json) {
    const safe = strict
      ? surfaces.map((surface) => ({
          ...surface,
          executable: surface.executable ? '<detected>' : undefined,
          localDataRoot: printablePath(surface.localDataRoot, true),
          sessionSurface: surface.sessionSurface ? printablePath(surface.sessionSurface, true) : undefined,
        }))
      : surfaces;
    return `${JSON.stringify(safe, null, 2)}\n`;
  }

  return [
    'RIGX Agent Surfaces',
    '────────────────────────────────────────',
    'Observation mode: metadata only',
    'Raw transcript content read: no',
    '',
    ...surfaces.flatMap((surface, index) => [
      ...formatSurface(surface, strict),
      ...(index < surfaces.length - 1 ? [''] : []),
    ]),
  ].join('\n');
}
