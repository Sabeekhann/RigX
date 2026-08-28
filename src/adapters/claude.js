import path from 'node:path';
import { countFilesRecursive, exists, findExecutable, homePath } from '../core/fs.js';

export async function detectClaudeCode() {
  const localDataRoot = process.env.CLAUDE_CONFIG_DIR
    ? path.resolve(process.env.CLAUDE_CONFIG_DIR)
    : homePath('.claude');
  const projectSurface = path.join(localDataRoot, 'projects');
  const executable = await findExecutable('claude');
  const sessionCount = await countFilesRecursive(projectSurface, (name) => name.endsWith('.jsonl'), 2);

  return {
    id: 'claude-code',
    label: 'Claude Code',
    installed: Boolean(executable) || await exists(localDataRoot),
    executable,
    localDataRoot,
    localDataExists: await exists(localDataRoot),
    sessionSurface: projectSurface,
    sessionSurfaceExists: await exists(projectSurface),
    metadata: {
      transcriptFilesDetected: sessionCount,
      configDirOverridden: Boolean(process.env.CLAUDE_CONFIG_DIR),
      observation: 'filesystem metadata only',
    },
    contentRead: false,
  };
}
