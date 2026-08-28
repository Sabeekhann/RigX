import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeClaudeEvent } from '../src/adapters/claude-events.js';
import { normalizeCodexEvent } from '../src/adapters/codex-events.js';
import { createObservation } from '../src/core/observation.js';

const SECRET = 'super-secret-private-value';

test('strict observations discard raw content and full paths', () => {
  const event = createObservation({
    agent: 'test-agent',
    kind: 'tool.start',
    sessionId: SECRET,
    toolName: 'Bash',
    metadata: {
      sourceEvent: 'PreToolUse',
      command: `curl https://example.com/${SECRET}`,
      cwd: `/Users/person/${SECRET}`,
      prompt: SECRET,
      output: SECRET,
    },
  });
  const serialized = JSON.stringify(event);
  assert.ok(event.session);
  assert.notEqual(event.session, SECRET);
  assert.equal(event.tool.category, 'shell');
  assert.ok(!serialized.includes(SECRET));
  assert.ok(!serialized.includes('/Users/person'));
  assert.ok(!serialized.includes('curl'));
});

test('Claude hook events normalize without retaining tool input or transcript paths', () => {
  const event = normalizeClaudeEvent({
    hook_event_name: 'PreToolUse',
    session_id: 'session-123',
    transcript_path: `/private/${SECRET}.jsonl`,
    cwd: `/repo/${SECRET}`,
    tool_name: 'Write',
    tool_use_id: 'tool-1',
    tool_input: { file_path: `/repo/${SECRET}.js`, content: SECRET },
  });
  const serialized = JSON.stringify(event);
  assert.equal(event.kind, 'tool.start');
  assert.equal(event.tool.name, 'Write');
  assert.equal(event.tool.category, 'filesystem');
  assert.equal(event.metadata.toolUseIdPresent, true);
  assert.ok(!serialized.includes(SECRET));
  assert.ok(!serialized.includes('transcript_path'));
  assert.ok(!serialized.includes('tool_input'));
});

test('Claude failure hook is represented as a failed tool end event', () => {
  const event = normalizeClaudeEvent({ hook_event_name: 'PostToolUseFailure', session_id: 'session-123', tool_name: 'Bash', error: SECRET });
  assert.equal(event.kind, 'tool.end');
  assert.equal(event.outcome, 'failure');
  assert.equal(event.metadata.errorPresent, true);
  assert.ok(!JSON.stringify(event).includes(SECRET));
});

test('Codex structured events normalize through the vendor adapter', () => {
  const event = normalizeCodexEvent({
    type: 'item.completed',
    thread_id: 'thread-123',
    item: { type: 'command_execution', command: SECRET, output: SECRET },
  });
  const serialized = JSON.stringify(event);
  assert.equal(event.agent, 'codex');
  assert.equal(event.kind, 'tool.end');
  assert.equal(event.outcome, 'success');
  assert.equal(event.tool.category, 'shell');
  assert.ok(!serialized.includes(SECRET));
});

test('unsupported vendor events are ignored instead of guessed', () => {
  assert.equal(normalizeClaudeEvent({ hook_event_name: 'SomethingNew' }), null);
  assert.equal(normalizeCodexEvent({ type: 'future.unknown.event' }), null);
});
