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

type Candidate = Omit<Insight, "sourceUrl"> & { weight: number };

/** All candidate insights, unordered. Weight orders insights within the same status. */
function candidates(o: Observation, now: Date): Candidate[] {
  const { page } = o;
  const out: Candidate[] = [];
  const https = o.finalUrl.startsWith("https://");

  // HTTPS
  if (!https) {
    out.push({
      id: "https",
      title: "Site is not served over HTTPS",
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
      title: "Served securely over HTTPS",
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
      title: "No clear way to get in touch or buy",
      status: "issue",
      detail:
        "We found no contact, demo, booking, pricing, sign-up or buy link and no email/phone link on the homepage. Visitors ready to act have no obvious next step.",
      evidence: `no contact/demo/pricing/sign-up link among ${page.linkCount} links`,
      weight: 90,
    });
  } else {
    out.push({
      id: "cta",
      title: "Visitors have a clear next step",
      status: "good",
      detail: `The homepage offers ${page.ctas.length === 1 ? "a call to action" : `${page.ctas.length} calls to action`}, e.g. “${page.ctas[0].text || page.ctas[0].href}”.`,
      evidence: page.ctas[0].evidence,
      weight: 40,
    });
  }

  // Title
  if (!page.title) {
    out.push({
      id: "title",
      title: "Homepage has no title",
      status: "issue",
      detail: "Search results and browser tabs fall back to the bare URL without a <title>.",
      evidence: "<title> missing",
      weight: 80,
    });
  } else {
    const len = page.title.length;
    const evidence = `<title>${clip(page.title)}</title>`;
    if (len < 10 || len > 65) {
      out.push({
        id: "title",
        title: len < 10 ? "Page title is very short" : "Page title is likely truncated in search",
        status: "issue",
        detail:
          len < 10
            ? `At ${len} characters the title says little about what the company does.`
            : `At ${len} characters, search engines typically cut the title off around 60 characters.`,
        evidence,
        weight: 50,
      });
    } else {
      out.push({
        id: "title",
        title: "Clear page title",
        status: "good",
        detail: `A ${len}-character title fits search results without truncation.`,
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
      detail: "Search engines will improvise a snippet from page text, which you don’t control.",
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
          ? `At ${len} characters it will likely be cut off in search results (~155–160 shown).`
          : `A ${len}-character summary is available for search results and link previews.`,
      evidence: `<meta name="description" content="${clip(page.metaDescription)}">`,
      weight: 25,
    });
  }

  // Mobile viewport
  if (!page.viewport) {
    out.push({
      id: "viewport",
      title: "Not set up for mobile screens",
      status: "issue",
      detail: "Without a viewport meta tag, phones render the page zoomed-out like a desktop site.",
      evidence: "viewport meta missing",
      weight: 85,
    });
  } else {
    out.push({
      id: "viewport",
      title: "Mobile viewport configured",
      status: "good",
      detail: "The page declares a responsive viewport for phones.",
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
      detail: "The homepage has no <h1>, so neither visitors nor search engines get a single clear statement of what you do.",
      evidence: "no <h1> found",
      weight: 60,
    });
  } else if (page.h1.length > 1) {
    out.push({
      id: "h1",
      title: "Several competing headlines",
      status: "info",
      detail: `The homepage has ${page.h1.length} <h1> elements; one primary message is usually clearer.`,
      evidence: clip(`${page.h1.length} <h1>: ${page.h1.slice(0, 3).map((h) => `“${clip(h, 50)}”`).join(", ")}`),
      weight: 30,
    });
  } else {
    out.push({
      id: "h1",
      title: "Clear main headline",
      status: "good",
      detail: "The homepage leads with a single primary headline.",
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
        title: "Site looks out of date",
        status: "issue",
        detail: `The newest date we could see on the page is ${d.value}. Visitors read stale dates as a sign the company is inactive.`,
        evidence: d.evidence,
        weight: 70,
      });
    } else if (fresh) {
      out.push({
        id: "freshness",
        title: "Recently updated",
        status: "good",
        detail: `The newest date visible on the page is ${d.value}.`,
        evidence: d.evidence,
        weight: 15,
      });
    } else {
      out.push({
        id: "freshness",
        title: "Last visible update over a year ago",
        status: "info",
        detail: `The newest date visible on the page is ${d.value}.`,
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
      title: "Slow first response",
      status: "issue",
      detail: `The homepage took ${(o.ms / 1000).toFixed(1)} s to download from our server. Slow pages lose visitors before they load.`,
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
    .map(({ id, title, status, detail, evidence }) => ({ id, title, status, detail, evidence, sourceUrl: o.finalUrl }));
}
