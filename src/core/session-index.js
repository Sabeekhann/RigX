import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG_DIR, loadConfig } from './config.js';

export const SESSION_INDEX_SCHEMA_VERSION = 1;
export const SESSION_INDEX_FILE = 'session-index.json';

const TOOL_CATEGORIES = ['shell', 'filesystem', 'search', 'network', 'subagent', 'other'];

function emptyCounts() {
  return {
    events: 0,
    toolStarts: 0,
    toolEnds: 0,
    toolFailures: 0,
    agentErrors: 0,
    toolStartsByCategory: Object.fromEntries(TOOL_CATEGORIES.map((category) => [category, 0])),
  };
}

function summarizeSession(agent, session, events) {
  const timestamps = events.map((event) => event.timestamp).filter(Boolean).sort();
  const counts = emptyCounts();
  let started = false;
  let ended = false;

  for (const event of events) {
    counts.events += 1;
    if (event.kind === 'session.start') started = true;
    if (event.kind === 'session.end') ended = true;
    if (event.kind === 'agent.error') counts.agentErrors += 1;
    if (event.kind === 'tool.start') {
      counts.toolStarts += 1;
      if (event.tool?.category && Object.hasOwn(counts.toolStartsByCategory, event.tool.category)) {
        counts.toolStartsByCategory[event.tool.category] += 1;
      }
    }
    if (event.kind === 'tool.end') {
      counts.toolEnds += 1;
      if (event.outcome === 'failure') counts.toolFailures += 1;
    }
  }

  return {
    agent,
    session,
    firstObservedAt: timestamps[0] ?? null,
    lastObservedAt: timestamps.at(-1) ?? null,
    lifecycle: { started, ended },
    counts,
  };
}

export function buildSessionSummaries(events = []) {
  const groups = new Map();
  for (const event of events) {
    if (!event?.agent || !event?.session) continue;
    const key = `${event.agent}:${event.session}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }

  return [...groups.values()]
    .map((values) => summarizeSession(values[0].agent, values[0].session, values))
    .sort((left, right) => `${left.agent}:${left.session}`.localeCompare(`${right.agent}:${right.session}`));
}

export function sessionIndexPath(root) {
  return path.join(root, CONFIG_DIR, 'state', SESSION_INDEX_FILE);
}

function storedSummary(item) {
  if (!['claude-code', 'codex'].includes(item?.agent) || !/^[a-f0-9]{20}$/.test(item?.session ?? '')) {
    throw new Error('Session index contains an invalid strict-mode session entry.');
  }
  const numeric = ['events', 'toolStarts', 'toolEnds', 'toolFailures', 'agentErrors'];
  if (numeric.some((key) => !Number.isInteger(item.counts?.[key]) || item.counts[key] < 0)) {
    throw new Error('Session index contains invalid event counts.');
  }
  if (TOOL_CATEGORIES.some((category) => !Number.isInteger(item.counts?.toolStartsByCategory?.[category]) || item.counts.toolStartsByCategory[category] < 0)) {
    throw new Error('Session index contains invalid tool-category counts.');
  }

  return {
    agent: item.agent,
    session: item.session,
    firstObservedAt: typeof item.firstObservedAt === 'string' ? item.firstObservedAt : null,
    lastObservedAt: typeof item.lastObservedAt === 'string' ? item.lastObservedAt : null,
    lifecycle: { started: item.lifecycle?.started === true, ended: item.lifecycle?.ended === true },
    counts: {
      events: item.counts.events,
      toolStarts: item.counts.toolStarts,
      toolEnds: item.counts.toolEnds,
      toolFailures: item.counts.toolFailures,
      agentErrors: item.counts.agentErrors,
      toolStartsByCategory: Object.fromEntries(TOOL_CATEGORIES.map((category) => [category, item.counts.toolStartsByCategory[category]])),
    },
  };
}

async function readIndex(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    if (parsed.schemaVersion !== SESSION_INDEX_SCHEMA_VERSION || !Array.isArray(parsed.sessions)) {
      throw new Error('Unsupported or invalid session index schema.');
    }
    return { ...parsed, sessions: parsed.sessions.map(storedSummary) };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        schemaVersion: SESSION_INDEX_SCHEMA_VERSION,
        privacy: { mode: 'strict', rawContentStored: false, fullPathsStored: false },
        sessions: [],
      };
    }
    throw error;
  }
}

export async function writeSessionIndex(root, events = []) {
  const config = await loadConfig(root);
  if (config?.privacy?.mode !== 'strict' || config.privacy.sessionObservation !== 'metadata-only') {
    throw new Error('Run `rigx init .` before indexing sessions; strict metadata-only mode is required.');
  }

  const file = sessionIndexPath(root);
  const current = await readIndex(file);
  const sessions = new Map(current.sessions.map((item) => [`${item.agent}:${item.session}`, item]));
  const supplied = buildSessionSummaries(events);
  for (const item of supplied) sessions.set(`${item.agent}:${item.session}`, item);

  const index = {
    schemaVersion: SESSION_INDEX_SCHEMA_VERSION,
    privacy: { mode: 'strict', rawContentStored: false, fullPathsStored: false },
    sessions: [...sessions.values()].sort((left, right) => `${left.agent}:${left.session}`.localeCompare(`${right.agent}:${right.session}`)),
  };

  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
  return { file, indexedSessions: supplied.length, totalSessions: index.sessions.length, index };
}
