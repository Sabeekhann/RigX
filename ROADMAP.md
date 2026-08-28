# RIGX roadmap

RIGX is being built from deterministic foundations outward. Dates are intentionally not promised; phases graduate when their behavior is testable and privacy-safe.

## Phase 0 — foundation ✅ alpha

- local-first CLI
- explicit strict privacy boundary
- Claude Code / Codex local-surface detection
- repository harness doctor
- reproducible harness snapshots
- harness drift detection
- machine-readable JSON output
- CI, security, contribution, and release hygiene

## Phase 1 — structured observation 🚧 in progress

- [x] normalized event model for coding-agent runs
- [x] adapter-driven Claude Code observation
- [x] adapter-driven Codex observation
- [x] strict-mode metadata collectors
- [x] tool success/failure signals
- [x] deterministic per-stream repeated-failure, repetition, search-heavy, agent-error, and event-coverage signals
- [ ] retry and verification signals
- [ ] local session index without raw transcript persistence by default

## Phase 2 — harness diagnosis

- cross-session recurrence for search/repetition/failure patterns
- skipped-verification detection
- instruction duplication evidence
- instruction conflict evidence where deterministically provable
- context/harness waste signals
- recommendation confidence and evidence
- per-agent pattern comparison

## Phase 3 — harness proposals

Generate reviewable proposals for:

- instruction restructuring
- task-specific skills
- deterministic hooks
- repository navigation docs
- verification workflows
- tool/MCP configuration changes
- recovery workflows

No automatic application by default.

## Phase 4 — evaluation

- isolated Git worktree runner
- baseline vs candidate harness trials
- deterministic repository checks
- repeated trials for nondeterministic agents
- task success comparison
- token/context comparison where available
- retry, tool-call, and duration comparison
- regression detection

## Phase 5 — harness evolution

- learn from real local trajectories
- generate candidate harness changes
- evaluate candidates
- reject regressions
- promote proven improvements with user approval
- export reviewable harness-improvement pull requests
- maintain versionable harness baselines

## Non-goals

RIGX is not intended to:

- replace Claude Code, Codex, Cursor, or OpenCode with another coding agent;
- require a cloud account for core analysis;
- silently upload repositories or conversations;
- silently rewrite agent configuration;
- score agents using opaque numbers without evidence;
- make unverified claims that a harness change is “better.”
