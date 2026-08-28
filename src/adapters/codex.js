import path from 'node:path';
import { exists, fileStats, findExecutable, homePath } from '../core/fs.js';

export async function detectCodex() {
  const localDataRoot = process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : homePath('.codex');
  const historySurface = path.join(localDataRoot, 'history.jsonl');
  const executable = await findExecutable('codex');
  const historyStats = await fileStats(historySurface);

  return {
    id: 'codex',
    label: 'Codex',
    installed: Boolean(executable) || await exists(localDataRoot),
    executable,
    localDataRoot,
    localDataExists: await exists(localDataRoot),
    sessionSurface: historySurface,
    sessionSurfaceExists: Boolean(historyStats),
    metadata: {
      historyBytes: historyStats?.bytes ?? 0,
      codexHomeOverridden: Boolean(process.env.CODEX_HOME),
      observation: 'filesystem metadata only',
    },
    contentRead: false,
  };
}
