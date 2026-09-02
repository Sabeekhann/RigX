import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const expectedVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'rigx-package-smoke-'));
const packDir = path.join(tempRoot, 'pack');
const consumerDir = path.join(tempRoot, 'consumer');
mkdirSync(packDir, { recursive: true });
mkdirSync(consumerDir, { recursive: true });

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is unavailable; run this check through npm.');

function runNode(args, cwd, options = {}) {
  return execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  });
}

function npm(args, cwd, options = {}) {
  return runNode([npmCli, ...args], cwd, options);
}

try {
  const packageName = npm(['pack', '--silent', '--pack-destination', packDir], root, { capture: true }).trim().split(/\r?\n/).at(-1);
  if (!packageName) throw new Error('npm pack did not return a package filename.');

  const packagePath = path.join(packDir, packageName);
  npm(['init', '-y'], consumerDir, { capture: true });
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', packagePath], consumerDir, { capture: true });

  const version = npm(['exec', '--yes=false', '--', 'rigx', '--version'], consumerDir, { capture: true }).trim();
  if (version !== expectedVersion) {
    throw new Error(`Installed CLI reported unexpected version: ${version} (expected ${expectedVersion})`);
  }

  npm(['exec', '--yes=false', '--', 'rigx', '--help'], consumerDir, { capture: true });
  process.stdout.write(`Packed package smoke test passed (${packageName}).\n`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
