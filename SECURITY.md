# Security policy

RIGX operates near source repositories, coding-agent state, tool output, and eventually session metadata. Privacy regressions are security regressions.

## Supported versions

RIGX is currently alpha software. Security fixes are applied to the latest development version on `main` and, once public releases begin, to the latest released version when practical.

| Version | Supported |
| --- | --- |
| `main` / latest alpha | ✅ |
| older unreleased snapshots | ❌ |

## Reporting a vulnerability

**Do not open a public issue for a vulnerability that could expose user data, credentials, repository contents, or enable code execution.**

Use GitHub's **Security → Report a vulnerability** / private vulnerability reporting flow for this repository when available. If that option is not available, contact the repository owner through GitHub and request a private reporting channel before sharing sensitive details.

Include, when safe, the affected version or commit, OS and Node version, minimal reproduction, expected vs actual behavior, impact, and whether the issue involves network transmission, persistence, path disclosure, command execution, or secret handling.

Do not include real credentials or private customer/source data.

## High-priority issue classes

- strict mode persisting raw prompts, responses, source, terminal output, or full session paths;
- unexpected outbound network requests;
- credential or secret disclosure;
- command injection or unsafe shell construction;
- symlink/path traversal that escapes the intended repository/state boundary;
- malicious repository content causing unintended execution;
- insecure handling of future MCP/provider integrations;
- supply-chain compromise in dependencies or GitHub Actions.

## Security design expectations

- least-privilege GitHub Actions permissions;
- no product telemetry in core;
- explicit network opt-in;
- deterministic logic preferred over executing repository content;
- no secret values in logs or JSON reports;
- dependencies minimized and reviewed.
