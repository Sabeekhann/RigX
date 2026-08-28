# RIGX privacy model

Privacy is a product boundary in RIGX, not a marketing toggle.

## Current alpha guarantees

The current core CLI:

- has zero runtime third-party dependencies;
- contains no product telemetry;
- requires no RIGX account;
- makes no network requests in core commands;
- does not upload repository content, prompts, responses, or agent sessions.

The default configuration created by `rigx init` is `strict` mode.

## Strict mode

In `strict` mode RIGX does not persist:

- raw prompts;
- model responses;
- source code;
- terminal output;
- full paths from observed agent sessions.

The configuration also sets network access to `deny` for RIGX-controlled analysis.

## Agent detection

`rigx agents` checks whether known local Claude Code and Codex data surfaces exist. In strict mode, detection is metadata-oriented: RIGX can inspect filesystem existence, counts, and sizes needed for discovery, but it does not parse raw transcript contents into its own persistent store.

`--show-paths` is an explicit display option. It does not change the strict-mode persistence policy.

## Structured observation

`rigx observe` is an explicit, opt-in stream normalizer. RIGX does not automatically scrape local Claude Code or Codex conversation history. The command reads structured event payloads supplied by the user (stdin or an explicit input file), translates supported vendor lifecycle/tool events into the RIGX event schema, and writes sanitized events to stdout.

In strict mode, normalized events can include the agent identifier, event kind, tool name/category, success/failure state, a one-way opaque session identifier, and a small allowlist of non-content metadata. They do not include command text, prompts, model responses, source snippets, tool input/output, transcript paths, current working directories, or file paths. Unsupported vendor events are ignored rather than guessed.

The current `observe` command does **not** persist normalized events. `rigx patterns` analyzes that same normalized metadata boundary and emits deterministic findings to stdout without persisting the supplied events or findings. Pattern output can contain opaque session identifiers, tool names/categories, counts, ratios, and detector evidence, but not the excluded raw content listed above.

`rigx index` is an explicit, repository-local persistence boundary. It requires an initialized strict metadata-only configuration and writes an ignored `.rigx/state/session-index.json` file. The index contains only opaque session identifiers, adapter-controlled agent identifiers, optional normalized timestamps, lifecycle presence, and bounded event/tool/category counts. It does not persist normalized event records, tool names, raw payloads, or any excluded content listed above. Dedicated regression tests place private markers in supplied payloads and verify they do not enter the index.

## Harness snapshots

`rigx snapshot` stores a repository-local baseline at `.rigx/harness.lock.json`.

The snapshot contains:

- relative harness file names;
- byte counts;
- SHA-256 hashes;
- verification-script fingerprints;
- privacy mode metadata.

It does **not** store the contents of the hashed files. The test suite contains a regression test that puts a private marker inside `AGENTS.md` and verifies that the marker does not appear in the lockfile.

## Local state

RIGX reserves `.rigx/` for local/project state. Generated caches, session-derived data, and proposals should remain in ignored subdirectories unless the user intentionally chooses to commit an artifact.

The committed `.rigx/config.json` and `.rigx/harness.lock.json` in this repository are examples of RIGX dogfooding its own harness model.

## Future observation modes

Richer session observation is planned, but it must follow these rules:

1. richer collection is explicit rather than silently enabled;
2. local processing remains the default;
3. raw content persistence is independently controllable;
4. external model calls require a user-selected provider;
5. the user can understand what data would leave the machine before it is sent;
6. secrets and credentials must be redacted or excluded where feasible;
7. collection and networking behavior must have regression tests.

## Telemetry

The open-source core has no product analytics or usage telemetry.

If a hosted service is introduced in the future, it must remain optional and architecturally separate from the local core. The local CLI must continue to provide useful harness analysis without requiring that service.

## Reporting privacy issues

Treat unintended persistence, disclosure, or network transmission of user data as a security issue. Follow [SECURITY.md](SECURITY.md) rather than opening a public issue with sensitive reproduction data.
