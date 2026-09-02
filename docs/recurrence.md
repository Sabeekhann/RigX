# RIGX cross-session recurrence

`rigx recurrence` is the second diagnostic layer, built on top of the local session index (see [observation-schema.md](observation-schema.md#local-session-index)). It looks for the same deterministic signal recurring across multiple indexed sessions, and compares indexed sessions per agent.

It only reads `.rigx/state/session-index.json` — the same bounded, strict-mode-only counts `rigx index` already writes. It does not read raw transcripts, call an LLM, or make network requests.

## Usage

```bash
rigx index . --agent claude-code --input claude-hook-events.ndjson
rigx index . --agent codex --input codex-events.ndjson
rigx recurrence .
rigx recurrence . --json
```

If no sessions have been indexed yet, `rigx recurrence` says so and points to `rigx index` rather than inventing an empty report.

## Current cross-session detectors

A detector requires at least 3 indexed sessions to exhibit the signal before it fires — a single occurrence belongs in `rigx patterns` (single-session), not here.

### Recurring search-heavy sessions

Fires when at least 3 indexed sessions each independently meet `rigx patterns`'s search-heavy threshold (search-category tool starts ≥6 and ≥50% of that session's tool starts).

### Recurring tool failures

Fires when at least 3 indexed sessions each recorded at least one tool failure.

### Recurring verification skips

Fires when at least 3 indexed sessions each recorded a `filesystem`-category tool start with zero `verification`-category tool starts — the cross-session counterpart to `rigx patterns`'s single-session `verification-skipped` finding, and stronger evidence because it recurs.

## Per-agent comparison

Alongside findings, `rigx recurrence` reports, per agent (`claude-code`/`codex`), the share of that agent's indexed sessions that were search-heavy, had a tool failure, or skipped verification — so the same signals can be compared across agents rather than only in aggregate.

## Evidence and confidence contract

Every finding uses the same shape as `rigx patterns` (see [patterns.md](patterns.md#evidence-contract)), plus `scope: 'cross-session'`. Confidence scales with how many sessions exhibited the pattern: 3-4 occurrences is `low`, 5-9 is `medium`, 10+ is `high`. Occurrence count, not just recency, is the deciding factor — a pattern seen in 3 of a user's first 3 sessions is not yet strong evidence on its own.

## Privacy

`rigx recurrence` only ever reads the already-privacy-filtered session index: opaque session identifiers, adapter-controlled agent identifiers, and bounded counts. It never touches tool names, raw payloads, prompts, responses, source code, commands, or file paths — those were already excluded before the index was written (see [observation-schema.md](observation-schema.md)).
