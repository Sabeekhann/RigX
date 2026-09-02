import assert from 'node:assert/strict';
import test from 'node:test';
import { isVerificationCommand } from '../src/core/verification.js';

test('recognizes common test/lint/build commands as verification', () => {
  assert.equal(isVerificationCommand('npm test'), true);
  assert.equal(isVerificationCommand('npm run lint'), true);
  assert.equal(isVerificationCommand('npm run build'), true);
  assert.equal(isVerificationCommand('pytest -k thing'), true);
  assert.equal(isVerificationCommand('go test ./...'), true);
  assert.equal(isVerificationCommand('cargo test'), true);
  assert.equal(isVerificationCommand('yarn lint'), true);
  assert.equal(isVerificationCommand('npx vitest run'), true);
  assert.equal(isVerificationCommand('tsc --noEmit'), true);
});

test('does not classify unrelated shell commands as verification', () => {
  assert.equal(isVerificationCommand('ls -la'), false);
  assert.equal(isVerificationCommand('git status'), false);
  assert.equal(isVerificationCommand('npm install'), false);
  assert.equal(isVerificationCommand(''), false);
  assert.equal(isVerificationCommand(undefined), false);
  assert.equal(isVerificationCommand(null), false);
});
