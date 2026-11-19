import { describe, expect, it } from "vitest";
import { isBlockedAddress, safeFetch, SafeFetchError, type Resolver, type Transport } from "@/lib/ssrf";

const publicResolver: Resolver = async () => [{ address: "93.184.215.14", family: 4 }];

/** Transport that must never be reached (requests should be refused before connecting). */
const forbidden: Transport = async (req) => {
  throw new Error(`transport should not be called for ${req.url}`);
};

function okTransport(body = "<html><title>ok</title></html>"): Transport {
  return async () => ({
    status: 200,
    headers: { "content-type": "text/html" },
    readBody: async () => Buffer.from(body),
    discard: () => {},
  });
}

async function expectRefused(p: Promise<unknown>, code: SafeFetchError["code"] = "blocked_address") {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(SafeFetchError);
  expect((err as SafeFetchError).code).toBe(code);
}

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "::1",
    "10.0.0.5",
    "172.16.3.4",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.1.1",
    "0.0.0.0",
    "::ffff:10.0.0.1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["93.184.215.14", "2606:4700::1", "8.8.8.8", "172.32.0.1", "::ffff:93.184.215.14"])("allows %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe("safeFetch refusals", () => {
  it("refuses http://localhost", async () => {
    await expectRefused(safeFetch("http://localhost/", { resolver: publicResolver, transport: forbidden }));
  });

  it("refuses http://10.0.0.1", async () => {
    await expectRefused(safeFetch("http://10.0.0.1/", { resolver: publicResolver, transport: forbidden }));
  });

  it("refuses the cloud metadata address", async () => {
    await expectRefused(
      safeFetch("http://169.254.169.254/latest/meta-data/", { resolver: publicResolver, transport: forbidden }),
    );
  });

  it("refuses non-http schemes", async () => {
    await expectRefused(safeFetch("ftp://example.com/", { resolver: publicResolver, transport: forbidden }), "bad_scheme");
  });

  it("refuses a hostname whose DNS resolves to a private address", async () => {
    const resolver: Resolver = async () => [{ address: "10.1.2.3", family: 4 }];
    await expectRefused(safeFetch("https://internal.example.com/", { resolver, transport: forbidden }));
  });

  it("refuses when ANY resolved address is private", async () => {
    const resolver: Resolver = async () => [
      { address: "93.184.215.14", family: 4 },
      { address: "::1", family: 6 },
    ];
    await expectRefused(safeFetch("https://mixed.example.com/", { resolver, transport: forbidden }));
  });

  it("refuses a redirect hop to a private host", async () => {
    const seen: string[] = [];
    const resolver: Resolver = async (host) =>
      host === "evil.example.com" ? [{ address: "192.168.0.10", family: 4 }] : [{ address: "93.184.215.14", family: 4 }];
    const transport: Transport = async (req) => {
      seen.push(req.url.toString());
      return {
        status: 302,
        headers: { location: "https://evil.example.com/admin" },
        readBody: async () => Buffer.alloc(0),
        discard: () => {},
      };
    };
    await expectRefused(safeFetch("https://good.example.com/", { resolver, transport }));
    expect(seen).toEqual(["https://good.example.com/"]);
  });

  it("refuses a redirect to an IP literal in a private range", async () => {
    const transport: Transport = async () => ({
      status: 301,
      headers: { location: "https://127.0.0.1:8080/" },
      readBody: async () => Buffer.alloc(0),
      discard: () => {},
    });
    await expectRefused(safeFetch("https://good.example.com/", { resolver: publicResolver, transport }));
  });

  it("stops after 3 redirects", async () => {
    let n = 0;
    const transport: Transport = async () => ({
      status: 302,
      headers: { location: `/r${++n}` },
      readBody: async () => Buffer.alloc(0),
      discard: () => {},
    });
    await expectRefused(safeFetch("https://loop.example.com/", { resolver: publicResolver, transport }), "too_many_redirects");
    expect(n).toBe(4);
  });

  it("pins the connection to the validated address and fetches public hosts", async () => {
    let pinned = "";
    const transport: Transport = async (req) => {
      pinned = req.address.address;
      expect(req.headers["user-agent"]).toBe("EnchanteOneBot/0.1 (+https://ench.one)");
      return okTransport()(req);
    };
    const res = await safeFetch("https://example.com/", { resolver: publicResolver, transport });
    expect(res.status).toBe(200);
    expect(res.finalUrl).toBe("https://example.com/");
    expect(res.body).toContain("<title>ok</title>");
    expect(pinned).toBe("93.184.215.14");
  });
});
