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

## Evidence contract

Every finding contains:

- a stable detector code;
- severity;
- opaque session identifier when available;
- deterministic evidence values;
- a recommendation that does not overstate what the evidence proves.

RIGX intentionally avoids claims such as “the agent skipped verification” until the observation schema contains enough deterministic evidence to support that statement.

## Privacy

Findings operate on normalized events only. They do not contain raw prompts, responses, commands, source snippets, tool input/output, transcript paths, working directories, file paths, or raw session IDs.

`rigx patterns` currently writes findings to stdout and does not persist them.
