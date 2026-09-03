# RIGX candidate verification

`rigx candidate` takes one proposal from `rigx propose` and actually tests it: it applies the proposal's literal file change inside a throwaway Git worktree of the current commit, runs whatever verification is possible, and reports whether it works. It never touches the caller's real working directory.

This is the first, deliberately narrow slice of Phase 5 ("harness evolution"): verifying a candidate change in isolation. It does not modify the real repository, open a pull request, or promote anything — those are separate, bigger trust decisions the roadmap lists as still to come (`promote proven improvements with user approval`, `export reviewable harness-improvement pull requests`).

## Usage

```bash
rigx candidate . --proposal verification-workflow.add-test-script
rigx candidate . --proposal verification-workflow.add-ci-workflow --json
```

`--proposal` is required and must match a proposal `id` currently returned by `rigx propose` for that repository.

## Which proposals are candidate-verifiable

Most `rigx propose` suggestions are wording or judgment calls (restructure instructions, resolve a conflict, add a navigation doc) and have no mechanical file change to apply — `rigx candidate` reports these as `unsupported` rather than guessing at a patch. A proposal is verifiable only when `src/core/proposals.js` attached a `patch`:

- `verification-workflow.add-{test,lint,typecheck}-script` — a `json-merge` patch adding one script to `package.json`'s `scripts`. Verifiable: after applying it, `rigx candidate` runs that exact script and reports pass/fail.
- `verification-workflow.add-ci-workflow` — a `create-file` patch writing `.github/workflows/ci.yml`. Applying it is checked (the file must not already exist), but running it is not: RigX has no way to execute a GitHub Actions workflow locally, so this is reported as applied but unverified.

## How it works

1. `rigx propose`'s full proposal generation runs again to find the proposal by id (proposals are not persisted between commands).
2. A temporary worktree of the repository's current `HEAD` is created (the same `createWorktree` used by `rigx evaluate`), symlinking `node_modules` when present.
3. The proposal's `patch` is applied inside that worktree only.
4. If the patch added a script, that script is run there and its outcome recorded. If the patch has no executable verification step, the result says so explicitly rather than reporting a false pass.
5. The worktree is always removed afterward, whether verification succeeded, failed, or errored.

## Output shape

```json
{
  "schemaVersion": 1,
  "proposalId": "verification-workflow.add-test-script",
  "outcome": "applied",
  "verified": true,
  "scripts": [{ "script": "test", "outcome": "success", "durationMs": 210 }],
  "note": null
}
```

`outcome` is one of:

- `applied` — the patch was applied, and either verification passed or no verification is possible for this patch type (`verified: null` in that case — see `note`).
- `failed` — the patch was applied but its verification script did not pass.
- `unsupported` — the proposal has no patch to apply.
- `error` — applying the patch itself failed (for example, the target file already exists for a `create-file` patch).

## Privacy and safety

`rigx candidate` never writes to the caller's actual working directory — every mutation happens inside a temporary worktree that is always removed before the command returns, the same isolation model `rigx evaluate` uses. It makes no network requests of its own; a repository's own verification script can, exactly as it would if you ran that script yourself.
