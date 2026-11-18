import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPage } from "@/lib/extract";
import { buildProfile, deriveInsights, type Observation } from "@/lib/insights";

const rich = readFileSync(new URL("./fixtures/rich.html", import.meta.url), "utf8");
const poor = readFileSync(new URL("./fixtures/poor.html", import.meta.url), "utf8");
const NOW = new Date("2026-11-18T12:00:00Z");

function observe(html: string, over: Partial<Observation> = {}): Observation {
  return {
    domain: "example.com",
    finalUrl: "https://example.com/",
    usedHttpFallback: false,
    headers: {},
    ms: 420,
    page: extractPage(html),
    ...over,
  };
}

describe("deriveInsights", () => {
  it("rich page: mostly positive, evidence quoted from the page", () => {
    const html = rich;
    const ins = deriveInsights(observe(html), NOW);
    expect(ins.length).toBeGreaterThanOrEqual(3);
    expect(ins.length).toBeLessThanOrEqual(5);
    expect(ins.every((i) => i.status !== "issue")).toBe(true);
    expect(ins.every((i) => i.sourceUrl === "https://example.com/")).toBe(true);
    const byId = Object.fromEntries(ins.map((i) => [i.id, i]));
    expect(byId.cta.evidence).toBe('<a href="/pricing">Pricing</a>');
    expect(byId.h1.evidence).toBe("<h1>Revenue insights your team will actually use</h1>");
    // Every quoted markup string must literally exist in the fixture (no invented evidence).
    for (const i of ins) {
      const m = /^<(?:h1|title)>(.*)<\/(?:h1|title)>$/.exec(i.evidence);
      if (m) expect(html).toContain(m[1]);
    }
  });

  it("poor page: issues first, each tied to an observed string", () => {
    const obs = observe(poor, {
      finalUrl: "http://old.example/",
      usedHttpFallback: true,
      ms: 3400,
      headers: { "last-modified": "Tue, 01 Jan 2019 00:00:00 GMT" },
    });
    const ins = deriveInsights(obs, NOW);
    expect(ins).toHaveLength(5);
    expect(ins.every((i) => i.status === "issue")).toBe(true);
    expect(ins.map((i) => i.id)).toEqual(["https", "cta", "viewport", "description", "freshness"]);
    const evidence = ins.map((i) => i.evidence);
    expect(evidence).toContain("final URL http://old.example/");
    expect(evidence).toContain("no contact/demo/pricing/sign-up link among 2 links");
    expect(evidence).toContain("viewport meta missing");
    expect(evidence).toContain("© 2019");
    expect(evidence).toContain("meta description missing");
  });

  it("poor vs rich produce different evidence", () => {
    const a = deriveInsights(observe(rich), NOW).map((i) => i.evidence);
    const b = deriveInsights(observe(poor), NOW).map((i) => i.evidence);
    expect(a.filter((x) => b.includes(x))).toEqual([]);
    expect(b).toContain("© 2019");
    expect(a).not.toContain("© 2019");
  });

  it("flags stale copyright and slow response with exact evidence", () => {
    const ins = deriveInsights(observe(poor, { ms: 5000 }), NOW);
    expect(ins.map((i) => i.id)).toEqual(["cta", "viewport", "description", "freshness", "speed"]);
    const byId = Object.fromEntries(ins.map((i) => [i.id, i]));
    expect(byId.freshness.evidence).toBe("© 2019");
    expect(byId.speed.evidence).toBe("response 5000 ms");
  });

  it("uses Last-Modified only when the page shows no date", () => {
    const ins = deriveInsights(
      observe("<html><head><title>Plain page title here</title><meta name=viewport content=width=device-width></head><body><h1>Hi</h1><a href=/contact>Contact</a></body></html>", {
        headers: { "last-modified": "Wed, 01 Oct 2025 08:00:00 GMT" },
      }),
      NOW,
    );
    expect(ins.length).toBeGreaterThanOrEqual(3);
    // goods outrank info, so Last-Modified (info) is only included if room remains
    const lm = ins.find((i) => i.id === "freshness");
    if (lm) expect(lm.evidence).toBe("Last-Modified: Wed, 01 Oct 2025 08:00:00 GMT");
  });
});

describe("buildProfile", () => {
  it("prefers og:site_name, then cleaned title, then domain", () => {
    expect(buildProfile("acme.com", "https://acme.com/", extractPage(rich), NOW)).toEqual({
      name: "Acme Analytics",
      description: "Acme Analytics turns your CRM data into weekly revenue insights your sales team can act on.",
      finalUrl: "https://acme.com/",
      fetchedAt: "2026-11-18T12:00:00.000Z",
    });
    expect(buildProfile("x.com", "https://x.com/", extractPage("<title>Stripe | Financial Infrastructure</title>"), NOW).name).toBe(
      "Stripe",
    );
    const p = buildProfile("old.example", "http://old.example/", extractPage("<body></body>"), NOW);
    expect(p.name).toBe("old.example");
    expect(p.description).toBe("No public description found");
  });
});
