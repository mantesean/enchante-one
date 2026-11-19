import { clip, type Extracted } from "./extract";

/**
 * Pure insight derivation. Every insight's `evidence` is a string copied from the fetched
 * response (markup, header, final URL or measured timing) — or an explicit statement that
 * something was absent from it. Nothing is inferred from outside the response.
 */

export type InsightStatus = "good" | "issue" | "info";

export interface Insight {
  id: string;
  title: string;
  status: InsightStatus;
  detail: string;
  evidence: string;
  sourceUrl: string;
  observedAt: string;
  limitation: string;
}

export interface Observation {
  domain: string;
  finalUrl: string;
  /** True when https:// failed and we had to fetch over http://. */
  usedHttpFallback: boolean;
  headers: Record<string, string>;
  ms: number;
  page: Extracted;
}

export interface Profile {
  name: string;
  description: string;
  finalUrl: string;
  fetchedAt: string;
}

export const MAX_INSIGHTS = 5;
export const MIN_INSIGHTS = 3;
const DAY = 24 * 60 * 60 * 1000;

const TITLE_SEPARATORS = /\s+[|–—·:-]\s+/;

export function cleanTitle(title: string): string {
  return title.split(TITLE_SEPARATORS)[0].trim();
}

export function buildProfile(domain: string, finalUrl: string, page: Extracted, fetchedAt: Date): Profile {
  const titleName = page.title ? cleanTitle(page.title) : "";
  return {
    name: page.ogSiteName || titleName || domain,
    description: page.metaDescription || page.ogDescription || "No public description found",
    finalUrl,
    fetchedAt: fetchedAt.toISOString(),
  };
}

type Candidate = Omit<Insight, "sourceUrl" | "observedAt" | "limitation"> & { weight: number };

