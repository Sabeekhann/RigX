# RIGX observation schema

RIGX Phase 1 defines a small vendor-neutral event envelope for coding-agent lifecycle and tool activity.

## Goals

- normalize structured vendor events behind adapters;
- preserve enough metadata to detect patterns later;
- exclude raw content in strict mode;
- keep unsupported vendor behavior explicit rather than guessed;
- allow the schema to evolve independently from Claude Code or Codex internals.

## Input boundary

`rigx observe`, `rigx patterns`, and `rigx index` only read events explicitly supplied by the user through stdin or `--input <file>`. They do not crawl transcript directories or automatically attach to running agents.

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

The normalized event must not contain:

- prompt text;
- model response text;
- source-code snippets;
- terminal command text;
- tool input or output content;
- transcript paths;
- current working directories;
- file paths;
- raw session identifiers.

Session identifiers are represented only by a one-way truncated SHA-256 identifier used for local correlation.

## Current event kinds

The core schema currently supports normalized kinds including:

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

Tool names are deterministically grouped into coarse categories:

- `shell`
- `filesystem`
- `search`
- `network`
- `subagent`
- `verification`
- `other`

The raw command, file target, URL, query, and content are not retained by the strict schema.

`verification` overrides a shell-classified tool when the adapter recognizes the underlying command as a known test, lint, build, or typecheck invocation (for example `npm test`, `pytest`, `eslint`, `tsc`). Adapters read the raw command only long enough to run this classification; the command text itself is discarded and never appears in the normalized event, `rigx patterns` findings, or the session index — only the derived category count is ever persisted.

## Local session index

`rigx observe` writes normalized events to stdout, while `rigx patterns` analyzes the same in-memory normalized stream and writes evidence-backed findings to stdout. Neither command persists supplied events or findings.

`rigx index [path] --agent <claude-code|codex> --input <file|->` is the explicit persistence boundary. It requires an initialized repository in strict metadata-only mode and writes `.rigx/state/session-index.json`, which is ignored by the default `.rigx/.gitignore`.

The index stores only:

- one-way opaque session identifiers;
- the adapter-controlled agent identifier;
- first and last normalized timestamps, when supplied;
- session start/end presence;
- bounded counts for events, tool starts/ends/failures, agent errors, and coarse tool-start categories.

It does not persist normalized events, tool names, raw vendor payloads, prompts, responses, source code, commands, tool input/output, working directories, file paths, or raw session identifiers. Re-indexing the same opaque agent/session replaces its summary rather than duplicating counts.

The index schema is versioned (`SESSION_INDEX_SCHEMA_VERSION`). Schema v2 added the `verification` tool-start category alongside the existing coarse categories; a v1 index (written before that category existed) is read and migrated in place — its sessions gain a zero-filled `verification` count rather than being rejected — the next write persists it as v2. `readSessionIndex(root)` is the read-side entry point other commands build on.

See [patterns.md](patterns.md) for the current single-session deterministic detector contract, and [recurrence.md](recurrence.md) for detectors that read the index back to look for recurrence across sessions.
