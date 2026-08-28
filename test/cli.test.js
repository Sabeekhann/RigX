import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli } from '../src/cli.js';

async function capture(stream, fn) {
  let value = '';
  const original = stream.write;
  stream.write = (chunk) => {
    value += String(chunk);
    return true;
  };
  try {
    const code = await fn();
    return { code, value };
  } finally {
    stream.write = original;
  }
}

test('version reports the package alpha version', async () => {
  const result = await capture(process.stdout, () => runCli(['--version']));
  assert.equal(result.code, 0);
  assert.equal(result.value.trim(), '0.1.0-alpha.1');
});

test('help documents the deterministic alpha command surface', async () => {
  const result = await capture(process.stdout, () => runCli(['--help']));
  assert.equal(result.code, 0);
  for (const command of ['init', 'doctor', 'agents', 'privacy', 'observe', 'patterns', 'index', 'snapshot', 'status']) {
    assert.match(result.value, new RegExp(`rigx ${command}`));
  }
});
