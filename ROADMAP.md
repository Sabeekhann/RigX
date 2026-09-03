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

## Phase 1 — structured observation ✅ alpha

- [x] normalized event model for coding-agent runs
- [x] adapter-driven Claude Code observation
- [x] adapter-driven Codex observation
- [x] strict-mode metadata collectors
- [x] tool success/failure signals
- [x] deterministic per-stream repeated-failure, repetition, search-heavy, agent-error, and event-coverage signals
- [x] retry and verification signals
- [x] local session index without raw transcript persistence by default

## Phase 2 — harness diagnosis ✅ alpha

- [x] cross-session recurrence for search/repetition/failure patterns
- [x] skipped-verification detection
- [x] instruction duplication evidence
- [x] instruction conflict evidence where deterministically provable
- [x] context/harness waste signals
- [x] recommendation confidence and evidence
- [x] per-agent pattern comparison

## Phase 3 — harness proposals 🚧 in progress

Generate reviewable proposals for:

- [x] instruction restructuring
- [x] task-specific skills
- [x] deterministic hooks
- [x] repository navigation docs
- [x] verification workflows
- [ ] tool/MCP configuration changes
- [x] recovery workflows

No automatic application by default.

## Phase 4 — evaluation 🚧 in progress

- [x] isolated Git worktree runner
- [x] baseline vs candidate harness trials
- [x] deterministic repository checks
- [ ] repeated trials for nondeterministic agents
- [ ] task success comparison
- [ ] token/context comparison where available
- [ ] retry, tool-call, and duration comparison
- [x] regression detection

The four unchecked items require RigX to actually invoke a coding agent across repeated trials, which it does not do yet — RigX observes and analyzes agent activity, it does not run agents itself. `rigx evaluate` currently compares two Git refs' own deterministic verification scripts (test/lint/typecheck), not agent task outcomes.

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
