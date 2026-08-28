# RIGX local state

This directory defines RIGX's local privacy boundary for this repository.

Default mode is **strict**:

- no telemetry
- no network uploads
- no raw prompt persistence
- no model-response persistence
- no source-code persistence
- no terminal-output persistence
- no full session-path persistence
- agent session observation is metadata-only

Generated proposals, caches, and session-derived local state should stay under ignored subdirectories unless you explicitly decide to commit an artifact.
