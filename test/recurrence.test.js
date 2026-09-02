import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeRecurrence, compareAgents } from '../src/core/recurrence.js';

function sessionFixture({
  agent = 'claude-code',
  session = 'session',
  toolStarts = 1,
  toolFailures = 0,
  categories = {},
} = {}) {
  return {
    agent,
    session,
    firstObservedAt: null,
    lastObservedAt: null,
    lifecycle: { started: true, ended: true },
    counts: {
      events: toolStarts,
      toolStarts,
      toolEnds: toolStarts,
      toolFailures,
      agentErrors: 0,
      toolStartsByCategory: {
        shell: 0, filesystem: 0, search: 0, network: 0, subagent: 0, verification: 0, other: 0,
        ...categories,
      },
    },
  };
}

test('analyzeRecurrence does not fire below the recurrence threshold', () => {
  const sessions = [
    sessionFixture({ session: 's1', toolFailures: 1 }),
    sessionFixture({ session: 's2', toolFailures: 1 }),
  ];
  const result = analyzeRecurrence(sessions);
  assert.equal(result.findings.length, 0);
});

test('analyzeRecurrence reports recurring tool failures at the threshold', () => {
  const sessions = ['s1', 's2', 's3'].map((session) => sessionFixture({ session, toolFailures: 1 }));
  const result = analyzeRecurrence(sessions);
  const finding = result.findings.find((item) => item.code === 'recurring-tool-failures');
  assert.ok(finding);
  assert.equal(finding.confidence, 'low');
  assert.deepEqual(finding.evidence, { sessions: 3, occurrences: 3, share: 1 });
});

test('analyzeRecurrence reports recurring search-heavy sessions', () => {
  const sessions = ['s1', 's2', 's3'].map((session) => sessionFixture({
    session,
    toolStarts: 10,
    categories: { search: 8 },
  }));
  const result = analyzeRecurrence(sessions);
  assert.ok(result.findings.some((item) => item.code === 'recurring-search-heavy-sessions'));
});

test('analyzeRecurrence reports recurring verification skips', () => {
  const sessions = ['s1', 's2', 's3'].map((session) => sessionFixture({
    session,
    categories: { filesystem: 2 },
  }));
  const result = analyzeRecurrence(sessions);
  const finding = result.findings.find((item) => item.code === 'recurring-verification-skips');
  assert.ok(finding);
});

test('analyzeRecurrence does not report a verification skip when verification ran', () => {
  const sessions = ['s1', 's2', 's3'].map((session) => sessionFixture({
    session,
    categories: { filesystem: 2, verification: 1 },
  }));
  const result = analyzeRecurrence(sessions);
  assert.ok(!result.findings.some((item) => item.code === 'recurring-verification-skips'));
});

test('confidence scales with occurrence count and share', () => {
  const low = analyzeRecurrence(['s1', 's2', 's3'].map((session) => sessionFixture({ session, toolFailures: 1 })));
  const medium = analyzeRecurrence(['s1', 's2', 's3', 's4', 's5'].map((session) => sessionFixture({ session, toolFailures: 1 })));
  const high = analyzeRecurrence(Array.from({ length: 10 }, (_, i) => sessionFixture({ session: `s${i}`, toolFailures: 1 })));

  assert.equal(low.findings.find((item) => item.code === 'recurring-tool-failures').confidence, 'low');
  assert.equal(medium.findings.find((item) => item.code === 'recurring-tool-failures').confidence, 'medium');
  assert.equal(high.findings.find((item) => item.code === 'recurring-tool-failures').confidence, 'high');
});

test('compareAgents partitions sessions by agent and computes per-agent rates', () => {
  const sessions = [
    sessionFixture({ agent: 'claude-code', session: 'c1', toolFailures: 1 }),
    sessionFixture({ agent: 'claude-code', session: 'c2' }),
    sessionFixture({ agent: 'codex', session: 'x1', categories: { filesystem: 1 } }),
  ];
  const result = compareAgents(sessions);
  assert.equal(result.agents['claude-code'].sessions, 2);
  assert.equal(result.agents['claude-code'].toolFailureRate, 0.5);
  assert.equal(result.agents.codex.sessions, 1);
  assert.equal(result.agents.codex.verificationSkipRate, 1);
});

test('compareAgents returns an empty object for no sessions', () => {
  assert.deepEqual(compareAgents([]).agents, {});
});
