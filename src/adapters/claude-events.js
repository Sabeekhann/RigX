import { createObservation } from '../core/observation.js';
import { isVerificationCommand } from '../core/verification.js';

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

// Reads the raw command only long enough to classify it; the string itself is
// never forwarded into the returned observation.
function toolCategoryOverride(payload) {
  const command = payload?.tool_input?.command;
  return isVerificationCommand(command) ? 'verification' : undefined;
}

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
    toolCategoryOverride: toolCategoryOverride(payload),
    metadata: {
      sourceEvent,
      toolUseIdPresent: Boolean(payload.tool_use_id),
      errorPresent: sourceEvent === 'PostToolUseFailure',
      permissionDecision: typeof payload.permission_mode === 'string' ? payload.permission_mode : undefined,
    },
  });
}
