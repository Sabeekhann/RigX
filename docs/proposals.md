# RIGX harness proposals

`rigx propose` is the first Phase 3 layer: it turns existing `rigx doctor` findings into concrete, reviewable suggestions. It never writes to disk, never modifies `AGENTS.md`/`CLAUDE.md`/CI/hooks/skills, and never applies anything automatically — per `AGENTS.md`'s "propose before mutate" rule and the roadmap's "No automatic application by default."

## Usage

```bash
rigx propose .
rigx propose . --json
```

`rigx propose` runs the same repository scan as `rigx doctor`, and also reads back the local session index (`.rigx/state/session-index.json`, the same data `rigx recurrence` reads) if one exists, to generate proposals from recurring cross-session signals. If no mapped finding fired, it says so rather than inventing a suggestion. An indexed session history is optional — `rigx propose` works from repository state alone if `rigx index` has never been run; the recurrence-derived categories below simply produce no proposals in that case.

## Current proposal categories

### Verification workflows

- **Missing test/lint/typecheck script**: proposes an addition to `package.json`'s `scripts`, tailored to what's actually detected — a lint tool (ESLint or Biome, from config file or dependency), a test runner (Vitest, Jest, Mocha, or Ava, from dependencies; falling back to `node --test` when none is detected), or `tsc --noEmit` for TypeScript repositories.
- **Missing CI workflow**: proposes a minimal GitHub Actions workflow (checkout, Node setup, install, then whichever of lint/typecheck/test scripts already exist), using the install command for the repository's detected package manager (npm/yarn/pnpm/bun).

### Instruction restructuring

- **Duplicated instruction text** (`instructions.duplicates`): proposes moving the repeated lines into one canonical file, referenced by the others, quoting the exact duplicate evidence.
- **Conflicting instruction values** (`instructions.conflicts`): proposes picking one authoritative value per key and removing the rest, quoting the exact conflicting evidence.
- **Large combined instruction surface** (`instructions.combined-size`): proposes consolidating overlapping guidance into one canonical file.

### Repository navigation docs

- **Thin documentation signals** (`legibility.docs-thin`): proposes a minimal `docs/architecture.md` outline (overview, key directories, how to verify a change) as a starting skeleton — RIGX cannot generate the actual architecture description, only the scaffold.

### Deterministic hooks

- **No hook surface, but a verification script exists** (`tooling.no-hooks` + a `test`/`lint`/`typecheck` script present): proposes a `.claude/settings.json` `PostToolUse` hook that runs the verification command after `Write`/`Edit` tool use, using the repository's detected package manager's run syntax. Only fires when there is something concrete to run — the mere absence of hooks is not itself proposed against (see "Deferred" below).

### Task-specific skills

- **Recurring search-heavy sessions** (`recurring-search-heavy-sessions`, from `rigx recurrence`'s indexed session history): proposes a focused repository-navigation skill or deterministic lookup script, since the same rediscovery cost showing up across multiple sessions is stronger evidence than a single search-heavy session.

### Recovery workflows

- **Recurring tool failures** (`recurring-tool-failures`, from `rigx recurrence`'s indexed session history): proposes adding short "when a command fails" guidance to instructions — stop after one retry, inspect the actual error, address the likely cause before retrying again.

## Deferred category

**Tool/MCP configuration changes** is not yet mapped to a proposal. The absence of MCP configuration (`tooling.no-mcp-config` in `rigx doctor`) is not itself evidence of a problem — most repositories have no need for one — so proposing it unconditionally would be noise, the same reason `skills.none` has no proposal mapping either. A useful proposal here needs a real signal for *which* external tool would help, which RIGX cannot determine deterministically from repository state or session counts alone.

## Proposal shape

Every proposal is:

```json
{
  "id": "instruction-restructuring.resolve-conflicts",
  "category": "instruction-restructuring",
  "title": "Resolve conflicting values declared across instruction surfaces",
  "rationale": "Different agent surfaces declare different values for the same key",
  "findingIds": ["instructions.conflicts"],
  "suggestion": "Pick one authoritative value for each key below and remove the conflicting line(s) from the other file(s):\n  - package manager: AGENTS.md: “npm” vs. CLAUDE.md: “pnpm”"
}
```

`findingIds` always traces a proposal back to the deterministic `rigx doctor` finding(s) it is based on — a proposal is never presented without the evidence that produced it.

## Privacy

`rigx propose` reads the same repository surfaces `rigx doctor` already reads (instruction files, `package.json`, lint/CI config presence) to tailor its suggestions, plus the same already-privacy-filtered session index `rigx recurrence` reads (opaque session identifiers and bounded counts only — see [observation-schema.md](observation-schema.md)). It does not persist anything, does not make network requests, and never reads raw session/observation content.
