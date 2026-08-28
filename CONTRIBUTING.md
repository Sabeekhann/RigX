# Contributing to RIGX

Thanks for helping build RIGX. The project is intentionally opinionated about privacy, evidence, and vendor neutrality because those properties are easy to lose as agent tooling becomes more capable.

## Before you start

Read:

1. [AGENTS.md](AGENTS.md) — authoritative repository rules;
2. [PRIVACY.md](PRIVACY.md) — collection and networking guarantees;
3. [docs/architecture.md](docs/architecture.md) — code boundaries;
4. [ROADMAP.md](ROADMAP.md) — product direction.

For a substantial feature, open an issue before implementation. This is especially important for session observation, external model calls, new persistence, new dependencies, or anything that could weaken strict mode.

## Development setup

Requirements:

- Node.js 22+
- npm

```bash
git clone https://github.com/Sabeekhann/RigX.git
cd RigX
npm ci
npm run check
```

Optional local CLI link:

```bash
npm link
rigx --help
```

## Quality gates

Before submitting a change:

```bash
npm run check
npm run package:check
```

`npm run check` runs syntax validation and the Node test suite. Add regression tests for behavior changes.

## Pull requests

- Keep changes focused.
- Explain the user problem and the evidence for the approach.
- Call out privacy, persistence, network, and compatibility impacts explicitly.
- Update documentation and `CHANGELOG.md` for user-visible changes.
- Agent-generated work should normally open as a **draft pull request** until checks are green and the owner reviews it.
- Do not merge on behalf of the repository owner.

The pull-request template includes a privacy-impact checklist. Do not mechanically check boxes; verify them.

## Coding style

RIGX currently uses modern JavaScript ESM and Node built-ins.

Guidelines:

- prefer small functions with explicit inputs and outputs;
- keep vendor-specific behavior inside `src/adapters/`;
- keep deterministic shared logic inside `src/core/`;
- make errors actionable;
- avoid logging sensitive content;
- avoid adding dependencies when Node can reasonably do the job;
- keep JSON output free of decorative terminal text;
- include evidence with analysis findings.

## Adding a detector

A detector should answer four questions:

1. **What fact did we observe?**
2. **What evidence proves it?**
3. **Why might it matter?**
4. **What recommendation follows without overstating certainty?**

Avoid labels such as “stale”, “unused”, or “wrong” unless the detector can prove them.

## Adding an agent adapter

Adapters must isolate vendor-specific storage or event formats from the core data model.

Document what local surfaces are read, whether raw content is parsed, what is persisted, how strict mode behaves, what vendor format assumptions are unstable, and tests covering privacy-sensitive behavior.

## Dependencies

The alpha core has zero runtime dependencies. A new dependency needs a concrete justification explaining why the functionality should not be implemented using Node built-ins.

Consider maintenance activity, transitive dependency size, install scripts, network behavior, license compatibility, and security history.

## Commit messages

Prefer concise Conventional Commit-style subjects where practical:

```text
feat: add normalized observation event schema
fix: avoid exposing paths in strict agent discovery
docs: clarify strict-mode persistence boundary
```

## Security and privacy reports

Do not place secrets, private repository contents, or raw transcripts in public issues. Follow [SECURITY.md](SECURITY.md).
