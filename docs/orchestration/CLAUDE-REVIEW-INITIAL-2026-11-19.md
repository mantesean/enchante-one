# Claude independent review — 2026-11-19

Reviewed implementation finalized as 27da6521c4d4ac906a2e9c57ca973658fbda3d3d. Read-only Claude Code with existing claude.ai Pro login, restricted mode, Read/Glob/Grep only, no MCP servers, no permission bypass. Runtime reported model claude-opus-5-5, success, 13 turns, 70.546 seconds, no permission denials. Not GitHub approval. Reviewer findings are retained below as findings, not all accepted product requirements.

# Separate Claude review: ENCH COMMAND evidence adapter

**Model:** Claude Opus 5.5 (`claude-opus-5-5`), running inside Claude Code. This is a separate Claude review. It is not a GitHub approval or a founder authorization. I only read the files: I ran no tests, made no edits and contacted nothing external.

## Findings

**1. High: anyone on GitHub can satisfy the approval gate.** `command/evidence.mjs:88-89`, `:157`
- The "independent" filter only checks two things: `user.type === 'User'` and that the reviewer isn't the PR author. It never checks `author_association`.
- On a public repo, any logged-in GitHub user can submit an APPROVED review.
- **Trigger:** a random account approves the current head SHA. The review gate passes, and the report says "GitHub approval od jiného účtu doloženo".
- **Fix:** require `author_association` to be in {OWNER, MEMBER, COLLABORATOR}, or check against an explicit list of reviewer logins. Add a test where the approver is a NONE/CONTRIBUTOR account.
- **Side effect:** the same gap lets any outsider block the gate with CHANGES_REQUESTED. That still fails closed, but it's noisy.

**2. Medium: an older successful run can stand in for a newer run.** `command/evidence.mjs:63-64`
- `latestRun` filters runs *before* sorting. A newer run for the same `head_sha` is dropped if its `pull_requests` doesn't match, for example if it's empty or has a different base SHA. The older successful run then gets selected.
- That breaks the protocol rule "A later run cannot borrow an older successful result" (`OPERATING-PROTOCOL…:19`).
- The `filter=latest` check-run match at `:76` probably catches this against live data. But that relies on how the GitHub API behaves, not on the adapter's own logic.
- **Trigger (fixture):** push `{...runs[0], id: 43, run_number: 3, conclusion: 'failure', pull_requests: []}` into both `runs` and `runsEnd`. Reading the code, `outcome` stays 0. I haven't run this.
- **Fix:** block if any run with the same `head_sha` and `event === 'pull_request'` has a higher `run_number` than the selected run.

**3. Low: the target branch isn't checked.** `command/evidence.mjs:43`, `:70`
- `base.ref` is never compared with `main`. A PR into some other branch can still reach "Metadata připravena".

**4. Low: independence only looks at the PR author.** `command/evidence.mjs:88`
- Someone who pushed commits to the PR, but didn't open it, still counts as an independent reviewer.
- Accounts are matched by login only.

**5. Low: CI retries can turn a flaky failure green.** `playwright.config.ts:7`
- `retries: 1` in CI means a test that fails once and then passes still produces a successful `verify`.
- The browser-results artifact uses `if: always()` and `if-no-files-found: ignore` (`ci.yml:31,38`). It can therefore come from a failed or partial run. The adapter only checks name, size, run id and SHA, so the evidence is weaker than "browser tests passed".
- The report text already says the artifact contents aren't verified.

**6. Low: the JSON snapshot contains the full raw API responses.** `command/collect.mjs:11`
- That includes the PR body and user metadata. The README's "No PR body is rendered" is true for the HTML only.
- Say this in the README, or strip those fields from the JSON.

## Test coverage gaps
There are no tests for:
- a non-collaborator approval (would currently pass)
- a newer run filtered out (would currently pass)
- `state: 'closed'`
- a bot or `type !== 'User'` reviewer
- a base repo that is private or has the wrong `full_name`
- a malformed head SHA
- an artifact with the wrong `workflow_run.id`, wrong SHA, or `size_in_bytes: 0`
- a happy-path `collect()` run through the injected `get`, which would check the exact endpoints and the end-of-collection rechecks

## Verified as sound (by reading the code)
- **Fail-closed collection:** any fetch failure leads to exit 1.
- **Recheck at the end:** head, base, draft, state, run and attempt are all re-read.
- **Pagination:** bounded at 20 pages, with a `total_count` mismatch check.
- **Check provenance:** the check is tied to the job through `check_run_url`, plus the GitHub Actions app id 15368.
- **Reviews:** the latest review per lowercased login is used, and COMMENTED doesn't override an earlier review.
- **HTML safety:** all output goes through `escape`, links pass an anchored `safeUrl` allowlist, and a strict CSP is set.
- **No side effects:** only `gh api --method GET`; output files are written exclusive-create and read-only.
- **Wording:** the report and README clearly say it is not merge permission.

## Realistic limitations
- Reads happen one after another, not atomically, so things can change between them.
- There's no server-enforced branch protection on main, so a green report gates nothing.
- Artifact contents and which run attempt produced the artifact are never checked.
- `ghGet` uses whatever `gh` login is on the machine.
- The output should be treated as a draft decision aid only.

Findings 1 and 2 should be fixed before anyone treats a green report as meaningful. Nothing here is a blocking safety issue as long as the tool stays an evidence aid.

## Supervisor disposition

Findings 1 and 2 accepted for correction and regression tests. Finding 3 (force main) rejected: this task intentionally supports stacked PRs and verifies their actual base. Remaining observations are documented limitations or additional negative-test coverage. Artifact metadata is not represented as verified screenshot content. JSON is local public GitHub evidence and is never automatically published.
