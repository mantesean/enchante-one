# ENCHANTE orchestration pilot — 2026-11-19

## Decision and scope

Hermes owns **company orchestration**: founder intent, priorities, business context,
acceptance criteria, and outcome tracking. Orchestrator.inc owns **engineering
orchestration**: one task owner, isolated Git worktree/branch, coding harness,
review feedback and PR/CI observation. GitHub owns code and verification records.
The founder alone decides whether to merge or deploy.

Do not enable Hermes coding delegation for this repository, nest another engineering
scheduler, or extend PR #3's `control/` engine. A human/supervisor-mediated handoff
is the initial integration; no automatic Hermes → Orchestrator bridge is claimed.
Orchestrator's Hermes harness is not needed for this division of responsibility.

The benchmark is issue #2, as required by issue #4: replace invented company
analysis with honest unavailable onboarding and a useful manual next step. This
is a product slice, not a decorative control dashboard. Retrieval and payments
remain unavailable. No database, queue, AI API adapter or custom agent runner.

## Handoff contract (use an issue, not a new service)

Company side supplies: task ID, business outcome, non-goals, acceptance criteria,
allowed repository, base commit, risk assessment, permitted tools and cost limit.
Engineering side returns: owning session, branch and commit, commands/exits,
CI URL, browser evidence, independent findings, limitations and approval request.
One active engineering owner per task; retry the same owner rather than spawning
competing writers. Failed or unknown gates stay blocked, never become green by
writing a status string. A business hypothesis is not a measured business result.

Pilot spending policy: existing authenticated subscription only; no paid API keys,
credit purchases, new subscriptions or production hosting. Record actual usage
when exposed; unknown dollar cost must be marked unknown rather than zero.

## Audit of the starting repository

Audited main `914d93a07a1d2223feec2d027e054a8b37e148bc`, PR #3 head
`9a323b7513bd7a74fbe0111d02288c0a49fd6663`, and issues #2/#4.

- Main had three application files and package.json, no lockfile, CI, TypeScript
  config, unit tests or browser tests. The form waited 1.2 seconds then invented
  three company insights. Founding Access had no handler. The Google font required
  network access at build time.
- PR #3 is draft, unmerged, with no submitted review at audit time. Six added files
  implement a local JSON state machine, CLI and three tests, not agent execution.
- Its actor environment variable is forgeable; arbitrary nonempty evidence passes;
  persisted approval is a string; updates overwrite JSON without concurrency control.
  These are not authenticated quality/approval gates. Keep PR #3 separate and draft;
  do not build production orchestration on it. This audit does not delete its data.
- Issue #2 is the customer-facing acceptance contract. Issue #4 explicitly requires
  proving an existing-agent delivery cycle before custom control UI.
- Repository rulesets returned `[]`. Branch protection inspection through the GitHub
  integration returned HTTP 403. Absence of rulesets does not prove absence of legacy
  protection. Server-enforced founder approval is **not verified**.

## Quality gates

| Gate | Required evidence | Authority |
| --- | --- | --- |
| Truth | No invented observations/citations; no retrieval claim without retrieval | tests + reviewer |
| Software | Locked install, lint, typecheck, unit tests, production build | local + GitHub CI |
| Browser | Desktop/mobile validation, error/retry/result journeys, screenshot review | Playwright + reviewer |
| Safety | No secrets/API calls, validated input, least-privilege CI, no deploy workflow | code review |
| Independent review | Separate reviewer context, findings tied to exact code revision, fixes rechecked | reviewer |
| Product | Founder sees actual screenshots and limitations; no business-value guarantee | founder |
| Merge | Explicit founder approval naming PR and current head SHA, after checks | founder only |
| Deploy | Separate approval naming target and exact commit; deployment evidence | founder only |

A passing CI run does not approve a merge. A local report or model verdict is not
an authenticated approval. The pilot stops at a draft PR and contains no merge or
deploy automation. Before enabling unattended integration, an administrator must
configure and verify required checks, stale-review dismissal, force-push/deletion
protection and restricted merge authority. Deployment needs a protected environment
with founder approval. Agents must not have bypass authority. Because the connected
account may also be the PR author, do not promise that CODEOWNERS alone can enforce
its approval: GitHub disallows approving one's own PR.

Worktrees isolate files, not credentials or operating-system access. Provider
permission controls remain necessary. Never copy `.env`, browser profiles or provider
tokens into worktrees; do not enable unrestricted permission modes. Review logs
before publishing: repository is public.