/** All candidate insights, unordered. Weight orders insights within the same status. */
function candidates(o: Observation, now: Date): Candidate[] {
  const { page } = o;
  const out: Candidate[] = [];
  const https = o.finalUrl.startsWith("https://");

  // HTTPS
  if (!https) {
    out.push({
      id: "https",
      title: "This response used HTTP",
      status: "issue",
      detail: o.usedHttpFallback
        ? "The HTTPS version did not respond, so we had to load the site over plain HTTP. Browsers mark such pages as “Not secure”."
        : "The homepage ended on a plain HTTP address. Browsers mark such pages as “Not secure”.",
      evidence: `final URL ${o.finalUrl}`,
      weight: 100,
    });
  } else {
    out.push({
      id: "https",
      title: "This response used HTTPS",
      status: "good",
      detail: "The homepage loads over an encrypted connection.",
      evidence: `final URL ${o.finalUrl}`,
      weight: 20,
    });
  }

  // Call to action
  if (page.ctas.length === 0) {
    out.push({
      id: "cta",
      title: "No supported CTA text detected in this response",
      status: "issue",
      detail:
        "The static English-language heuristic found no matching link or button. Other languages, client-rendered content and unrecognized wording may contain a valid next step. Check the rendered page manually.",
      evidence: `no contact/demo/pricing/sign-up link among ${page.linkCount} links`,
      weight: 90,
    });
  } else {
    out.push({
      id: "cta",
      title: "CTA-like text found in the HTML",
      status: "good",
      detail: `The HTML contains ${page.ctas.length} heuristic match(es), e.g. “${page.ctas[0].text || page.ctas[0].href}”. Visibility, usability and destination behavior have not been verified.`,
      evidence: page.ctas[0].evidence,
      weight: 40,
    });
  }

  // Title
  if (!page.title) {
    out.push({
      id: "title",
      title: "No title detected in the response",
      status: "issue",
      detail: "No title element was detected in this static response. Rendered content and search appearance were not checked.",
      evidence: "<title> missing",
      weight: 80,
    });
  } else {
    const len = page.title.length;
    const evidence = `<title>${clip(page.title)}</title>`;
    if (len < 10 || len > 65) {
      out.push({
        id: "title",
        title: len < 10 ? "Short title string detected" : "Long title string detected",
        status: "issue",
        detail:
          len < 10
            ? `The title contains ${len} characters. Clarity has not been assessed.`
            : `The title contains ${len} characters. Search rendering has not been assessed.`,
        evidence,
        weight: 50,
      });
    } else {
      out.push({
        id: "title",
        title: "Title string detected",
        status: "good",
        detail: `The title contains ${len} characters. This does not establish clarity or search appearance.`,
        evidence,
        weight: 30,
      });
    }
  }

  // Meta description
  if (!page.metaDescription) {
    out.push({
      id: "description",
      title: "No meta description",
      status: "issue",
      detail: "No description meta tag was detected in this response. Search results were not checked.",
      evidence: "meta description missing",
      weight: 75,
    });
  } else {
    const len = page.metaDescription.length;
    out.push({
      id: "description",
      title: len > 160 ? "Meta description is long" : "Meta description is set",
      status: len > 160 ? "info" : "good",
      detail:
        len > 160
          ? `The description contains ${len} characters. Actual search appearance is unknown.`
          : `A ${len}-character summary is available for search results and link previews.`,
      evidence: `<meta name="description" content="${clip(page.metaDescription)}">`,
      weight: 25,
    });
  }

  // Mobile viewport
  if (!page.viewport) {
    out.push({
      id: "viewport",
      title: "No viewport meta tag detected",
      status: "issue",
      detail: "No viewport meta tag was detected. Mobile rendering was not tested.",
      evidence: "viewport meta missing",
      weight: 85,
    });
  } else {
    out.push({
      id: "viewport",
      title: "Viewport meta tag detected",
      status: "good",
      detail: "A viewport meta tag was found; its correctness and mobile rendering were not tested.",
      evidence: `<meta name="viewport" content="${clip(page.viewport, 120)}">`,
      weight: 10,
    });
  }

  // H1
  if (page.h1.length === 0) {
    out.push({
      id: "h1",
      title: "No main headline (H1)",
      status: "issue",
      detail: "No H1 was detected in the static response. The rendered page may differ; message clarity was not assessed.",
      evidence: "no <h1> found",
      weight: 60,
    });
  } else if (page.h1.length > 1) {
    out.push({
      id: "h1",
      title: "Multiple H1 elements detected",
      status: "info",
      detail: `The static response contains ${page.h1.length} H1 elements. Visual hierarchy was not tested.`,
      evidence: clip(`${page.h1.length} <h1>: ${page.h1.slice(0, 3).map((h) => `“${clip(h, 50)}”`).join(", ")}`),
      weight: 30,
    });
  } else {
    out.push({
      id: "h1",
      title: "One H1 element detected",
      status: "good",
      detail: "One H1 element was detected. Visibility and clarity were not tested.",
      evidence: `<h1>${clip(page.h1[0], 120)}</h1>`,
      weight: 35,
    });
  }

  // Freshness
  const d = page.newestDate;
  if (d) {
    const ageDays = Math.floor((now.getTime() - d.time) / DAY);
    const nowYear = now.getUTCFullYear();
    // A copyright year only tells us the year; older than last year counts as stale.
    const stale = d.source === "copyright" ? Number(d.value) < nowYear - 1 : ageDays > 730;
    const fresh = d.source === "copyright" ? Number(d.value) >= nowYear - 1 : ageDays <= 365;
    if (stale) {
      out.push({
        id: "freshness",
        title: "Older date string detected",
        status: "issue",
        detail: `The latest extracted date string is ${d.value}. It may describe copyright or an event; it does not establish company activity or update history.`,
        evidence: d.evidence,
        weight: 70,
      });
    } else if (fresh) {
      out.push({
        id: "freshness",
        title: "Recent or future date string detected",
        status: "good",
        detail: `The latest extracted date string is ${d.value}; its meaning and visibility are unverified.`,
        evidence: d.evidence,
        weight: 15,
      });
    } else {
      out.push({
        id: "freshness",
        title: "Date string older than one year",
        status: "info",
        detail: `The latest extracted date string is ${d.value}; its meaning and visibility are unverified.`,
        evidence: d.evidence,
        weight: 15,
      });
    }
  } else if (o.headers["last-modified"]) {
    out.push({
      id: "freshness",
      title: "Server reports a last-modified date",
      status: "info",
      detail: "No date is visible on the page itself; the server header is the only freshness signal.",
      evidence: `Last-Modified: ${clip(o.headers["last-modified"], 80)}`,
      weight: 5,
    });
  }

  // Response time
  if (o.ms > 3000) {
    out.push({
      id: "speed",
      title: "Response download duration above three seconds",
      status: "issue",
      detail: `The response took ${(o.ms / 1000).toFixed(1)} s to download from this server. This is not a browser performance or conversion measurement.`,
      evidence: `response ${o.ms} ms`,
      weight: 65,
    });
  } else if (o.ms < 1000) {
    out.push({
      id: "speed",
      title: "Fast response",
      status: "good",
      detail: "The homepage downloaded in under a second from our server.",
      evidence: `response ${o.ms} ms`,
      weight: 5,
    });
  }

  return out;
}

const STATUS_RANK: Record<InsightStatus, number> = { issue: 0, good: 1, info: 2 };

/**
 * Issues first (most impactful first), then notable goods, then info. Capped at 5.
 * The rule set always yields at least MIN_INSIGHTS entries for a fetched page.
 */
export function deriveInsights(o: Observation, now: Date = new Date()): Insight[] {
  return candidates(o, now)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.weight - a.weight)
    .slice(0, MAX_INSIGHTS)
    .map(({ id, title, status, detail, evidence }) => ({ id, title, status, detail, evidence, sourceUrl: o.finalUrl, observedAt: now.toISOString(), limitation: "Static response only; no rendered-page, company, or business-outcome verification." }));
}
