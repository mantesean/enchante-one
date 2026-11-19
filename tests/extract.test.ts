import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPage } from "@/lib/extract";

const rich = readFileSync(new URL("./fixtures/rich.html", import.meta.url), "utf8");
const poor = readFileSync(new URL("./fixtures/poor.html", import.meta.url), "utf8");

describe("extractPage — rich fixture", () => {
  const e = extractPage(rich);

  it("reads title, description, site name, h1 and viewport", () => {
    expect(e.title).toBe("Acme Analytics | Revenue insights for B2B teams");
    expect(e.metaDescription).toMatch(/^Acme Analytics turns your CRM data/);
    expect(e.ogSiteName).toBe("Acme Analytics");
    expect(e.h1).toEqual(["Revenue insights your team will actually use"]);
    expect(e.viewport).toBe("width=device-width, initial-scale=1");
  });

  it("finds CTA links by text and href", () => {
    const texts = e.ctas.map((c) => c.text);
    expect(texts).toContain("Pricing");
    expect(texts).toContain("Book a demo");
    expect(e.ctas.find((c) => c.text === "Book a demo")?.evidence).toBe('<a href="/demo">Book a demo</a>');
  });

  it("picks the newest date across copyright, <time>, meta and JSON-LD", () => {
    expect(e.newestDate).toMatchObject({ value: "2026-10-02", source: "json-ld", evidence: '"dateModified": "2026-10-02"' });
  });
});

describe("extractPage — poor fixture", () => {
  const e = extractPage(poor);

  it("reports missing fields as null/empty", () => {
    expect(e.title).toBe("Home");
    expect(e.metaDescription).toBeNull();
    expect(e.viewport).toBeNull();
    expect(e.ogSiteName).toBeNull();
    expect(e.h1).toEqual([]);
    expect(e.ctas).toEqual([]);
    expect(e.linkCount).toBe(2);
  });

  it("uses the visible copyright year and ignores script text", () => {
    expect(e.newestDate).toMatchObject({ value: "2019", source: "copyright", evidence: "© 2019" });
  });

  it("detects mailto/tel links as contact CTAs", () => {
    const e2 = extractPage('<body><a href="mailto:hi@example.com">hi@example.com</a><a href="tel:+420123">Call</a></body>');
    expect(e2.ctas).toHaveLength(2);
  });
});
