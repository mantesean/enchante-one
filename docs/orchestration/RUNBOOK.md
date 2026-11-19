# Reproduce the pilot

## Preconditions and stop conditions

Use an already-installed Orchestrator and existing Codex ChatGPT sign-in. Check
`codex login status`, `ao status`, `ao agent ls --refresh` and installed `--help`.
Do not print tokens or credential files. If the CLI is not on PATH, use the app's
bundled executable. Do not install unknown npm packages named like the orchestrator.

Before starting a worker, confirm account billing is subscription-backed and that
it cannot silently fall back to an API key or extra usage. Stop on quota exhaustion,
authentication failure or paid-service requirements; ask the founder only for the
specific remaining decision. Do not disable security prompts to unblock a run.

Inspect local permissions before interpreting a localhost or install-lock error.
If access is refused, report the exact denied action and preserve the worktree.

## One engineering owner

1. Clone the repository to a dedicated checkout; record `git rev-parse HEAD`.
2. Register that checkout with `ao project add --path <absolute-path>`.
3. Set project worker to Codex, default branch to main, permission to default,
   and agent rules file to AGENTS.md. Preserve unrelated settings. Disable automatic
   issue intake and merge/deploy behaviors; do not symlink or copy credentials.
4. Spawn exactly one worker using the flags shown by installed `ao spawn --help`:

   ```sh
   ao spawn --project enchante-one --harness codex --mode chat \
     --branch feat/your-new-task --name 'Focused product task' \
     --prompt 'Implement the issue acceptance criteria; no paid APIs, no merge/deploy. Run checks and report evidence. Stop on blocked authentication. Do not delegate further.'
   ```

5. Confirm the session's branch and isolated worktree with `ao session get <id>`
   and `git worktree list`. A successful spawn is not a completed task.
6. Use `ao session get <id> --transcript 12 --cap 1500` to inspect progress.
   `session history` may show zero completed turns while an active turn is working.
   On a reproducible failure, send focused feedback to the same session with
   `ao send --session <id> --steer --message '...'`. Log retries and interventions.
7. Run locked installation, lint, typecheck, unit tests, production build and
   Playwright tests. Record exit status and revision. Inspect screenshots, not only
   test counts. Keep raw local logs out of this public repository until reviewed.
8. Obtain a reviewer in a separate context, with no authorship of implementation.
   Review the actual diff and CI permissions. Recheck fixes. Independent context
   using the same provider is not independent-model assurance.
9. Publish only the task branch and create a **draft** PR with evidence and blockers.
   If `gh` is unauthenticated, use the existing authorized GitHub connector rather
   than copying credentials. PR observation in Orchestrator can still be blocked
   by missing local `gh` authentication; document that separately.
10. Verify remote CI against the exact PR head. Do not imply local checks prove
    Linux CI passed. No success after skipped checks or unavailable artifacts.
11. Give the founder PR URL, head SHA, screenshot and limitations. Wait for an
    explicit merge decision. Deployment remains a separate decision.

## Company handoff

Hermes can prepare the issue brief and consume the evidence summary after provider
access and company-tool permissions are verified. Until then the supervisor carries
that handoff manually. Do not activate Hermes's coding-agent delegation for this
repo: Orchestrator is the engineering owner. No persistent background company
supervision has been demonstrated by this pilot.

## Failure and cleanup

Cancel only the pilot's own worker if it loops, exceeds scope or needs unavailable
access. Preserve dirty worktrees and logs; never force-delete or reset user work.
A failed CI run is feedback to the same task, not a reason to create another
orchestrator. Do not continue retrying a provider that reports an exhausted quota.
Keep the PR draft while any mandatory gate is unknown or failed.

## Economics record

Record start/end UTC, session ID, base/head commits, agent usage if provided,
retry count, supervisor interventions and founder decisions. Dollar-equivalent
subscription consumption and human attention are unknown unless measured. No paid
API calls or purchases are authorized. Hosted CI usage should remain standard
public-repository runners; do not select paid larger runners or add a paid service.
