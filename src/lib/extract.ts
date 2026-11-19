import { parse, type HTMLElement } from "node-html-parser";

/**
 * Pure HTML extraction: no network, no clock. Every field keeps the exact observed string
 * (or a faithful, length-capped excerpt) so insights can cite it as evidence.
 */

export interface DateSignal {
  /** Comparable timestamp (ms). Bare years map to Jan 1 of that year (conservative). */
  time: number;
  /** ISO date (YYYY-MM-DD) or bare year as observed. */
  value: string;
  source: "copyright" | "time" | "meta" | "json-ld";
  /** Exact observed string, e.g. `© 2019` or `<time datetime="2024-05-01">`. */
  evidence: string;
}

export interface CtaLink {
  text: string;
  href: string | null;
  /** Exact-ish markup excerpt, e.g. `<a href="/demo">Book a demo</a>`. */
  evidence: string;
}

export interface Extracted {
  title: string | null;
  metaDescription: string | null;
  ogDescription: string | null;
  ogSiteName: string | null;
  h1: string[];
  viewport: string | null;
  ctas: CtaLink[];
  linkCount: number;
  newestDate: DateSignal | null;
}

export const EVIDENCE_MAX = 220;

export function clip(s: string, max = EVIDENCE_MAX): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

const CTA_RE = /\b(contact|demo|book|get started|sign ?up|buy|pricing)\b/i;
const CTA_HREF_RE = /^(mailto:|tel:)|\b(contact|demo|book|get-started|signup|sign-up|pricing|buy)\b/i;

function text(el: HTMLElement): string {
  return el.textContent.replace(/\s+/g, " ").trim();
}

function metaContent(root: HTMLElement, attr: "name" | "property", key: string): string | null {
  for (const el of root.querySelectorAll(`meta[${attr}]`)) {
    if ((el.getAttribute(attr) || "").toLowerCase().trim() === key) {
      const v = el.getAttribute("content")?.replace(/\s+/g, " ").trim();
      return v || null;
    }
  }
  return null;
}

/** Parse an ISO-ish date string; returns null for anything we can't read unambiguously. */
function parseDate(raw: string): { time: number; value: string } | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(raw.trim());
  if (!m) return null;
  const value = `${m[1]}-${m[2]}${m[3] ? `-${m[3]}` : ""}`;
  const time = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1));
  return Number.isFinite(time) ? { time, value } : null;
}

function collectJsonLdDates(node: unknown, out: Array<{ key: string; value: string }>, depth = 0): void {
  if (!node || depth > 8) return;
  if (Array.isArray(node)) {
    for (const n of node) collectJsonLdDates(n, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if ((k === "dateModified" || k === "datePublished") && typeof v === "string") out.push({ key: k, value: v });
    else if (typeof v === "object") collectJsonLdDates(v, out, depth + 1);
  }
}

function visibleText(body: HTMLElement): string {
  const clone = parse(body.toString());
  for (const el of clone.querySelectorAll("script,style,noscript,template,svg")) el.remove();
  return clone.textContent.replace(/&copy;/g, "©").replace(/\s+/g, " ");
}

function findDates(root: HTMLElement, body: HTMLElement): DateSignal[] {
  const out: DateSignal[] = [];

  // Copyright years: "© 2019", "Copyright 2015–2024" (newest year in a range wins).
  const vis = visibleText(body);
  const cRe = /(©|\(c\)|copyright)\s*((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)\d{2}))?/gi;
  let m: RegExpExecArray | null;
  while ((m = cRe.exec(vis))) {
    const year = Number(m[3] ?? m[2]);
    out.push({ time: Date.UTC(year, 0, 1), value: String(year), source: "copyright", evidence: clip(m[0]) });
  }

  for (const el of root.querySelectorAll("time[datetime]")) {
    const raw = el.getAttribute("datetime") || "";
    const d = parseDate(raw);
    if (d) out.push({ ...d, source: "time", evidence: `<time datetime="${clip(raw, 60)}">` });
  }

  for (const key of ["article:modified_time", "og:updated_time", "article:published_time"]) {
    const raw = metaContent(root, "property", key);
    const d = raw ? parseDate(raw) : null;
    if (d && raw) out.push({ ...d, source: "meta", evidence: `<meta property="${key}" content="${clip(raw, 60)}">` });
  }

  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse((s.rawText || "").trim());
    } catch {
      continue;
    }
    const found: Array<{ key: string; value: string }> = [];
    collectJsonLdDates(data, found);
    for (const f of found) {
      const d = parseDate(f.value);
      if (d) out.push({ ...d, source: "json-ld", evidence: `"${f.key}": "${clip(f.value, 60)}"` });
    }
  }
  return out;
}

function findCtas(body: HTMLElement): { ctas: CtaLink[]; linkCount: number } {
  const ctas: CtaLink[] = [];
  const els = body.querySelectorAll("a,button");
  for (const el of els) {
    const tag = el.tagName.toLowerCase();
    const label = text(el) || el.getAttribute("aria-label")?.trim() || "";
    const href = tag === "a" ? el.getAttribute("href")?.trim() || null : null;
    const matches = (label && label.length <= 60 && CTA_RE.test(label)) || (href && CTA_HREF_RE.test(href));
    if (!matches) continue;
    const attrs = href ? ` href="${clip(href, 80)}"` : "";
    ctas.push({ text: clip(label, 60), href, evidence: `<${tag}${attrs}>${clip(label, 60)}</${tag}>` });
    if (ctas.length >= 10) break;
  }
  return { ctas, linkCount: body.querySelectorAll("a[href]").length };
}

export function extractPage(html: string): Extracted {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: true, pre: true },
  });
  const body = root.querySelector("body") ?? root;
  const titleEl = root.querySelector("title");
  const { ctas, linkCount } = findCtas(body);
  const dates = findDates(root, body);
  const newestDate = dates.reduce<DateSignal | null>((a, d) => (!a || d.time > a.time ? d : a), null);

  return {
    title: titleEl ? text(titleEl) || null : null,
    metaDescription: metaContent(root, "name", "description"),
    ogDescription: metaContent(root, "property", "og:description"),
    ogSiteName: metaContent(root, "property", "og:site_name"),
    h1: body.querySelectorAll("h1").map(text).filter(Boolean),
    viewport: metaContent(root, "name", "viewport"),
    ctas,
    linkCount,
    newestDate,
  };
}
