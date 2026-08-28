import { normalizeEventInput } from './event-input.js';

export async function runObserve({ agent, input = '-', json = false } = {}) {
  const events = await normalizeEventInput({ agent, input });

  if (json) return JSON.stringify({ schemaVersion: 1, events }, null, 2);
  if (events.length === 0) return 'RIGX Observe\n────────────────────────────────────────\nNo supported events found.';
  return events.map((event) => JSON.stringify(event)).join('\n');
}
