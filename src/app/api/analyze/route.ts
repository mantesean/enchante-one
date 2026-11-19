import { analyzeDomain, type AnalyzeResult } from "@/lib/analyze";
import { normalizeDomain } from "@/lib/domain";
import { rateLimit, TtlCache } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance only (see src/lib/limits.ts). Only successful analyses are cached.
const cache = new TtlCache<AnalyzeResult>();

const MAX_REQUEST_BYTES = 4096;
async function boundedJson(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("missing body");
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (!stopped) {
      const {done, value} = await reader.read();
      if (stopped) throw new Error("request expired");
      if (done) return JSON.parse(Buffer.concat(chunks).toString("utf8"));
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) throw new Error("too large");
      chunks.push(value);
    }
    throw new Error("request expired");
  };
  try {
    return await Promise.race([read(), new Promise<never>((_,reject) => {
      timer = setTimeout(() => reject(new Error("request timeout")), 2000);
    })]);
  } finally {
    stopped = true;
    clearTimeout(timer);
    // An untrusted stream's cancel hook may itself never resolve.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export async function POST(req: Request) {
  // Public retrieval is explicitly opt-in; no external request by default.
  if (process.env.ENCH_PUBLIC_RETRIEVAL_ENABLED !== "true") {
    return json({ok:false,error:{code:"unavailable",message:"Website retrieval is disabled. No website was fetched. Review your homepage manually and record one observation."}},503);
  }
  // No trusted ingress identity is configured. Do not trust caller forwarding headers.
  if (!rateLimit("public-retrieval-instance")) {
    return json(
      { ok: false, error: { code: "rate_limited", message: "Too many requests. Please wait a minute and try again." } },
      429,
      { "retry-after": "60" },
    );
  }

  let input: unknown;
  try {
    input = ((await boundedJson(req)) as { domain?: unknown } | null)?.domain;
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
