# Retired ENCH CONTROL prototype

This local state machine is retired. All public engine functions and CLI commands fail closed; no JSON is read or written. Existing task files are preserved untouched, including any historical approval strings, which are not authorization.

Use the existing engineering runtime and GitHub PR/CI evidence. No replacement scheduler, state engine, authentication scheme, or deployment path is added here. GitHub branch/environment protections remain a separate required administrator control.

Reproduce: `node --test control/tests/engine.test.mjs` from the repository root. Tests reject forged approval, every exported operation and CLI command, and verify preservation of an existing file.

Acceptance: no local transition/mutation/approval authority; no data deletion; no merge/deployment. Risk: old callers now receive a deliberate retirement error and must use the existing runtime.
