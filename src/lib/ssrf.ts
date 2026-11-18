import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";

/**
 * SSRF-safe HTTP GET client (server-only). See SECURITY.md for the full design.
 *
 * - http/https only, no URL credentials.
 * - Resolves the hostname with dns.promises.lookup({ all: true }) and refuses the request if
 *   ANY resolved address is non-public (see isBlockedAddress).
 * - DNS pinning: the socket connects to the exact address we validated (custom `lookup` passed
 *   to http(s).request), so a second DNS answer cannot steer the connection to an internal host.
 *   TLS SNI and certificate validation still use the original hostname.
 * - Manual redirects (max 3); every hop is re-parsed, re-resolved and re-validated.
 * - One AbortController deadline covers the whole chain (8 s).
 * - Body is streamed and the request aborted once it exceeds 1.5 MB (after decompression).
 */

export const USER_AGENT = "EnchanteOneBot/0.1 (+https://ench.one)";
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_BYTES = 1.5 * 1024 * 1024;
export const DEFAULT_MAX_REDIRECTS = 3;

export type SafeFetchErrorCode =
  | "bad_url"
  | "bad_scheme"
  | "blocked_address"
  | "dns"
  | "connect"
  | "tls"
  | "timeout"
  | "too_large"
  | "too_many_redirects";

