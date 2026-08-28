# RIGX repository instructions

This file is authoritative for coding agents and contributors working in this repository. Read it completely before changing code, documentation, workflows, releases, or repository policy.

## Product mission

RIGX is a local-first harness-engineering toolkit for coding agents. It should help developers inspect, version, diagnose, evaluate, and eventually improve the environment around Claude Code, Codex, and other coding agents.

RIGX is not another coding agent and must not become coupled to one model vendor.

## Absolute product rules

- No product telemetry in the core CLI.
- No source-code, prompt, transcript, model-response, tool-output, file-path, or usage-data uploads by default.
- Core analysis must work without a cloud account.
- Network access must be opt-in and attributable to a user-selected integration or provider.
- `strict` privacy mode must never persist raw prompts, responses, source code, terminal output, or full session paths.
- Do not silently modify `AGENTS.md`, `CLAUDE.md`, hooks, skills, MCP configuration, CI, or other harness files.
- Harness improvements must be proposals until the user explicitly applies them.
- Prefer deterministic evidence over LLM judgement whenever normal software can answer the question.
- Every detector must expose evidence for why it fired.
- Findings must clearly separate observed facts from recommendations.
- Do not call something stale, wrong, unused, contradictory, or harmful without evidence supporting that claim.
- Keep Claude Code, Codex, Cursor, OpenCode, and future providers behind adapters.
- Treat undocumented vendor transcript formats as unstable implementation details.
- Sensitive-data collection must be explicit, documented, and testable.

## Repository workflow

- Preserve existing user changes and inspect Git state before editing.
- The initial repository bootstrap may land on `main` only when the repository owner explicitly asks for the initial files to be pushed there.
- After the bootstrap, agent-generated feature/fix work should use a branch and a **draft pull request** unless the owner explicitly requests another workflow.
- Never merge a pull request for the owner.
- Never approve a pull request for the owner.
- Never enable auto-merge.
- Never mark a draft pull request ready for review.
- Never publish a GitHub release or npm package without explicit owner confirmation.
- Do not force-push unless the owner explicitly requests it and the consequences are understood.

## Engineering rules

- Runtime target: Node.js 22+ using ESM.
- Keep runtime dependencies minimal; the alpha intentionally uses Node built-ins only.
- Use the Node test runner unless there is a demonstrated reason to introduce another framework.
- Add or update tests for behavior changes.
- `npm run check` must pass before work is considered complete.
- `npm run package:check` should pass for package-surface changes.
- CLI errors should be actionable and should not expose sensitive data unnecessarily.
- Machine-readable `--json` output must remain valid JSON without decorative terminal text.
- Avoid hidden background services in the core product.
- Avoid network calls in deterministic repository inspection commands.

## Architecture boundaries

- `src/core/` is vendor-neutral deterministic logic.
- `src/adapters/` owns vendor-specific discovery and future event translation.
- `src/commands/` owns CLI orchestration and presentation boundaries.
- Future LLM-assisted analysis belongs behind an explicit provider interface and cannot be required for core commands.
- Persisted local state belongs under `.rigx/` and must follow the configured privacy mode.

## Documentation rules

- Do not claim features that are only planned.
- Mark examples as illustrative when exact output is not a stable contract.
- Keep privacy claims synchronized with actual behavior and tests.
- Update `CHANGELOG.md` for user-visible changes.
- Update `ROADMAP.md` when a roadmap phase materially changes.
- Update `PRIVACY.md` whenever collection, persistence, or networking behavior changes.

## Security rules

- Never commit credentials, tokens, private keys, raw user transcripts, or private repository data.
- Do not add analytics or crash-reporting SDKs without explicit product-policy review.
- Dependency additions require a concrete justification and security review.
- Prefer least-privilege GitHub Actions permissions.
- Pin or use stable major versions of third-party actions and keep Dependabot enabled.
