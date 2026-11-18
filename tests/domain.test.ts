import { describe, expect, it } from "vitest";
import { normalizeDomain } from "@/lib/domain";

describe("normalizeDomain", () => {
  it.each([
    ["example.com", "example.com"],
    ["  Example.COM  ", "example.com"],
    ["https://www.example.com/path?q=1#x", "example.com"],
    ["http://example.com:8080", "example.com"],
    ["www.sub.example.co.uk/", "sub.example.co.uk"],
    ["example.com.", "example.com"],
  ])("normalizes %s -> %s", (input, expected) => {
    expect(normalizeDomain(input)).toEqual({ ok: true, domain: expected });
  });

  it.each([
    "",
    "   ",
    "localhost",
    "http://localhost:3000",
    "intranet",
    "127.0.0.1",
    "http://10.0.0.1/",
    "[::1]",
    "http://[::1]:80/",
    "exa mple.com",
    "-bad-.com",
    "foo..com",
    "ftp://example.com",
    "printer.local",
  ])("rejects %j", (input) => {
    const r = normalizeDomain(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
  });

  it("rejects non-strings", () => {
    expect(normalizeDomain(42).ok).toBe(false);
    expect(normalizeDomain(undefined).ok).toBe(false);
  });
});
