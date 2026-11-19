# ENCH COMMAND

Read-only evidence adapter for public `mantesean/enchante-one` PRs. Requires Node 22+ and existing `gh` authentication. No model API, additional dependencies, tokens supplied by this tool, remote writes, orchestration or customer-app changes.

```sh
node command/collect.mjs 5 /tmp/ench-command
npm ci
npm run lint
npm run typecheck
npm test
npm run build
PLAYWRIGHT_SKIP_BROWSER_GC=1 npm run test:browser
```

Open the timestamped HTML locally; JSON records the source responses and per-request UTC timestamps. Files use exclusive creation and read-only mode (not tamper-proof storage); never commit live snapshots. No PR body is rendered. Only allowlisted GitHub repository URLs become links. API source URLs are plain text. Collection errors omit raw CLI errors to avoid leaking local credentials.

Exit codes: **0** inspectable metadata ready for human inspection, **2** blocked evidence (including draft, missing/stale/failed checks or review), **1** collection failure. Reports are written for all collected outcomes. Invalid arguments or filesystem errors also exit 1 and may prevent output. No exit code grants merge/deploy permission. A live draft PR returning 2 is expected, not a test failure.

The gate verifies GitHub Actions app ID/slug, `Pilot checks` workflow ID and `.github/workflows/ci.yml` path, latest run number/attempt associated with the requested PR number and base SHA at exact PR head, its `verify` job/check identity and success. Missing, queued, skipped, failed and stale evidence cannot pass. Latest effective approval/change-request/dismissal per case-insensitive login is used; comments do not revoke a review. Author/bot approvals cannot satisfy independence, and unresolved independent change requests block. PR head/base/draft/state, latest associated run and selected run attempt are rechecked at collection end. This is sequential evidence, not an atomic transaction; changes after any read remain possible. Merge-commit checks differing from PR head are conservatively rejected.

Pagination must finish (100 items/page, at most 20 pages per collection); otherwise evidence is unknown. Each CLI call is bounded to 20 seconds and 4 MiB. Missing matching browser archive metadata blocks readiness. Run artifact metadata can establish an unexpired `browser-results` archive at the head SHA, but not contents or latest-attempt provenance. Runtime readiness is always unknown: this adapter does not probe the application. No human/founder permission, protection enforcement or persistent GPT supervision is inferred.

`fixtures.mjs` is explicitly TEST-only and is never a production fallback. Browser tests cover desktop/mobile report and failure states with screenshots, no provider requests. Unit tests cover conservative gates and malicious data.
