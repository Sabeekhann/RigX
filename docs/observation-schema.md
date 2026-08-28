# RIGX observation schema

RIGX Phase 1 defines a small vendor-neutral event envelope for coding-agent lifecycle and tool activity.

## Goals

- normalize structured vendor events behind adapters;
- preserve enough metadata to detect patterns later;
- exclude raw content in strict mode;
- keep unsupported vendor behavior explicit rather than guessed;
- allow the schema to evolve independently from Claude Code or Codex internals.

## Input boundary

`rigx observe` only reads events explicitly supplied by the user through stdin or `--input <file>`. It does not crawl transcript directories or automatically attach to running agents.

Input is newline-delimited JSON (NDJSON), one structured vendor event per line.

## Normalized event

Illustrative strict-mode event:

```json
{
  "schemaVersion": 1,
  "agent": "claude-code",
  "kind": "tool.end",
  "timestamp": null,
  "session": "1c8f...opaque",
  "tool": {
    "name": "Bash",
    "category": "shell"
  },
  "outcome": "success",
  "metadata": {
    "sourceEvent": "PostToolUse",
    "toolUseIdPresent": true
  },
  "privacy": {
    "mode": "strict",
    "rawContentStored": false,
    "fullPathsStored": false
  }
}
```

## Strict-mode exclusions

The normalized event must not contain prompt text, model response text, source-code snippets, terminal command text, tool input/output content, transcript paths, current working directories, file paths, or raw session identifiers.

Session identifiers are represented only by a one-way truncated SHA-256 identifier used for local correlation.

## Current event kinds

- `session.start`
- `session.end`
- `turn.start`
- `turn.end`
- `user.input`
- `tool.start`
- `tool.end`
- `subagent.start`
- `subagent.end`
- `agent.error`

Adapters may return `null` for events they do not understand. Ignoring an unsupported event is preferred to inventing semantics.

## Tool categories

- `shell`
- `filesystem`
- `search`
- `network`
- `subagent`
- `other`

The raw command, file target, URL, query, and content are not retained by the strict schema.

## Persistence

Phase 1 does not persist normalized observation events. `rigx observe` writes them to stdout. A future persistence layer must be explicit, repository-local, independently configurable, and covered by privacy regression tests before it ships.
