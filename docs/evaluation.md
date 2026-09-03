# RIGX evaluation

`rigx evaluate` is the first Phase 4 layer: it compares two Git refs' own deterministic verification scripts (`test`, `lint`, `typecheck`) in isolated worktrees and reports pass/fail, duration, and regressions.

It is the one RigX command that executes code rather than only inspecting or reading state — everything it runs is the repository's own already-defined `package.json` scripts, nothing RigX invents or downloads.

## Usage

```bash
rigx evaluate . --baseline main --candidate my-feature-branch
rigx evaluate . --baseline main --candidate HEAD --json
```

Both `--baseline` and `--candidate` are required and accept any Git ref (branch, tag, or commit). This is deliberate: there is no default comparison RigX could pick safely on your behalf.

## How it works

1. Each ref is resolved to a commit SHA (`git rev-parse`), then checked out into its own temporary Git worktree with `git worktree add --detach` — never the caller's actual working directory, and safe even when the candidate ref is the branch currently checked out there.
2. If a `node_modules` directory exists in the caller's working directory, it is symlinked into each worktree. Dependencies are **not reinstalled** — this trades full reproducibility for a fast, local-only, network-free comparison, on the assumption that baseline and candidate don't differ in their dependency tree. If that assumption doesn't hold, scripts requiring the missing/mismatched packages will fail deterministically, and that failure is reported like any other result.
3. Whichever of `test`, `lint`, `typecheck` exist in that ref's `package.json` scripts are run there, using the same package-manager run syntax `rigx propose`'s CI-workflow suggestion uses (npm/yarn/pnpm/bun).
4. Each worktree is removed afterward (`git worktree remove`, falling back to a plain directory removal if that fails for any reason).

## Regression detection

A regression is a script that passed on the baseline ref and failed on the candidate ref. A script failing on both refs is not reported as a regression — it's a pre-existing failure, not something the candidate introduced. A script present on only one ref simply doesn't have a corresponding comparison.

## Output shape

```json
{
  "schemaVersion": 1,
  "baseline": { "ref": "main", "commit": "<sha>", "scripts": [{ "script": "test", "outcome": "success", "durationMs": 812 }] },
  "candidate": { "ref": "my-branch", "commit": "<sha>", "scripts": [{ "script": "test", "outcome": "failure", "durationMs": 340, "exitCode": 1 }] },
  "regressions": [{ "script": "test", "baseline": "success", "candidate": "failure" }]
}
```

## What this is not (yet)

The roadmap's remaining Phase 4 items — repeated trials for nondeterministic agents, task success comparison, token/context comparison, and retry/tool-call/duration comparison across trials — require RigX to actually invoke a coding agent multiple times and compare its behavior. RigX does not do that: it observes and analyzes agent activity (`rigx observe`/`rigx patterns`/`rigx recurrence`), it does not run agents itself. `rigx evaluate` compares two refs' own build/test/lint outcomes, which is a useful and much narrower thing.

## Privacy and safety

`rigx evaluate` makes no network requests of its own (dependency installation is skipped entirely, per above). It does not touch `.rigx/` state, the session index, or any observation data. The only side effects are temporary Git worktrees under the OS temp directory, always removed before the command returns.
