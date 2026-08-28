import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'rigx-package-smoke-'));
const packDir = path.join(tempRoot, 'pack');
const consumerDir = path.join(tempRoot, 'consumer');
mkdirSync(packDir, { recursive: true });
mkdirSync(consumerDir, { recursive: true });

function run(file, args, cwd, options = {}) {
  return execFileSync(file, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  });
}

try {
  const packageName = run('npm', ['pack', '--silent', '--pack-destination', packDir], root, { capture: true }).trim().split(/\r?\n/).at(-1);
  if (!packageName) throw new Error('npm pack did not return a package filename.');

  const packagePath = path.join(packDir, packageName);
  run('npm', ['init', '-y'], consumerDir, { capture: true });
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', packagePath], consumerDir, { capture: true });

  const cli = process.platform === 'win32'
    ? path.join(consumerDir, 'node_modules', '.bin', 'rigx.cmd')
    : path.join(consumerDir, 'node_modules', '.bin', 'rigx');
  const version = run(cli, ['--version'], consumerDir, { capture: true }).trim();
  if (version !== '0.1.0-alpha.1') {
    throw new Error(`Installed CLI reported unexpected version: ${version}`);
  }

  run(cli, ['--help'], consumerDir, { capture: true });
  process.stdout.write(`Packed package smoke test passed (${packageName}).\n`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
