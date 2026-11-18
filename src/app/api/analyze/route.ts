import { analyzeDomain, type AnalyzeResult } from "@/lib/analyze";
import { normalizeDomain } from "@/lib/domain";
import { rateLimit, TtlCache } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance only (see src/lib/limits.ts). Only successful analyses are cached.
const cache = new TtlCache<AnalyzeResult>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export async function POST(req: Request) {
  if (!rateLimit(clientIp(req))) {
    return json(
      { ok: false, error: { code: "rate_limited", message: "Too many requests. Please wait a minute and try again." } },
      429,
      { "retry-after": "60" },
    );
  }

  let input: unknown;
  try {
    input = ((await req.json()) as { domain?: unknown } | null)?.domain;
  } catch {
    return json({ ok: false, error: { code: "invalid", message: "Please send JSON like {\"domain\": \"example.com\"}." } }, 400);
  }

  const norm = normalizeDomain(input);
  if (!norm.ok) return json({ ok: false, error: { code: "invalid", message: norm.error } }, 400);
  const domain = norm.domain;

  const cached = cache.get(domain);
  if (cached) return json(cached, 200, { "x-cache": "hit" });

  const result = await analyzeDomain(domain);
  if (result.ok) cache.set(domain, result);
  return json(result, !result.ok && result.error.code === "refused" ? 400 : 200);
}
