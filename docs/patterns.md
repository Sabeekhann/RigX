# RIGX deterministic session patterns

`rigx patterns` is the first diagnostic layer on top of the normalized observation stream. It analyzes only privacy-safe normalized metadata produced from explicitly supplied Claude Code or Codex events.

It does not crawl transcript history, call an LLM, persist events, or make network requests.

## Usage

```bash
cat claude-hook-events.ndjson | rigx patterns --agent claude-code
rigx patterns --agent codex --input codex-events.ndjson --json
```

Input uses the same explicit NDJSON boundary as `rigx observe`.

## Current detectors

### Repeated tool failures

Fires when the same normalized tool records at least two failed completions in one observed session.

Evidence includes only the tool name and failure count.

### High tool repetition

Fires as informational evidence when one tool is started at least five times in one observed session.

A single session is not enough to conclude that the harness is weak, so the recommendation explicitly asks users to look for recurrence before changing the harness.

### Search-heavy session

Fires when search-category tools are started at least six times and account for at least half of observed tool starts.

This is a navigation-friction signal, not proof of a documentation problem. Repeated occurrences across sessions are stronger evidence for improving architecture/navigation documentation or adding a focused skill.

### Agent errors observed

Fires when normalized `agent.error` events are present. Strict output stores only the count; underlying error text remains outside the RIGX finding.

### Unclosed tool activity

Fires when a supplied stream contains `session.end` but more tool starts than tool completions. This is deliberately informational because incomplete hook/event coverage can produce the same shape.

### Retry after failure

Fires when a tool records a failed completion and is later started again for the same normalized tool name in the same session. Evidence includes the tool name and retry count; severity is informational for a single retry and a warning at two or more, since a single retry can be normal recovery.

### Unretried verification failure

Fires when the last observed `verification`-category tool call in a session ended in failure and the session ended without a later verification-category start for that tool. Verification classification is derived from the shell command text at adapter time (matching known test/lint/build/typecheck commands) and the raw command is discarded immediately — it is never present in the finding or any persisted state.

### Verification skipped

Fires when a session records at least one `filesystem`-category tool start (a file was changed) but ends with zero `verification`-category tool starts. This is deliberately low-confidence and informational: it says no verification command was *observed*, not that the agent skipped one — event coverage can be partial. See [recurrence.md](recurrence.md) for the cross-session version of this signal, which is stronger evidence when it recurs.

## Evidence contract

Every finding contains:

- a stable detector code;
- severity;
- a `confidence` level (`low`, `medium`, or `high`) reflecting how strong the evidence is on its own — a single-session finding is rarely more than `low`/`medium`; recurrence across sessions (see [recurrence.md](recurrence.md)) is what earns higher confidence;
- opaque session identifier when available;
- deterministic evidence values;
- a recommendation that does not overstate what the evidence proves.

RIGX intentionally avoids claims such as “the agent skipped verification” until the observation schema contains enough deterministic evidence to support that statement.

## Privacy

Findings operate on normalized events only. They do not contain raw prompts, responses, commands, source snippets, tool input/output, transcript paths, working directories, file paths, or raw session IDs.

`rigx patterns` currently writes findings to stdout and does not persist them.
