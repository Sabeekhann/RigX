# Changelog

All notable user-facing changes to RIGX will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) principles. RIGX is pre-1.0, so command output and schemas can still change between alpha releases.

## [0.1.0-alpha.6] - 2026-09-03

### Added

- `rigx propose` now also reads the local session index (when `rigx index` has been run) and generates proposals from `rigx recurrence`'s cross-session findings, closing out three more Phase 3 categories:
  - Deterministic hooks: a `.claude/settings.json` `PostToolUse` hook suggestion that runs verification after file edits, when a verification script exists but no hook surface does.
  - Task-specific skills: a focused navigation-skill suggestion when search-heavy sessions recur.
  - Recovery workflows: a "when a command fails" instruction-guidance suggestion when tool failures recur.
- `rigx doctor` finding `tooling.no-mcp-config` (informational, mirrors `tooling.no-hooks`/`skills.none`): reports when no MCP configuration surface is detected.

### Changed

- `ROADMAP.md`'s Phase 3 now has 6 of 7 categories checked off. Tool/MCP configuration changes remains explicitly deferred: the mere absence of MCP config isn't evidence of a problem (same reasoning as `skills.none`), and a useful proposal needs a signal for *which* external tool would help that RIGX cannot determine deterministically.

## [0.1.0-alpha.5] - 2026-09-03

### Added

- `rigx propose`: the first Phase 3 command. Maps a subset of `rigx doctor` findings into concrete, reviewable proposals — never applied automatically.
  - Verification workflows: a tailored `package.json` script suggestion for missing test/lint/typecheck (detecting ESLint/Biome and Vitest/Jest/Mocha/Ava where possible, falling back to `node --test`), and a minimal GitHub Actions CI workflow suggestion using the detected package manager.
  - Instruction restructuring: consolidation suggestions for duplicated instruction text, conflicting instruction values, and large combined instruction surfaces.
  - Repository navigation: a minimal `docs/architecture.md` outline suggestion when documentation signals are thin.
- `docs/proposals.md` documenting the proposal shape, current categories, and what's deferred.

### Changed

- `ROADMAP.md`'s Phase 3 is now in progress: instruction restructuring, verification workflows, and repository navigation docs are checked off; task-specific skills, deterministic hooks, tool/MCP configuration changes, and recovery workflows remain open.

## [0.1.0-alpha.4] - 2026-09-02

### Added

- `rigx doctor` finding `instructions.conflicts`: deterministic, syntactic "key: value" conflicts between agent instruction surfaces (e.g. `AGENTS.md` and `CLAUDE.md` declaring different values for the same declared key). Intentionally narrow — exact key match with different normalized values, not free-form contradiction inference.
- `rigx doctor` finding `instructions.combined-size`: flags a large combined instruction surface (2+ files, 600+ total lines) even when no single file crosses the existing per-file threshold — a context/harness-waste signal.
- `high-tool-volume-no-changes` deterministic pattern finding (`rigx patterns`): a session with 20+ tool starts and zero observed file changes.
- `recurring-high-tool-volume-sessions` cross-session finding and a `highToolVolumeNoChangeRate` per-agent stat (`rigx recurrence`) — the cross-session counterpart of the above.
- Tests for all of the above.

### Changed

- Completed Phase 2 (harness diagnosis) in `ROADMAP.md`: all 7 goals are now checked off, including instruction conflict evidence and context/harness waste signals.

## [0.1.0-alpha.3] - 2026-09-02

### Added

- `rigx recurrence` for cross-session recurrence detection (`recurring-search-heavy-sessions`, `recurring-tool-failures`, `recurring-verification-skips`) and a per-agent comparison, reading the existing local session index.
- `verification-skipped` deterministic pattern finding: a session changed files but recorded no verification-category tool call.
- A `confidence` field (`low`/`medium`/`high`) on every `rigx patterns`, `rigx doctor`, and `rigx recurrence` finding, reflecting how strong the evidence is on its own.
- Session index schema v2: a persisted `verification` tool-start category, with in-place migration of existing v1 index files (no data loss, no re-index required).
- `readSessionIndex()` as the exported read path other commands build on.
- Tests for the above, including a v1-to-v2 index migration regression test and confidence-level assertions.

