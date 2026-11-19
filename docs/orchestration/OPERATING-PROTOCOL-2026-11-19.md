# ENCHANTE Operating Protocol — dated addendum 2026-11-19

This addendum supersedes earlier allocation of strategic authority to Hermes. Earlier pilot records remain historical evidence, not current availability guarantees.

## Authority and smallest architecture

- Founder owns goals, product acceptance, spending, merge and deployment decisions.
- GPT is the strategic decision protocol: translate intent into bounded acceptance criteria, choose one owner, examine evidence, reject unproven claims and recommend the next decision. This document is a protocol, not an always-running GPT process.
- Existing Orchestrator.inc owns engineering execution and durable local session history. One writable worktree and one owner per task. Codex implements; authenticated Claude Code reviews in a separate context. Grok is an optional independent challenger only after its own supported access is proven; no substitute may be labelled Grok.
- GitHub owns versioned changes, CI evidence and draft PRs. ENCH COMMAND is a read-only evidence projection of those sources, not another workflow engine, approval service or model gateway.
- Hermes stays outside the critical engineering path. Its gateway is not proof of an authenticated company supervisor or reliable handoff.

## Intent contract

Record the repository, immutable base SHA, intended outcome, acceptance tests, non-goals, data boundary, cost boundary, allowed writes, owner/session and stop conditions. For this cycle: build an evidence collector and founder decision view atop PR #5; leave customer onboarding unchanged; stop at draft PR.

## Deterministic rejection rules

Missing, failed, pending, skipped, unauthenticated, partially fetched or stale evidence is never a successful gate. CI must belong to the expected repository/workflow and current head, with the required job completed successfully. A later run cannot borrow an older successful result. A review must be independent of the author and current for the exact revision. A snapshot states when it was collected and is not live monitoring. Browser fixtures prove behavior, not real provider availability. A model review report is not a GitHub approval or founder authorization.

Collect evidence before publication: locked install, lint, types, unit tests, build, desktop/mobile browser tests and inspected screenshots. Recheck consequential fixes on the final executable revision. Record failing attempts and supervisor interventions. Publish only a reviewed draft branch; no automatic merge or deployment.

## Security and approval boundary

Use supported CLIs with the user's own existing subscription authentication. Never extract/copy OAuth tokens, browser cookies or secrets. No paid API fallback, additional credits or new services. Stop on quota exhaustion. Worktrees isolate files, not the host or credentials; retain provider permissions and do not use bypass flags. Read-only review gets no editing or external mutation authority.

Live inspection found main branch protection absent (GitHub authenticated API HTTP 404, Branch not protected) and rulesets empty. Thus server-enforced founder approval is NOT established. Draft status and this protocol do not protect against another credential holder merging. This implementation has no merge/deploy endpoint. Enabling unattended integration requires separate verified protection, a distinct reviewer identity where necessary, and removal of bypass rights. No policy change or auto-merge is authorized by a green report.

## Runtime and availability

Observed 2026-11-19: Orchestrator 0.15.3 daemon healthz/readyz successful, PID 10779, start 14:37:37 UTC; existing and new sessions readable across separate client invocations. This establishes local execution and stored history only. No reboot/crash recovery, remote-host operation, sleep resilience or 24/7 GPT supervision has been tested. Remote host disabled. Docker daemon unavailable.

Hermes 0.23.2 reports a registered launchd definition but detached gateway processes, inactive service and a mixed-version warning. No restart is performed because that could interrupt existing work. Provider readiness and automatic handoff are unverified.

Codex reports ChatGPT sign-in. Claude Code 2.1.326 was initially signed out; following one requested user login, it reports claude.ai / Pro and Orchestrator reports authorized. Execution success still requires an actual review result. Grok CLI is absent and the Orchestrator catalog reports needs install/auth unknown. No model API keys were present in this shell's billing-override environment checks; no credential values were read.

## Selection evidence

Orchestrator is retained because it is installed, authenticated for Codex/Claude, creates isolated worktrees and already delivered PR #5. The new cycle must demonstrate its actual contribution rather than infer readiness from marketing.

Symphony documents isolated autonomous runs but its reference implementation is an engineering preview and its documented example uses Linear. Gas Town supplies persistent git-backed coordination but adds a second work-management architecture. Neither has been benchmarked on this machine; there is no evidence that migration improves this bounded task. Hermes has a diagnosed service mismatch and is not needed to execute this cycle. These are contextual selection reasons, not a universal product ranking.

Primary sources checked 2026-11-19:
- https://docs.orchestrator.inc/quickstart/
- https://docs.orchestrator.inc/configuration/projects/
- https://learn.chatgpt.com/docs/cli/reference
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/legal-and-compliance
- https://docs.x.ai/build/overview
- https://docs.x.ai/build/cli/reference
- https://hermes-agent.nousresearch.com/docs/getting-started/quickstart
- https://github.com/openai/symphony
- https://github.com/gastownhall/gastown

## Costs and audit

No new spend is authorized. Subscription quota consumption and dollar-equivalent usage remain unknown unless the provider exposes them; do not label them zero. Record session IDs, UTC timestamps, commits, checks, review results and interventions. Keep account identifiers and raw provider logs local. Public evidence must contain no credentials or private customer data. Existing source files and historical records are preserved; corrections use dated appendices.
