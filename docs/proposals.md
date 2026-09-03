# RIGX harness proposals

`rigx propose` is the first Phase 3 layer: it turns existing `rigx doctor` findings into concrete, reviewable suggestions. It never writes to disk, never modifies `AGENTS.md`/`CLAUDE.md`/CI/hooks/skills, and never applies anything automatically — per `AGENTS.md`'s "propose before mutate" rule and the roadmap's "No automatic application by default."

## Usage

```bash
rigx propose .
rigx propose . --json
```

`rigx propose` runs the same repository scan as `rigx doctor` and maps a subset of its findings to proposals. If no mapped finding fired, it says so rather than inventing a suggestion.

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

## Deferred categories

Task-specific skills, deterministic hooks, tool/MCP configuration changes, and recovery workflows are on the roadmap but not yet implemented — they need richer, more judgment-dependent generation (actual skill/hook content) than the current mechanical finding-to-suggestion mapping, and are being sequenced separately.

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

`rigx propose` reads the same repository surfaces `rigx doctor` already reads (instruction files, `package.json`, lint/CI config presence) to tailor its suggestions. It does not persist anything, does not make network requests, and does not read session/observation data.
