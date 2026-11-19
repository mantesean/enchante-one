import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDomain } from "../src/lib/domain";

for (const [input, domain] of [
  ["  ExAmPlE.COM  ", "example.com"],
  ["https://WWW.Example.com/about?q=one#team", "www.example.com"],
  ["http://shop.example.co.uk/", "shop.example.co.uk"],
  ["example.com.", "example.com"],
  ["bücher.de", "xn--bcher-kva.de"],
  ["home.com", "home.com"],
  ["test.company.com", "test.company.com"],
]) {
  test(`normalizes ${input}`, () => assert.deepEqual(normalizeDomain(input), { ok: true, domain }));
}

for (const input of [
  "", "  ", "localhost", "company", "company.local", "company.internal", "company.lan",
  "company.home", "company.test", "company.invalid", "company.example", "company.onion", "a.home.arpa",
  "localhost.com", "https://user:password@example.com", "https://@example.com", "user@example.com",
  "example.com:443", "https://example.com:443", "http://example.com:80", "https://example.com:",
  "ftp://example.com", "javascript:alert(1)", "https:example.com", "//example.com",
  "127.0.0.1", "127.1", "2130706433", "0x7f000001", "0177.0.0.1", "[::1]", "https://[2001:db8::1]",
  "example..com", "-example.com", "example-.com", "exa_mple.com", "example.123",
  "a".repeat(64) + ".com", Array(5).fill("a".repeat(60)).join("."),
  "https://exa mple.com", "https://example.com\n.evil.com", "example.com\\evil.com",
  "https://%65xample.com", "https:///example.com", "https://example.com../",
]) {
  test(`rejects ${JSON.stringify(input)}`, () => assert.equal(normalizeDomain(input).ok, false));
}
