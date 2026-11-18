# Security notes

## Threat: SSRF via the analyze endpoint

`POST /api/analyze` makes our server fetch a user-chosen site. Without guards, it could be pointed
at cloud metadata (`169.254.169.254`), localhost services, or internal networks.

### Defences (src/lib/domain.ts, src/lib/ssrf.ts)

1. **Input normalization** — only a bare hostname survives (scheme/path/query/port/credentials/`www.`
   stripped, lowercased, IDNA → punycode). IP literals (incl. `[::1]`, decimal/hex forms),
   `localhost`, single-label names and reserved TLDs (`.local`, `.internal`, `.test`, …) → 400.
   The server only ever builds `https://<host>/` or `http://<host>/` itself.
2. **Scheme allow-list** — `http:` and `https:` only, on every hop; URLs with credentials refused.
3. **DNS validation** — `dns.promises.lookup(host, {all: true})`; the request is refused if **any**
   returned address is blocked:
   loopback `127/8`, `::1`; private `10/8`, `172.16/12`, `192.168/16`, `fc00::/7`; link-local
   `169.254/16` (incl. metadata), `fe80::/10`; `0.0.0.0/8`, `::`; CGNAT `100.64/10`; multicast
   `224/4`, `ff00::/8`; reserved `240/4`, broadcast; TEST-NETs, benchmarking `198.18/15`, 6to4,
   Teredo, NAT64 with private payloads, and IPv4-mapped/compatible IPv6 wrapping any of these.
   Unparseable addresses are blocked (fail closed).
4. **IP pinning** — the socket connects to the exact address that was validated (custom `lookup`
   passed to `http(s).request`), so a second, different DNS answer (DNS rebinding) can't redirect
   the connection. TLS SNI and certificate checks still use the hostname.
5. **Manual redirects** — at most 3; each `Location` is re-parsed, scheme-checked, re-resolved,
   re-validated and re-pinned before connecting.
6. **Resource limits** — one 8 s deadline (AbortController) for the whole chain; body streamed and
   aborted past 1.5 MB (after decompression); `User-Agent: EnchanteOneBot/0.1 (+https://ench.one)`.
7. **Abuse limits** — 10 requests/min per client IP (429) and a 10-minute per-domain cache of
   successful results. Both are in-memory and per instance.
8. SSRF refusals return `400 {error:{code:"refused"}}`; we never retry around them (e.g. no http fallback).

### Residual risks

- **Per-instance limits.** Rate limiting and caching live in process memory; with many serverless
  instances an attacker gets roughly 10/min per instance. Use a shared store if this matters.
- **Client IP trust.** The limiter keys on the first `X-Forwarded-For` value, which is only
  trustworthy behind a proxy that overwrites it (e.g. Vercel). Elsewhere it can be spoofed.
- **Public targets.** We will send one GET (plus fallbacks) to any public host a user names. This is
  the intended function; the rate limit bounds abuse as a request amplifier.
- **No egress firewall.** Defence is in application code only. A network-level egress policy that
  denies private ranges would be a valuable second layer.
- **Decompression** is capped by output bytes, not CPU time; the 8 s deadline bounds it.
- **Proxies/fake-IP DNS.** In environments whose resolver returns synthetic addresses (e.g.
  `198.18.0.0/15`), every lookup is refused. That is intentional fail-closed behaviour.

## Payments

Founding Access uses a **Stripe Payment Link** (`NEXT_PUBLIC_FOUNDING_ACCESS_URL`), i.e. a plain
`<a href>` to a Stripe-hosted page. The app holds no Stripe secret keys, creates no Checkout
Sessions and handles no card data. The URL is accepted only if it parses as `https://`; otherwise the
button is rendered disabled ("Coming soon"). There is no webhook yet, so fulfilment is manual.
