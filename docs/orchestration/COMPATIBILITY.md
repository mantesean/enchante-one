# Compatibility audit — 2026-11-19

Documentation describes capabilities; only local observations establish readiness.
No claim here means every provider has been benchmarked on this task.

| Component | Current documented capability | Observed on this Mac | Decision |
| --- | --- | --- | --- |
| Orchestrator.inc | External harnesses, isolated worktrees, PR observation, separate reviewers | 0.15.3, commit dec37bc9941e; daemon ready after permitted local access | Engineering owner |
| Codex CLI | Non-interactive execution, existing saved authentication | 0.170.0; `login status`: ChatGPT; Orchestrator: installed/authorized | Pilot worker |
| Hermes | Company context/automation and optional coding delegation | v0.23.2 (2026.9.24), local ae2a81ccc00e; ordinary restricted invocation cannot write install lock; version works with permitted local access; Orchestrator catalog says needs install | Company role only; no live handoff or provider authentication verified |
| Claude Code | Headless `-p`, account authentication; Orchestrator worker/chat/reviewer adapter | CLI absent from PATH; Orchestrator says needs install/auth unknown; Claude desktop app is not CLI proof | Optional future comparison, blocked by installation/sign-in |
| Grok Build | TUI, headless and ACP; Orchestrator worker/chat/reviewer adapter | CLI absent; Orchestrator says needs install/auth unknown | Optional future comparison, blocked by installation/sign-in |

Orchestrator's CLI is bundled at
`/Applications/Agent Orchestrator.app/Contents/Resources/daemon/ao` but not on PATH.
A first restricted health probe reported operation not permitted on localhost;
a permitted retry proved healthz OK and readyz ready. This is an access-boundary
observation, not a daemon failure. Do not weaken permissions to hide it.
Hermes's executable exists but is not discovered as ready by Orchestrator; this
mismatch is unresolved and irrelevant to the selected engineering worker.

Current project configuration lives in Orchestrator's database, **not** a guessed
`agent-orchestrator.yaml`. Installed CLI accepts `--harness` for spawn (the online
examples sometimes use `--agent`). Inspect installed `--help` before applying recipes.
Default permission mode is retained. No credentials were copied between products.
Subscription availability and remaining quotas are account-specific; none imply
unlimited execution or transferable API credits.

## Primary documentation consulted

- [Orchestrator quickstart](https://docs.orchestrator.inc/quickstart/): task/worktree lifecycle.
- [Orchestrator project configuration](https://docs.orchestrator.inc/configuration/projects/): database configuration, rules and review roles.
- [Orchestrator CLI](https://docs.orchestrator.inc/cli/): daemon client and diagnostic commands.
- [Orchestrator agent catalog](https://docs.orchestrator.inc/plugins/agents/): adapter support versus actual readiness.
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) and [authentication](https://learn.chatgpt.com/docs/auth): execution and saved sign-in.
- [Claude Code headless](https://code.claude.com/docs/en/headless) and [authentication](https://code.claude.com/docs/en/authentication).
- [Grok Build overview](https://docs.x.ai/build/overview) and [CLI reference](https://docs.x.ai/build/cli/reference).
- [Hermes quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart) and [optional skills](https://hermes-agent.nousresearch.com/docs/reference/optional-skills-catalog): provider setup and optional delegation, not evidence of this account's readiness.
