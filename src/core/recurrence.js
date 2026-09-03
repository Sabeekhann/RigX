export const RECURRENCE_SCHEMA_VERSION = 1;

const RECURRENCE_THRESHOLD = 3;
const SEARCH_HEAVY_MIN_CALLS = 6;
const SEARCH_HEAVY_MIN_SHARE = 0.5;

function confidenceForRecurrence(occurrences) {
  if (occurrences >= 10) return 'high';
  if (occurrences >= 5) return 'medium';
  return 'low';
}

function categoryCount(session, category) {
  return session.counts?.toolStartsByCategory?.[category] ?? 0;
}

function isSearchHeavy(session) {
  const searchCalls = categoryCount(session, 'search');
  const toolStarts = session.counts?.toolStarts ?? 0;
  if (toolStarts === 0) return false;
  return searchCalls >= SEARCH_HEAVY_MIN_CALLS && searchCalls / toolStarts >= SEARCH_HEAVY_MIN_SHARE;
}

function hasToolFailure(session) {
  return (session.counts?.toolFailures ?? 0) > 0;
}

function skipsVerification(session) {
  return categoryCount(session, 'filesystem') > 0 && categoryCount(session, 'verification') === 0;
}

function isHighVolumeWithoutChanges(session) {
  return (session.counts?.toolStarts ?? 0) >= 20 && categoryCount(session, 'filesystem') === 0;
}

function finding({ code, severity, occurrences, title, evidence, recommendation }) {
  return {
    code,
    severity,
    confidence: confidenceForRecurrence(occurrences),
    scope: 'cross-session',
    title,
    evidence,
    recommendation,
  };
}

export function analyzeRecurrence(sessions = []) {
  const totalSessions = sessions.length;
  const findings = [];

  const searchHeavyCount = sessions.filter(isSearchHeavy).length;
  if (searchHeavyCount >= RECURRENCE_THRESHOLD) {
    findings.push(finding({
      code: 'recurring-search-heavy-sessions',
      severity: 'info',
      occurrences: searchHeavyCount,
      title: 'Search-heavy sessions recur across multiple indexed sessions.',
      evidence: { sessions: totalSessions, occurrences: searchHeavyCount, share: Number((searchHeavyCount / totalSessions).toFixed(2)) },
      recommendation: 'Recurring search-heavy sessions are stronger evidence for improving navigation documentation or adding a focused skill than a single occurrence.',
    }));
  }

  const failureCount = sessions.filter(hasToolFailure).length;
  if (failureCount >= RECURRENCE_THRESHOLD) {
    findings.push(finding({
      code: 'recurring-tool-failures',
      severity: 'warning',
      occurrences: failureCount,
      title: 'Tool failures recur across multiple indexed sessions.',
      evidence: { sessions: totalSessions, occurrences: failureCount, share: Number((failureCount / totalSessions).toFixed(2)) },
      recommendation: 'Inspect the recurring failure boundary, permissions, or harness guidance rather than treating each session as an isolated incident.',
    }));
  }

  const skipCount = sessions.filter(skipsVerification).length;
  if (skipCount >= RECURRENCE_THRESHOLD) {
    findings.push(finding({
      code: 'recurring-verification-skips',
      severity: 'warning',
      occurrences: skipCount,
      title: 'Sessions that change files without running a verification command recur.',
      evidence: { sessions: totalSessions, occurrences: skipCount, share: Number((skipCount / totalSessions).toFixed(2)) },
      recommendation: 'Recurring, unverified file changes are stronger evidence for adding a required verification step (hook or CI) than a single session.',
    }));
  }

  const highVolumeCount = sessions.filter(isHighVolumeWithoutChanges).length;
  if (highVolumeCount >= RECURRENCE_THRESHOLD) {
    findings.push(finding({
      code: 'recurring-high-tool-volume-sessions',
      severity: 'info',
      occurrences: highVolumeCount,
      title: 'Sessions with high tool volume but no file changes recur.',
      evidence: { sessions: totalSessions, occurrences: highVolumeCount, share: Number((highVolumeCount / totalSessions).toFixed(2)) },
      recommendation: 'Recurring high-volume, no-change sessions are stronger evidence of context or navigation waste than a single occurrence; consider improving repository navigation documentation or deterministic tooling.',
    }));
  }

  return {
    schemaVersion: RECURRENCE_SCHEMA_VERSION,
    analyzedSessions: totalSessions,
    findings,
  };
}

export function compareAgents(sessions = []) {
  const byAgent = new Map();
  for (const session of sessions) {
    const agent = session.agent ?? 'unknown';
    if (!byAgent.has(agent)) byAgent.set(agent, []);
    byAgent.get(agent).push(session);
  }

  const agents = {};
  for (const [agent, agentSessions] of byAgent.entries()) {
    const total = agentSessions.length;
    const searchHeavy = agentSessions.filter(isSearchHeavy).length;
    const withFailures = agentSessions.filter(hasToolFailure).length;
    const verificationSkips = agentSessions.filter(skipsVerification).length;
    const highVolumeNoChanges = agentSessions.filter(isHighVolumeWithoutChanges).length;

    agents[agent] = {
      sessions: total,
      searchHeavyRate: total === 0 ? 0 : Number((searchHeavy / total).toFixed(2)),
      toolFailureRate: total === 0 ? 0 : Number((withFailures / total).toFixed(2)),
      verificationSkipRate: total === 0 ? 0 : Number((verificationSkips / total).toFixed(2)),
      highToolVolumeNoChangeRate: total === 0 ? 0 : Number((highVolumeNoChanges / total).toFixed(2)),
    };
  }

  return { schemaVersion: RECURRENCE_SCHEMA_VERSION, agents };
}
