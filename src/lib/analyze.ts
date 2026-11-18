import { extractPage } from "./extract";
import { buildProfile, deriveInsights, type Insight, type Profile } from "./insights";
import { safeFetch, SafeFetchError, type SafeFetchOptions, type SafeResponse } from "./ssrf";

export type AnalyzeErrorCode = "unreachable" | "timeout" | "blocked" | "refused" | "too_large" | "http_error";

export type AnalyzeResult =
  | {
      ok: true;
      domain: string;
      profile: Profile;
      insights: Insight[];
      fetch: { finalUrl: string; status: number; ms: number; usedHttpFallback: boolean; httpsError: string | null };
    }
  | { ok: false; domain: string; error: { code: AnalyzeErrorCode; message: string } };

function fail(domain: string, code: AnalyzeErrorCode, message: string): AnalyzeResult {
  return { ok: false, domain, error: { code, message } };
}

function mapError(domain: string, err: unknown): AnalyzeResult {
  if (!(err instanceof SafeFetchError)) return fail(domain, "unreachable", "the connection failed");
  switch (err.code) {
    case "blocked_address":
    case "bad_scheme":
    case "bad_url":
      return fail(domain, "refused", "it points to a private, local or otherwise non-public address");
    case "timeout":
      return fail(domain, "timeout", "the site did not respond within 8 seconds");
    case "too_large":
      return fail(domain, "too_large", "the homepage is larger than 1.5 MB");
    case "dns":
      return fail(domain, "unreachable", "the domain does not resolve (DNS lookup failed)");
    case "tls":
      return fail(domain, "unreachable", "the secure connection failed");
    case "too_many_redirects":
      return fail(domain, "unreachable", "the site redirected more than 3 times");
    default:
      return fail(domain, "unreachable", "the connection failed");
  }
}

/** Never retry around an SSRF refusal or an oversize body. */
function isFinal(err: unknown): boolean {
  return err instanceof SafeFetchError && ["blocked_address", "bad_scheme", "bad_url", "too_large"].includes(err.code);
}

/**
 * Fetch https://domain/ (then https://www.domain/ if the apex has no DNS), falling back to
 * http://domain/. Returns the first successful response and why https failed, if it did.
 */
async function fetchHomepage(
  domain: string,
  opts: SafeFetchOptions,
): Promise<{ res: SafeResponse; usedHttpFallback: boolean; httpsError: string | null }> {
  let httpsErr: unknown;
  try {
    return { res: await safeFetch(`https://${domain}/`, opts), usedHttpFallback: false, httpsError: null };
  } catch (err) {
    if (isFinal(err)) throw err;
    httpsErr = err;
  }
  if (httpsErr instanceof SafeFetchError && httpsErr.code === "dns") {
    try {
      return { res: await safeFetch(`https://www.${domain}/`, opts), usedHttpFallback: false, httpsError: null };
    } catch (err) {
      if (isFinal(err)) throw err;
    }
  }
  // A timeout already consumed the budget; don't double the wait.
  if (httpsErr instanceof SafeFetchError && httpsErr.code === "timeout") throw httpsErr;
  try {
    const res = await safeFetch(`http://${domain}/`, opts);
    const httpsError = httpsErr instanceof Error ? httpsErr.message : "https failed";
    return { res, usedHttpFallback: true, httpsError };
  } catch (err) {
    if (isFinal(err)) throw err;
    throw httpsErr;
  }
}

export async function analyzeDomain(
  domain: string,
  opts: SafeFetchOptions & { now?: Date } = {},
): Promise<AnalyzeResult> {
  let fetched: Awaited<ReturnType<typeof fetchHomepage>>;
  try {
    fetched = await fetchHomepage(domain, opts);
  } catch (err) {
    return mapError(domain, err);
  }
  const { res, usedHttpFallback, httpsError } = fetched;

  if ([401, 403, 429].includes(res.status) || res.headers["cf-mitigated"] === "challenge") {
    return fail(domain, "blocked", `the site refused our automated request (HTTP ${res.status})`);
  }
  if (res.status < 200 || res.status >= 300) {
    return fail(domain, "http_error", `the site responded with HTTP ${res.status}`);
  }
  const type = res.headers["content-type"] ?? "";
  if (type && !/html/i.test(type)) {
    return fail(domain, "http_error", `the homepage is not an HTML page (${type.split(";")[0]})`);
  }

  const page = extractPage(res.body);
  const now = opts.now ?? new Date();
  return {
    ok: true,
    domain,
    profile: buildProfile(domain, res.finalUrl, page, now),
    insights: deriveInsights(
      { domain, finalUrl: res.finalUrl, usedHttpFallback, headers: res.headers, ms: res.ms, page },
      now,
    ),
    fetch: { finalUrl: res.finalUrl, status: res.status, ms: res.ms, usedHttpFallback, httpsError },
  };
}
