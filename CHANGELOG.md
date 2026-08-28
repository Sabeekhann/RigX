# Changelog

All notable user-facing changes to RIGX will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) principles. RIGX is pre-1.0, so command output and schemas can still change between alpha releases.

## [Unreleased]

### Added

- Phase 1 structured observation foundation with a vendor-neutral normalized event schema.
- `rigx observe` for explicit stdin/file normalization of supported Claude Code and Codex structured events.
- Strict-mode redaction tests proving prompts, command text, tool content, transcript paths, CWDs, and file paths do not enter normalized output.
- Claude Code and Codex event adapters that ignore unsupported events instead of inferring undocumented behavior.
- Full public-repository community, security, CI, and contribution scaffolding.
- Apache-2.0 licensing and NOTICE metadata.
- CodeQL, dependency review, Dependabot, issue forms, and pull-request template.

### Changed

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
