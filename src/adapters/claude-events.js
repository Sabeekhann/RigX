import { createObservation } from '../core/observation.js';

const EVENT_MAP = new Map([
  ['SessionStart', ['session.start', null]],
  ['SessionEnd', ['session.end', null]],
  ['UserPromptSubmit', ['user.input', null]],
  ['PreToolUse', ['tool.start', null]],
  ['PostToolUse', ['tool.end', 'success']],
  ['PostToolUseFailure', ['tool.end', 'failure']],
  ['Stop', ['turn.end', null]],
  ['SubagentStart', ['subagent.start', null]],
  ['SubagentStop', ['subagent.end', null]],
]);

export function normalizeClaudeEvent(payload) {
  const sourceEvent = payload?.hook_event_name;
  const mapped = EVENT_MAP.get(sourceEvent);
  if (!mapped) return null;
  const [kind, outcome] = mapped;

  return createObservation({
    agent: 'claude-code',
    kind,
    timestamp: payload.timestamp,
    sessionId: payload.session_id,
    toolName: payload.tool_name,
    outcome,
    metadata: {
      sourceEvent,
      toolUseIdPresent: Boolean(payload.tool_use_id),
      errorPresent: sourceEvent === 'PostToolUseFailure',
      permissionDecision: typeof payload.permission_mode === 'string' ? payload.permission_mode : undefined,
    },
  });
}
