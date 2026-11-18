import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeDomain } from "@/lib/analyze";
import { nodeTransport, SafeFetchError, type Resolver, type Transport } from "@/lib/ssrf";

// Real node transport against a loopback server. safeFetch itself would refuse 127.0.0.1, so
// these tests call the transport directly with an explicitly pinned address.
let server: http.Server;
let port = 0;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/big") {
      res.writeHead(200, { "content-type": "text/html" });
      const chunk = Buffer.alloc(64 * 1024, 97);
      let sent = 0;
      const write = () => {
        while (sent < 3 * 1024 * 1024) {
          sent += chunk.length;
          if (!res.write(chunk)) return void res.once("drain", write);
        }
        res.end();
      };
      write();
      return;
    }
    res.writeHead(200, { "content-type": "text/html", "x-host": String(req.headers.host) });
    res.end("<title>pinned</title>");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("nodeTransport", () => {
  it("connects to the pinned address even when the hostname does not resolve", async () => {
    const res = await nodeTransport({
      url: new URL(`http://pinned.invalid:${port}/`),
      address: { address: "127.0.0.1", family: 4 },
      headers: {},
      signal: new AbortController().signal,
      maxBytes: 1024,
    });
    expect(res.status).toBe(200);
    expect(res.headers["x-host"]).toBe(`pinned.invalid:${port}`);
    expect((await res.readBody()).toString()).toBe("<title>pinned</title>");
  });

  it("aborts bodies over the size cap", async () => {
    const res = await nodeTransport({
      url: new URL(`http://pinned.invalid:${port}/big`),
      address: { address: "127.0.0.1", family: 4 },
      headers: {},
      signal: new AbortController().signal,
      maxBytes: 1.5 * 1024 * 1024,
    });
    const err = await res.readBody().then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(SafeFetchError);
    expect((err as SafeFetchError).code).toBe("too_large");
  });
});

describe("analyzeDomain", () => {
  const resolver: Resolver = async () => [{ address: "93.184.215.14", family: 4 }];
  const NOW = new Date("2026-11-18T12:00:00Z");

  it("falls back to http when https fails and records it", async () => {
    const transport: Transport = async (req) => {
      if (req.url.protocol === "https:") throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
      return {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        readBody: async () => Buffer.from("<title>Old Co</title><body>© 2019</body>"),
        discard: () => {},
      };
    };
    const r = await analyzeDomain("old.example.com", { resolver, transport, now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fetch.usedHttpFallback).toBe(true);
    expect(r.fetch.httpsError).toMatch(/ECONNREFUSED/);
    expect(r.profile.name).toBe("Old Co");
    expect(r.insights[0]).toMatchObject({ id: "https", status: "issue", evidence: "final URL http://old.example.com/" });
  });

  it("reports unreachable sites honestly with no insights", async () => {
    const transport: Transport = async () => {
      throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    };
    const r = await analyzeDomain("down.example.com", { resolver, transport });
    expect(r).toEqual({
      ok: false,
      domain: "down.example.com",
      error: { code: "unreachable", message: "the connection failed" },
    });
  });

  it("returns refused (not a fallback) when DNS points to a private address", async () => {
    const r = await analyzeDomain("internal.example.com", {
      resolver: async () => [{ address: "10.0.0.7", family: 4 }],
      transport: async () => {
        throw new Error("must not connect");
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("refused");
  });

  it("maps HTTP errors and bot walls", async () => {
    const make = (status: number): Transport => async () => ({
      status,
      headers: { "content-type": "text/html" },
      readBody: async () => Buffer.from(""),
      discard: () => {},
    });
    const a = await analyzeDomain("a.example.com", { resolver, transport: make(404) });
    const b = await analyzeDomain("b.example.com", { resolver, transport: make(403) });
    expect(!a.ok && a.error.code).toBe("http_error");
    expect(!b.ok && b.error.code).toBe("blocked");
  });
});
