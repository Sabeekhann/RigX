import path from 'node:path';
import { defaultConfig, loadConfig } from '../core/config.js';

export async function runPrivacy(rootInput, json = false) {
  const root = path.resolve(rootInput);
  const configured = await loadConfig(root);
  const config = configured ?? defaultConfig();

  if (json) return `${JSON.stringify({ initialized: Boolean(configured), privacy: config.privacy }, null, 2)}\n`;

  return [
    'RIGX Privacy',
    '────────────────────────────────────────',
    `Initialized: ${configured ? 'yes' : 'no (showing safe defaults)'}`,
    `Mode: ${config.privacy.mode}`,
    `Session observation: ${config.privacy.sessionObservation}`,
    `Network: ${config.privacy.network}`,
    '',
    `Persist raw prompts: ${config.privacy.persistRawPrompts ? 'yes' : 'no'}`,
    `Persist model responses: ${config.privacy.persistModelResponses ? 'yes' : 'no'}`,
    `Persist source code: ${config.privacy.persistSourceCode ? 'yes' : 'no'}`,
    `Persist terminal output: ${config.privacy.persistTerminalOutput ? 'yes' : 'no'}`,
    `Persist full paths: ${config.privacy.persistFullPaths ? 'yes' : 'no'}`,
  ].join('\n');
}
