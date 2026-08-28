import { createObservation } from '../core/observation.js';

function eventType(payload) {
  return payload?.type ?? payload?.method ?? payload?.event ?? null;
}

function mapType(type) {
  switch (type) {
    case 'agent-turn-complete': return ['turn.end', 'success'];
    case 'turn.started': return ['turn.start', null];
    case 'turn.completed': return ['turn.end', 'success'];
    case 'turn.failed': return ['turn.end', 'failure'];
    case 'item.started': return ['tool.start', null];
    case 'item.completed': return ['tool.end', 'success'];
    case 'item.failed': return ['tool.end', 'failure'];
    case 'error': return ['agent.error', 'failure'];
    default: return null;
  }
}

function toolName(payload) {
  return payload?.item?.type ?? payload?.item?.name ?? payload?.tool_name ?? payload?.tool ?? null;
}

export function normalizeCodexEvent(payload) {
  const sourceEvent = eventType(payload);
  const mapped = mapType(sourceEvent);
  if (!mapped) return null;
  const [kind, outcome] = mapped;

  return createObservation({
    agent: 'codex',
    kind,
    timestamp: payload.timestamp,
    sessionId: payload.thread_id ?? payload.session_id ?? payload.conversation_id,
    toolName: toolName(payload),
    outcome,
    metadata: {
      sourceEvent,
      errorPresent: outcome === 'failure',
      exitCode: Number.isInteger(payload.exit_code) ? payload.exit_code : undefined,
    },
  });
}
