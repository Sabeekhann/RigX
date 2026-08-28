# Releasing RIGX

RIGX is not yet published to npm. This document defines the release discipline for when publishing begins.

## Owner-controlled release policy

Coding agents and automation must **not** publish an npm package or GitHub Release without explicit repository-owner confirmation.

## Pre-release checklist

1. `npm ci`
2. `npm run check`
3. `npm run package:check`
4. confirm `CHANGELOG.md` is current
5. confirm `package.json` version and license metadata
6. inspect `npm pack --dry-run` output for accidental private/local files
7. verify strict-mode privacy tests
8. verify CI/CodeQL status
9. create a signed/tagged release only after owner approval

## Versioning

Before `1.0.0`, RIGX may publish alpha/beta versions while schemas and CLI output are still evolving.

Do not imply compatibility guarantees that the project does not yet provide.
