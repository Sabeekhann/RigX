# RIGX architecture

RIGX is split into a deterministic vendor-neutral core and thin vendor adapters.

```text
                         ┌───────────────────────┐
                         │         CLI           │
                         └───────────┬───────────┘
                                     │
             ┌───────────────────────┼───────────────────────┐
             │                       │                       │
             ▼                       ▼                       ▼
     repository scanner      harness snapshot        privacy policy
             │                       │                       │
             └───────────────┬───────┴───────────────┬───────┘
                             │                       │
                             ▼                       ▼
                    deterministic core        agent adapters
                                             ├─ Claude Code
                                             └─ Codex
```

## Current components

### CLI

`src/cli.js` parses command selection and presentation options. Commands return strings so the CLI can keep exit-code and error handling consistent.

### Repository scanner

`src/core/scanner.js` inventories harness-relevant repository surfaces and produces findings based on observable evidence. The scanner should not execute repository code merely to inspect it.

### Scoring

`src/core/score.js` converts supported findings into a coarse harness-health score. Scores are directional summaries; evidence remains the primary output.

### Harness snapshot

`src/core/snapshot.js` hashes defined harness surfaces and verification scripts into `.rigx/harness.lock.json` without storing their contents. This provides the reproducible baseline needed for future evaluation.

### Privacy/config

`src/core/config.js` owns the explicit RIGX privacy boundary initialized under `.rigx/config.json`.

### Agent adapters

`src/adapters/` contains vendor-specific local discovery. Vendor storage formats must not leak into shared core types.

## Architectural principles

### 1. Local first

Core analysis must remain useful with networking disabled.

### 2. Evidence before judgement

A finding is an observation plus evidence plus a recommendation. Recommendations cannot be presented as proven facts.

### 3. Deterministic before probabilistic

If a filesystem check, hash, test command, or parser can answer the question reliably, use it before asking an LLM.

### 4. Adapters at the boundary

Claude Code, Codex, Cursor, OpenCode, and future agents should translate into a shared event model rather than shaping the core architecture around one vendor.

### 5. Raw session content is opt-in

Strict mode cannot silently become transcript ingestion. Richer modes must be explicit and local by default.

### 6. Proposals before mutation

Future optimization can generate patches, skills, hooks, or documentation proposals, but applying them is a separate user-controlled action.

### 7. Reproducibility

Harness state should be hashable, comparable, and evaluable against a known baseline.

## Planned observation boundary

The next major subsystem will translate vendor events into normalized local signals such as:

```text
tool_started
tool_succeeded
tool_failed
verification_started
verification_failed
retry_detected
user_correction
context_pressure
session_completed
```

The shared model should contain the minimum information needed for analysis under the active privacy mode. It should not assume raw transcript storage.

## Planned evolution loop

```text
observe
  ↓
diagnose
  ↓
propose candidate harness change
  ↓
evaluate baseline vs candidate in isolation
  ↓
reject regression OR present proven improvement
  ↓
user-approved promotion
```

The alpha currently implements discovery, privacy boundaries, deterministic diagnostics, and reproducible harness snapshots.
