# ENCHANTE ONE — bounded onboarding pilot

This pilot prepares a manual checklist. It does not fetch websites, resolve DNS,
identify companies, run AI analysis, collect interest, or offer paid access.
Input and checkbox progress remain in page memory and disappear on reload.

## Run locally

Use Node.js 22.13+ and npm. Dependencies are locked in `package-lock.json`.

```sh
npm ci
npm run dev
```

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium
npm run test:browser
```

Browser tests start the production build on loopback port 3100 (which must be
free), run Chromium at desktop and mobile sizes, and attach full-page checklist
screenshots to `playwright-report`. CI installs Chromium system dependencies and
uploads the report, screenshots and failure traces. Mobile coverage is Chromium
emulation, not physical-device or Safari coverage.

## Acceptance and risk

- Replace simulated waiting and invented insights with an immediate, explicit
  unavailable state and useful manual steps.
- Normalize HTTP(S) URLs to domains, including IDNs (displayed as ASCII punycode).
  Reject credentials, explicit ports (including default ports), IP literals and
  numeric IP aliases, single-label/local/reserved names and malformed labels.
- Label the input, associate errors, support keyboard submission and focus
  recovery, and allow changing the domain. No inert purchase buttons.
- Separate user-supplied facts from generic prompts; disclose their source,
  session timestamp, unassessed confidence and limitations.
- Verify domain edge cases with unit tests and the desktop/mobile journey with
  browser tests. Keep lint, strict typechecking and production build in CI.

Validation is syntactic. It does not consult a public suffix list, confirm a TLD
is delegated, check domain ownership or rule out a hostname resolving to private
IP space. Reserved/local suffixes and localhost labels are rejected. No network retrieval is implemented; this validator must not be treated
as SSRF protection for a future fetcher. URL paths, queries and fragments are
removed; encoded characters are conservatively rejected. Recommendations are
not company-specific, and checklist progress is deliberately not persisted.

The Google font dependency was removed; the UI uses system fonts. Registry
inspection confirmed the original Next 16.4.6, React 19.3.0 and Tailwind 4.3.3
versions were available. Tailwind uses its PostCSS integration. No paid API or
external model integration is included.
