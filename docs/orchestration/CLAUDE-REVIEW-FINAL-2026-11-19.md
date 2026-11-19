# Claude final review — 2026-11-19

Restricted read-only Claude Code with existing claude.ai Pro login. Runtime success, 7 turns, 25.554 seconds. Exact Git metadata read was correctly denied by restricted file scope; no permission was bypassed. Supervisor independently verified clean worktree at cee451dff255f586bc6adf361e51f939b467cf1f and created the integration worktree directly from that commit. No executable files changed during this review.

# Re-review of ENCH COMMAND: separate Claude review, not a GitHub approval

**Model:** Claude Opus 5.5 (`claude-opus-5-5`). I only read files: no edits, tests or external calls.

**I couldn't confirm the SHA.** The worktree's git directory is outside the folder my tools are allowed to read, so I can't confirm that `cee451dff255f586bc6adf361e51f939b467cf1f` is the checked-out revision. This verdict covers the working-tree contents of the four files I read. It applies to that SHA only if those files match it.

## Both fixes hold

**1. Reviewer authorization** (`command/evidence.mjs:93`)
- Approvals now count only from non-author `User` accounts whose `author_association` is OWNER, MEMBER or COLLABORATOR. Bots, NONE, CONTRIBUTOR and missing values are all excluded.
- Tests cover the three allowed associations, the three rejected values, and a bot (`evidence.test.mjs:65-76`).
- `otherChanges` (`:23`) still blocks because its reviewer inherits COLLABORATOR from the fixture. Change requests from outside accounts no longer block, and the README states this (`README.md:19`).

**2. No reuse of an older successful run** (`command/evidence.mjs:62-68, 76-86`)
- `latestRun` now picks the newest run by workflow, head SHA and event *before* checking anything else.
- `associatedRun` then requires the PR number and base/head SHAs to match in all three observations: the first run list, the final run list and the final single-run fetch.
- So a newer run with a missing or wrong PR association now blocks instead of letting an older success through.
- The regression tests cover both run lists with an empty or wrong association (`evidence.test.mjs:77-92`).

**Also improved:**
- The latest review per reviewer is now chosen by `submitted_at`, and the review gate fails closed if any decisive review has no valid time (`:88-90`).
- The collector rejects a bad base SHA (`:43`).
- There's a happy-path test that checks the exact GET paths (`evidence.test.mjs:110-132`).
- Stacked PRs work as intended, with no `main` requirement.
- The README now says the raw JSON includes the PR body.

## Verdict

**No blocking findings** in the reviewed contents. The adapter fails closed on every identity, pagination, provenance and review path I traced. HTML output is escaped, links are restricted to an allowlist, and it only makes GitHub GET requests.

## Remaining limits (none blocking)
- **Not atomic:** the PR and runs can change after any individual read.
- **No enforcement:** main has no branch protection, so a green report authorizes nothing.
- **Account vs. human:** a different account doesn't prove a different person, and people who pushed commits aren't checked for independence.
- **Fork PRs:** their runs have empty `pull_requests`, so they will always be blocked (fail-closed).
- **Browser artifact:** only its metadata is checked, not its contents or which attempt produced it. CI uploads it with `if: always()`, and Playwright retries once (`playwright.config.ts:7`), so "artifact present" doesn't prove the browser tests passed.
- **Uses the local `gh` login:** the outcome depends on that session's access and how GitHub's API behaves (e.g. `filter=latest`, `author_association`).
- **Review timing:** if two decisive reviews from one person share the same `submitted_at`, the higher review id wins. That is reasonable but untested.

This is a draft evidence review only. It is not a GitHub approval, founder authorization, or permission to merge or deploy.
