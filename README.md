# enchante-one
ENCHANTE ONE - Universal intelligent operating layer for companies. Genesis MVP.

Enter a company domain → we fetch its public homepage once (server-side, SSRF-guarded) and show a
short company profile plus 3–5 insights. Every insight cites the exact string we observed
(`<title>…</title>`, `meta description missing`, `final URL https://…`, `© 2019`, `response 1840 ms`).
If the site can't be fetched, the UI says so and shows **no** insights.

## Run

```bash
npm install
cp .env.example .env.local   # optional, see below
npm run dev                  # http://localhost:3000
npm test                     # vitest (node env)
npm run lint
npm run build && npm start
```

Node 20+ (tested on Node 24).

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FOUNDING_ACCESS_URL` | no | Stripe **Payment Link** for Founding Access. Must start with `https://`. Missing/invalid → the button renders disabled as "Coming soon". Inlined at **build** time — rebuild after changing it. |
| `NEXT_PUBLIC_SITE_URL` | no | Public site URL (`https://ench.one`). |

No secret keys are used anywhere.

## Architecture

```
src/app/page.tsx                 client UI: form → POST /api/analyze → profile + insights / honest error
src/app/api/analyze/route.ts     Node runtime, dynamic. Validate → rate limit → cache → analyze
src/lib/domain.ts                normalizeDomain(): strip scheme/path/port/www, reject IPs, localhost, single-label
src/lib/ssrf.ts                  safeFetch(): DNS-validated, IP-pinned, manual redirects (≤3), 8 s, 1.5 MB cap
src/lib/analyze.ts               https → (www on DNS failure) → http fallback; maps failures to error codes
src/lib/extract.ts               pure HTML extraction (node-html-parser)
src/lib/insights.ts              pure insight rules + profile builder
src/lib/limits.ts                in-memory per-IP rate limit (10/min) and 10-min per-domain cache
src/lib/pricing.ts               FOUNDING_ACCESS_PRICE_LABEL ("$990") + payment link validation
src/components/                  FoundingAccessButton, SiteFooter, LegalPlaceholder
src/app/legal/{terms,refund}     placeholder pages ("content pending")
tests/                           vitest: ssrf, transport, domain, extract, insights, pricing
```

### API

`POST /api/analyze` with `{"domain": "example.com"}`:

- `200 {ok:true, domain, profile:{name, description, finalUrl, fetchedAt}, insights:[{id,title,status,detail,evidence,sourceUrl}], fetch:{…}}`
- `200 {ok:false, domain, error:{code:"unreachable"|"timeout"|"blocked"|"too_large"|"http_error", message}}`
- `400 {ok:false, domain, error:{code:"refused", …}}` — the domain resolves to a non-public address
- `400 {ok:false, error:{code:"invalid", message}}` — not a usable domain
- `429` — more than 10 requests/minute from one IP

The rate limit and cache are **per server instance** (in memory); on serverless hosting they are
approximate and not shared between instances.

## What Martin must configure before taking money

1. **Stripe Payment Link** — create it in the Stripe dashboard (price $990 USD), set
   `NEXT_PUBLIC_FOUNDING_ACCESS_URL` in the hosting env, and rebuild. To change the displayed price,
   edit `FOUNDING_ACCESS_PRICE_LABEL` in `src/lib/pricing.ts` *and* the Payment Link.
2. **Seller identification** in `src/components/SiteFooter.tsx` (marked `TODO (Martin)`).
3. **Terms** (`src/app/legal/terms/page.tsx`) and **Refund policy** (`src/app/legal/refund/page.tsx`).
4. Optionally a shared store (e.g. Redis) if per-instance rate limiting is not enough.

See [SECURITY.md](SECURITY.md) for the SSRF design and residual risks.