### Fixed

- `rigx --version` now reads the version from `package.json` at runtime instead of a hardcoded string that had gone stale after the last release bump.
- `scripts/package-smoke.js` now asserts the installed CLI's version against `package.json` instead of a hardcoded string; it had been silently matching the same stale value as the `--version` bug above and would not have caught a real regression.

### Changed

- Checked off cross-session recurrence, skipped-verification detection, recommendation confidence, and per-agent pattern comparison in `ROADMAP.md`'s Phase 2 list; instruction conflict evidence and context/harness waste signals remain open.
- Added a dedicated regression test for the existing `instructions.duplicates` doctor finding.

## [0.1.0-alpha.2] - 2026-09-02

### Added

- `retry-after-failure` deterministic pattern finding: a tool restarted after a failed completion in the same session.
- `unretried-verification-failure` deterministic pattern finding: a session ended on a failing test/lint/build/typecheck command with no later verification retry.
- A `verification` tool category, derived at adapter time from known test/lint/build/typecheck command shapes (e.g. `npm test`, `pytest`, `eslint`, `tsc`) without retaining the underlying command text.
- Privacy regression tests proving verification classification and the new pattern findings never retain the source command string.
- `rigx index` for explicit, ignored, strict-mode local session summaries without raw event or tool-name persistence.
- Privacy regression tests for the repository-local session index and its initialization boundary.
- Added the RIGX visual identity and cowboy/lasso mascot branding to the repository README.
- `rigx patterns` deterministic session diagnostics for repeated tool failures, high tool repetition, search-heavy sessions, agent errors, and incomplete tool-event coverage.
- Privacy regression tests proving pattern findings retain only normalized metadata and opaque session identifiers.
- Hardened CI with immutable action pins, checksum-verified actionlint, package lifecycle smoke tests, and conflict-marker detection.
- Codecov coverage upload using GitHub OIDC and repository-level `codecov.yml`.
- Cross-platform compatibility matrix for Node 22/24/26, macOS, and Windows with a stable `Compatibility gate`.
- Security workflow with production dependency audit, extended CodeQL, and full-history gitleaks scanning.
- Release-candidate SBOM generation and CI/security setup documentation, including Corgea GitHub App requirements.
- Phase 1 structured observation foundation with a vendor-neutral normalized event schema.
- `rigx observe` for explicit stdin/file normalization of supported Claude Code and Codex structured events.
- Strict-mode redaction tests proving prompts, command text, tool content, transcript paths, CWDs, and file paths do not enter normalized output.
- Claude Code and Codex event adapters that ignore unsupported events instead of inferring undocumented behavior.
- Full public-repository community, security, CI, and contribution scaffolding.
- Apache-2.0 licensing and NOTICE metadata.
- CodeQL, dependency review, Dependabot, issue forms, and pull-request template.

### Changed

- Marked Phase 1 (structured observation) complete in `ROADMAP.md` now that retry/verification signals and the local session index have shipped; Phase 2 (harness diagnosis) is now in progress.
- Synchronized the README and roadmap with the implemented `rigx patterns` command and current Phase 1 progress.
- Expanded README and repository documentation for the RIGX product direction.
- Package metadata now reflects the public GitHub repository and Apache-2.0 license.

## [0.1.0-alpha.1] - 2026-08-29

### Added

- `rigx init` strict local privacy/config initialization.
- `rigx doctor` deterministic repository harness analysis.
- `rigx agents` local Claude Code and Codex surface discovery.
- `rigx privacy` privacy-policy reporting.
- `rigx snapshot` content-free harness hashing.
- `rigx status` harness drift detection.
- JSON output for machine-readable workflows.
- Privacy regression tests ensuring snapshot contents do not copy instruction text.

> This alpha version is a source-development milestone and has not been published to npm as part of this repository bootstrap.
