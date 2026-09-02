import { createHash } from 'node:crypto';

export const OBSERVATION_SCHEMA_VERSION = 1;

const ALLOWED_METADATA_KEYS = new Set([
  'durationMs',
  'exitCode',
  'retryCount',
  'attempt',
  'toolUseIdPresent',
  'errorPresent',
  'permissionDecision',
  'sourceEvent',
]);

export function opaqueId(value) {
  if (value === undefined || value === null || value === '') return null;
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 20);
}

const CATEGORY_OVERRIDES = new Set(['verification']);

export function classifyTool(toolName, categoryOverride) {
  if (CATEGORY_OVERRIDES.has(categoryOverride)) return categoryOverride;
  const name = String(toolName ?? '').toLowerCase();
  if (!name) return null;
  if (['bash', 'shell', 'terminal', 'exec', 'command_execution'].some((part) => name.includes(part))) return 'shell';
  if (['read', 'write', 'edit', 'patch', 'file'].some((part) => name.includes(part))) return 'filesystem';
  if (['grep', 'glob', 'search', 'find'].some((part) => name.includes(part))) return 'search';
  if (['web', 'http', 'browser', 'fetch'].some((part) => name.includes(part))) return 'network';
  if (['task', 'subagent', 'agent'].some((part) => name.includes(part))) return 'subagent';
  return 'other';
}

export function sanitizeMetadata(metadata = {}) {
  const result = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) result[key] = value;
  }
  return result;
}

export function createObservation({ agent, kind, timestamp, sessionId, toolName, outcome, metadata = {}, toolCategoryOverride }) {
  if (!agent) throw new Error('Observation agent is required.');
  if (!kind) throw new Error('Observation kind is required.');

  const safeToolName = toolName ? String(toolName).slice(0, 120) : null;
  return {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    agent: String(agent),
    kind: String(kind),
    timestamp: timestamp ? new Date(timestamp).toISOString() : null,
    session: opaqueId(sessionId),
    tool: safeToolName ? { name: safeToolName, category: classifyTool(safeToolName, toolCategoryOverride) } : null,
    outcome: outcome ?? null,
    metadata: sanitizeMetadata(metadata),
    privacy: { mode: 'strict', rawContentStored: false, fullPathsStored: false },
  };
}
