import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePatterns } from '../src/core/patterns.js';
import { createObservation } from '../src/core/observation.js';

function event({ kind, sessionId = 'session-a', toolName, outcome }) {
  return createObservation({ agent: 'test-agent', kind, sessionId, toolName, outcome });
}

test('pattern engine reports repeated failures with deterministic evidence', () => {
  const result = analyzePatterns([
    event({ kind: 'tool.end', toolName: 'Bash', outcome: 'failure' }),
    event({ kind: 'tool.end', toolName: 'Bash', outcome: 'failure' }),
  ]);
  const finding = result.findings.find((item) => item.code === 'repeated-tool-failures');
  assert.ok(finding);
  assert.equal(finding.severity, 'warning');
  assert.deepEqual(finding.evidence, { toolName: 'Bash', failures: 2 });
});

test('pattern engine reports high repetition and search-heavy sessions only above thresholds', () => {
  const events = Array.from({ length: 6 }, () => event({ kind: 'tool.start', toolName: 'Grep' }));
  const result = analyzePatterns(events);
  assert.ok(result.findings.some((item) => item.code === 'high-tool-repetition'));
  assert.ok(result.findings.some((item) => item.code === 'search-heavy-session'));
});

test('pattern engine treats unmatched tool starts as observation coverage evidence', () => {
  const result = analyzePatterns([
    event({ kind: 'tool.start', toolName: 'Read' }),
    event({ kind: 'session.end' }),
  ]);
  const finding = result.findings.find((item) => item.code === 'unclosed-tool-activity');
  assert.ok(finding);
  assert.equal(finding.severity, 'info');
  assert.equal(finding.evidence.unmatchedStarts, 1);
});

test('pattern findings do not contain raw session identifiers or source content', () => {
  const secret = 'private-session-value-71c9';
  const result = analyzePatterns([
    createObservation({
      agent: 'test-agent',
      kind: 'agent.error',
      sessionId: secret,
      metadata: { output: secret, prompt: secret },
    }),
  ]);
  const serialized = JSON.stringify(result);
  assert.ok(result.findings.some((item) => item.code === 'agent-errors-observed'));
  assert.ok(!serialized.includes(secret));
});

test('pattern engine reports a retry after a tool failure is followed by another start', () => {
  const result = analyzePatterns([
    event({ kind: 'tool.start', toolName: 'Bash' }),
    event({ kind: 'tool.end', toolName: 'Bash', outcome: 'failure' }),
    event({ kind: 'tool.start', toolName: 'Bash' }),
  ]);
  const finding = result.findings.find((item) => item.code === 'retry-after-failure');
  assert.ok(finding);
  assert.equal(finding.severity, 'info');
  assert.deepEqual(finding.evidence, { toolName: 'Bash', retries: 1 });
});

test('pattern engine does not report a retry when a tool succeeds without a prior failure', () => {
  const result = analyzePatterns([
    event({ kind: 'tool.start', toolName: 'Bash' }),
    event({ kind: 'tool.end', toolName: 'Bash', outcome: 'success' }),
    event({ kind: 'tool.start', toolName: 'Bash' }),
  ]);
  assert.ok(!result.findings.some((item) => item.code === 'retry-after-failure'));
});

function verificationEvent({ kind, outcome, sessionId = 'session-a' }) {
  return createObservation({
    agent: 'test-agent',
    kind,
    sessionId,
    toolName: 'Bash',
    outcome,
    toolCategoryOverride: 'verification',
  });
}

test('pattern engine reports an unretried verification failure at the end of a session', () => {
  const result = analyzePatterns([
    verificationEvent({ kind: 'tool.start' }),
    verificationEvent({ kind: 'tool.end', outcome: 'failure' }),
    event({ kind: 'session.end' }),
  ]);
  const finding = result.findings.find((item) => item.code === 'unretried-verification-failure');
  assert.ok(finding);
  assert.equal(finding.severity, 'warning');
  assert.deepEqual(finding.evidence, { toolName: 'Bash' });
});

test('pattern engine does not report an unretried verification failure when it is later retried', () => {
  const result = analyzePatterns([
    verificationEvent({ kind: 'tool.start' }),
    verificationEvent({ kind: 'tool.end', outcome: 'failure' }),
    verificationEvent({ kind: 'tool.start' }),
    verificationEvent({ kind: 'tool.end', outcome: 'success' }),
    event({ kind: 'session.end' }),
  ]);
  assert.ok(!result.findings.some((item) => item.code === 'unretried-verification-failure'));
});

test('pattern engine returns no findings when deterministic thresholds are not crossed', () => {
  const result = analyzePatterns([
    event({ kind: 'tool.start', toolName: 'Read' }),
    event({ kind: 'tool.end', toolName: 'Read', outcome: 'success' }),
  ]);
  assert.equal(result.findings.length, 0);
});
