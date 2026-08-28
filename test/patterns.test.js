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

test('pattern engine returns no findings when deterministic thresholds are not crossed', () => {
  const result = analyzePatterns([
    event({ kind: 'tool.start', toolName: 'Read' }),
    event({ kind: 'tool.end', toolName: 'Read', outcome: 'success' }),
  ]);
  assert.equal(result.findings.length, 0);
});
