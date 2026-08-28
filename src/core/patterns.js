export const PATTERN_SCHEMA_VERSION = 1;

function sessionKey(event) {
  return event.session ?? '__sessionless__';
}

function toolKey(event) {
  return event.tool?.name ?? '__unknown_tool__';
}

function newSessionSummary(session) {
  return {
    session,
    events: [],
    toolStarts: 0,
    toolEnds: 0,
    failures: 0,
    agentErrors: 0,
    sessionEnded: false,
    startsByTool: new Map(),
    failuresByTool: new Map(),
    startsByCategory: new Map(),
  };
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function publicSession(session) {
  return session === '__sessionless__' ? null : session;
}

function finding({ code, severity, session, title, evidence, recommendation }) {
  return {
    code,
    severity,
    session: publicSession(session),
    title,
    evidence,
    recommendation,
  };
}

function summarizeSession(events, session) {
  const summary = newSessionSummary(session);
  for (const event of events) {
    summary.events.push(event);
    if (event.kind === 'session.end') summary.sessionEnded = true;
    if (event.kind === 'agent.error') summary.agentErrors += 1;

    if (event.kind === 'tool.start') {
      summary.toolStarts += 1;
      increment(summary.startsByTool, toolKey(event));
      increment(summary.startsByCategory, event.tool?.category ?? 'other');
    }

    if (event.kind === 'tool.end') {
      summary.toolEnds += 1;
      if (event.outcome === 'failure') {
        summary.failures += 1;
        increment(summary.failuresByTool, toolKey(event));
      }
    }
  }
  return summary;
}

function analyzeSession(summary) {
  const findings = [];

  for (const [toolName, count] of summary.failuresByTool.entries()) {
    if (count < 2) continue;
    findings.push(finding({
      code: 'repeated-tool-failures',
      severity: 'warning',
      session: summary.session,
      title: 'The same tool failed repeatedly in one observed session.',
      evidence: { toolName: toolName === '__unknown_tool__' ? null : toolName, failures: count },
      recommendation: 'Inspect the failing tool boundary, permissions, or harness guidance before adding more prompt instructions.',
    }));
  }

  for (const [toolName, count] of summary.startsByTool.entries()) {
    if (count < 5) continue;
    findings.push(finding({
      code: 'high-tool-repetition',
      severity: 'info',
      session: summary.session,
      title: 'One tool was invoked many times in the supplied session.',
      evidence: { toolName: toolName === '__unknown_tool__' ? null : toolName, calls: count },
      recommendation: 'If this repeats across sessions, check whether repository navigation, skills, or deterministic tooling can remove repeated work.',
    }));
  }

  const searchStarts = summary.startsByCategory.get('search') ?? 0;
  const searchRatio = summary.toolStarts === 0 ? 0 : searchStarts / summary.toolStarts;
  if (searchStarts >= 6 && searchRatio >= 0.5) {
    findings.push(finding({
      code: 'search-heavy-session',
      severity: 'info',
      session: summary.session,
      title: 'Search activity dominated tool usage in the supplied session.',
      evidence: {
        searchCalls: searchStarts,
        toolCalls: summary.toolStarts,
        searchShare: Number(searchRatio.toFixed(2)),
      },
      recommendation: 'If this pattern recurs, improve architecture/navigation documentation or add a focused repository skill rather than assuming the agent needs a larger prompt.',
    }));
  }

  if (summary.agentErrors > 0) {
    findings.push(finding({
      code: 'agent-errors-observed',
      severity: 'warning',
      session: summary.session,
      title: 'Agent error events were observed.',
      evidence: { errors: summary.agentErrors },
      recommendation: 'Inspect the local source event stream for the underlying error content; strict RIGX findings intentionally do not retain it.',
    }));
  }

  if (summary.sessionEnded && summary.toolStarts > summary.toolEnds) {
    findings.push(finding({
      code: 'unclosed-tool-activity',
      severity: 'info',
      session: summary.session,
      title: 'The supplied stream ended with more tool starts than tool completions.',
      evidence: {
        toolStarts: summary.toolStarts,
        toolEnds: summary.toolEnds,
        unmatchedStarts: summary.toolStarts - summary.toolEnds,
      },
      recommendation: 'Check event/hook coverage before treating this as an agent failure; a partial observation stream can produce this signal.',
    }));
  }

  return findings;
}

export function analyzePatterns(events = []) {
  const sessions = new Map();
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const key = sessionKey(event);
    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key).push(event);
  }

  const summaries = [...sessions.entries()].map(([session, values]) => summarizeSession(values, session));
  const findings = summaries.flatMap(analyzeSession);

  return {
    schemaVersion: PATTERN_SCHEMA_VERSION,
    analyzedEvents: events.length,
    analyzedSessions: summaries.length,
    findings,
  };
}
