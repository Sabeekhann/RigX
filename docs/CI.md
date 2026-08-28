# Continuous integration and security automation

RIGX CI protects the project's core constraints: local-first behavior, strict privacy defaults, a minimal dependency surface, cross-platform CLI behavior, and reviewable releases.

## Automation map

| Automation | Trigger | Purpose |
| --- | --- | --- |
| CI / Required CI | PRs, pushes to `main`, manual | actionlint, syntax/tests, production audit, packed-package lifecycle, package dry-run, CLI smoke tests, and merge-conflict detection |
| Coverage (Codecov) | PRs, pushes to `main`, manual | Generates LCOV with Node's built-in coverage and uploads through Codecov OIDC; advisory |
| Compatibility / Compatibility gate | PRs, pushes to `main`, manual | Node 22/24/26 on Linux plus Node 24 on macOS and Windows, including packed-package installation |
| Dependency Review | PRs | Reviews dependency diffs for high-severity findings; advisory until GitHub Dependency Graph is enabled |
| Security | pushes to `main`, Mondays, manual | production dependency audit, extended CodeQL, and full-history gitleaks scan |
| Corgea: Security Scan | Corgea GitHub App PR events | Independent PR security review and check run; configured outside GitHub Actions |
| Release Check | version tags, manual | Re-runs the local release gate and emits a CycloneDX npm SBOM; never publishes |
| Dependabot | weekly | npm and GitHub Actions update PRs |

GitHub Actions are pinned to immutable commit SHAs. Downloaded security/lint tools are pinned by version and SHA-256 checksum.

## Local equivalent

```bash
npm ci --ignore-scripts
npm run ci
npm audit --omit=dev --audit-level=high
```

## Codecov

Coverage uses Node's built-in test coverage and uploads `lcov.info` with the official Codecov action using GitHub OIDC. No Codecov token is stored in the repository. `codecov.yml` keeps project and patch coverage informational during alpha development.

The repository owner still needs to enable the RigX repository in the Codecov GitHub App/account so Codecov can publish PR checks and comments.

## Corgea

Corgea is intentionally **not** represented by a fake GitHub Actions workflow. Corgea's GitHub App scans pull requests and creates its own check run. Once the app has access to `Sabeekhann/RigX`, add its exact check name to the `main` branch ruleset as a required status.

Recommended required merge checks:

```text
Required CI
Compatibility gate
Corgea: Security Scan
```

Codecov should remain advisory initially. Dependency Review is also advisory until **Settings → Security → Dependency graph** is enabled; after that is verified, it can be promoted to a required status.

## Recommended repository settings

In GitHub repository settings:

- require a pull request before merging to `main`;
- require `Required CI`, `Compatibility gate`, and `Corgea: Security Scan`;
- require conversation resolution;
- block force pushes and branch deletion;
- enable Dependabot alerts;
- enable secret scanning and push protection when available;
- enable private vulnerability reporting;
- keep auto-merge disabled;
- keep release/publish operations maintainer-controlled.

RIGX workflows use least-privilege permissions. No CI job publishes npm packages or GitHub Releases.