export class SafeFetchError extends Error {
  constructor(
    public code: SafeFetchErrorCode,
    message: string,
    public url?: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export interface SafeResponse {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  /** ms from request start until the body was fully read (includes redirects). */
  ms: number;
  bytes: number;
  redirects: Array<{ from: string; status: number; to: string }>;
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface TransportRequest {
  url: URL;
  address: ResolvedAddress;
  headers: Record<string, string>;
  signal: AbortSignal;
  maxBytes: number;
}

export interface TransportResponse {
  status: number;
  headers: Record<string, string>;
  /** Reads the (decompressed) body, failing with too_large past maxBytes. */
  readBody: () => Promise<Buffer>;
  /** Discards the body without reading it (used for redirect responses). */
  discard: () => void;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
  /** Test seams. */
  resolver?: Resolver;
  transport?: Transport;
}

// ---------------------------------------------------------------------------
// IP classification
// ---------------------------------------------------------------------------

function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

function parseIPv6(input: string): number[] | null {
  let ip = input.toLowerCase();
  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  // Embedded IPv4 tail (e.g. ::ffff:127.0.0.1)
  let tail: number[] = [];
  const lastColon = ip.lastIndexOf(":");
  if (lastColon !== -1 && ip.slice(lastColon + 1).includes(".")) {
    const v4 = parseIPv4(ip.slice(lastColon + 1));
    if (v4 === null) return null;
    tail = [(v4 >>> 16) & 0xffff, v4 & 0xffff];
    ip = ip.slice(0, lastColon + 1) + "0:0";
  }
  const dbl = ip.split("::");
  if (dbl.length > 2) return null;
  const head = dbl[0] ? dbl[0].split(":") : [];
  const rest = dbl.length === 2 ? (dbl[1] ? dbl[1].split(":") : []) : [];
  const groups =
    dbl.length === 2 ? [...head, ...Array(Math.max(0, 8 - head.length - rest.length)).fill("0"), ...rest] : head;
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  if (tail.length) {
    out[6] = tail[0];
    out[7] = tail[1];
  }
  return out;
}

const V4_BLOCKS: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (incl. 169.254.169.254 cloud metadata)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

const V4_PARSED = V4_BLOCKS.map(([base, bits]) => {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return { net: (parseIPv4(base)! & mask) >>> 0, mask };
});

function isBlockedV4Num(n: number): boolean {
  return V4_PARSED.some(({ net, mask }) => ((n & mask) >>> 0) === net);
}

function v6InPrefix(g: number[], prefix: number[], bits: number): boolean {
  let remaining = bits;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    const take = Math.min(16, remaining);
    const mask = take === 16 ? 0xffff : (0xffff << (16 - take)) & 0xffff;
    if ((g[i] & mask) !== ((prefix[i] ?? 0) & mask)) return false;
    remaining -= take;
  }
  return true;
}

/**
 * True when the address is NOT safe to connect to: private, loopback, link-local, unique-local,
 * CGNAT, multicast, reserved/documentation, unspecified, cloud metadata, or an IPv4-mapped /
 * compatible / NAT64 IPv6 address wrapping any of those. Unparseable input is blocked (fail closed).
 */
export function isBlockedAddress(ip: string): boolean {
  if (typeof ip !== "string" || !ip) return true;
  const bare = ip.replace(/^\[|\]$/g, "").split("%")[0];
  const kind = net.isIP(bare);
  if (kind === 4) {
    const n = parseIPv4(bare);
    return n === null ? true : isBlockedV4Num(n);
  }
  if (kind !== 6) return true;
  const g = parseIPv6(bare);
  if (!g) return true;
  const embeddedV4 = ((g[6] << 16) | g[7]) >>> 0;

  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isBlockedV4Num(embeddedV4); // ::ffff:a.b.c.d
  if (g.slice(0, 6).every((x) => x === 0)) return true; // ::, ::1, deprecated ::a.b.c.d
  if (g.slice(0, 4).every((x) => x === 0) && g[4] === 0xffff && g[5] === 0) return true; // ::ffff:0:a.b.c.d
  if (v6InPrefix(g, [0x64, 0xff9b], 96)) return isBlockedV4Num(embeddedV4); // NAT64
  if (v6InPrefix(g, [0x64, 0xff9b, 0x1], 48)) return true; // local-use NAT64
  if (v6InPrefix(g, [0x100], 64)) return true; // discard-only
  if (v6InPrefix(g, [0x2001, 0x0], 32)) return true; // Teredo
  if (v6InPrefix(g, [0x2001, 0x2], 48)) return true; // benchmarking
  if (v6InPrefix(g, [0x2001, 0xdb8], 32)) return true; // documentation
  if (v6InPrefix(g, [0x2001, 0x10], 28)) return true; // ORCHID
  if (v6InPrefix(g, [0x2001, 0x20], 28)) return true; // ORCHIDv2
  if (v6InPrefix(g, [0x2002], 16)) return true; // 6to4 (may embed private v4)
  if (v6InPrefix(g, [0x3fff], 20)) return true; // documentation (RFC 9637)
  if (v6InPrefix(g, [0x5f00], 16)) return true; // SRv6 SIDs
  if (v6InPrefix(g, [0xfc00], 7)) return true; // unique local
  if (v6InPrefix(g, [0xfe80], 10)) return true; // link-local
  if (v6InPrefix(g, [0xfec0], 10)) return true; // site-local (deprecated)
  if (v6InPrefix(g, [0xff00], 8)) return true; // multicast
  return false;
}

// ---------------------------------------------------------------------------
// Default resolver + transport
// ---------------------------------------------------------------------------

export const defaultResolver: Resolver = async (hostname) => {
  const res = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return res.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
};

function flattenHeaders(h: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
  }
  return out;
}

async function readCapped(stream: Readable, maxBytes: number, url: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > maxBytes) {
      stream.destroy();
      throw new SafeFetchError("too_large", `Response exceeded ${maxBytes} bytes`, url);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export const nodeTransport: Transport = (req) =>
  new Promise((resolve, reject) => {
    const mod = req.url.protocol === "https:" ? https : http;
    const pinned = req.address;
    const r = mod.request(
      req.url,
      {
        method: "GET",
        headers: req.headers,
        signal: req.signal,
        agent: false,
        // Pin the connection to the address we validated (defeats DNS rebinding between check and use).
        lookup: ((_hostname: string, options: dns.LookupOptions, cb: (...args: unknown[]) => void) => {
          if (options && options.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
          else cb(null, pinned.address, pinned.family);
        }) as unknown as typeof dns.lookup,
        ...(req.url.protocol === "https:" ? { servername: req.url.hostname } : {}),
      },
      (res) => {
        const enc = String(res.headers["content-encoding"] || "").toLowerCase().trim();
        let stream: Readable = res;
        if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
        if (stream !== res) stream.on("error", () => res.destroy());
        resolve({
          status: res.statusCode ?? 0,
          headers: flattenHeaders(res.headers),
          readBody: () => readCapped(stream, req.maxBytes, req.url.toString()),
          discard: () => res.destroy(),
        });
      },
    );
    r.on("error", reject);
    r.end();
  });

// ---------------------------------------------------------------------------
// safeFetch
// ---------------------------------------------------------------------------

function classifyNetError(err: unknown, url: string, aborted: boolean): SafeFetchError {
  if (err instanceof SafeFetchError) return err;
  if (aborted) return new SafeFetchError("timeout", "Request timed out", url);
  const e = err as NodeJS.ErrnoException & { name?: string };
  const code = e?.code ?? "";
  if (e?.name === "AbortError" || code === "ABORT_ERR") return new SafeFetchError("timeout", "Request timed out", url);
  if (code === "ETIMEDOUT") return new SafeFetchError("timeout", "Connection timed out", url);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new SafeFetchError("dns", `DNS lookup failed (${code})`, url);
  if (/CERT|SSL|TLS|UNABLE_TO_VERIFY|SELF_SIGNED|HOSTNAME_MISMATCH|EPROTO/i.test(`${code} ${e?.message ?? ""}`))
    return new SafeFetchError("tls", `TLS error (${code || "handshake failed"})`, url);
  return new SafeFetchError("connect", `Connection failed${code ? ` (${code})` : ""}`, url);
}

function decodeBody(buf: Buffer, contentType: string | undefined): string {
  let charset = /charset=([^;]+)/i.exec(contentType || "")?.[1]?.trim().replace(/["']/g, "");
  if (!charset) charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 2048).toString("latin1"))?.[1];
  try {
    return new TextDecoder(charset || "utf-8").decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

/** Validate the URL's host and return the address to pin the connection to. */
export async function resolveAndValidate(url: URL, resolver: Resolver = defaultResolver): Promise<ResolvedAddress> {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const blocked = () => new SafeFetchError("blocked_address", "Target address is not public", url.toString());
  const ipKind = net.isIP(host);
  if (ipKind) {
    if (isBlockedAddress(host)) throw blocked();
    return { address: host, family: ipKind === 6 ? 6 : 4 };
  }
  if (host === "localhost" || host.endsWith(".localhost") || !host.includes(".")) throw blocked();
  let addrs: ResolvedAddress[];
  try {
    addrs = await resolver(host);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code ?? "";
    throw new SafeFetchError("dns", `DNS lookup failed${code ? ` (${code})` : ""}`, url.toString());
  }
  if (!addrs.length) throw new SafeFetchError("dns", "DNS lookup returned no addresses", url.toString());
  // Refuse if ANY answer is non-public: an attacker could otherwise mix public and private records.
  if (addrs.some((a) => isBlockedAddress(a.address))) throw blocked();
  return addrs.find((a) => a.family === 4) ?? addrs[0];
}

export async function safeFetch(input: string | URL, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const resolver = opts.resolver ?? defaultResolver;
  const transport = opts.transport ?? nodeTransport;

  let current: URL;
  try {
    current = new URL(String(input));
  } catch {
    throw new SafeFetchError("bad_url", "Invalid URL", String(input));
  }
  const requestedUrl = current.toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onOuterAbort, { once: true });
  const started = performance.now();
  const redirects: SafeResponse["redirects"] = [];

  try {
    for (let hop = 0; ; hop++) {
      if (current.protocol !== "http:" && current.protocol !== "https:") {
        throw new SafeFetchError("bad_scheme", `Unsupported scheme ${current.protocol}`, current.toString());
      }
      if (current.username || current.password) {
        throw new SafeFetchError("bad_url", "URLs with credentials are not allowed", current.toString());
      }
      const address = await resolveAndValidate(current, resolver);
      if (controller.signal.aborted) throw new SafeFetchError("timeout", "Request timed out", current.toString());

      let res: TransportResponse;
      try {
        res = await transport({
          url: current,
          address,
          headers: {
            "user-agent": USER_AGENT,
            accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
            "accept-language": "en;q=1.0, *;q=0.5",
            "accept-encoding": "gzip, deflate, br",
          },
          signal: controller.signal,
          maxBytes,
        });
      } catch (err) {
        throw classifyNetError(err, current.toString(), controller.signal.aborted);
      }

      const location = res.headers["location"];
      if ([301, 302, 303, 307, 308].includes(res.status) && location) {
        res.discard();
        if (hop >= maxRedirects) {
          throw new SafeFetchError("too_many_redirects", `More than ${maxRedirects} redirects`, current.toString());
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new SafeFetchError("bad_url", "Invalid redirect location", current.toString());
        }
        redirects.push({ from: current.toString(), status: res.status, to: next.toString() });
        current = next; // re-validated at the top of the loop
        continue;
      }

      let buf: Buffer;
      try {
        buf = await res.readBody();
      } catch (err) {
        throw classifyNetError(err, current.toString(), controller.signal.aborted);
      }
      return {
        requestedUrl,
        finalUrl: current.toString(),
        status: res.status,
        headers: res.headers,
        body: decodeBody(buf, res.headers["content-type"]),
        ms: Math.round(performance.now() - started),
        bytes: buf.length,
        redirects,
      };
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onOuterAbort);
  }
}
