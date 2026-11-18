export type DomainResult =
  | { ok: true; domain: string }
  | { ok: false; error: string };

const MAX_INPUT = 2048;
const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD_RE = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const BLOCKED_SUFFIXES = [
  "localhost",
  "local",
  "localdomain",
  "internal",
  "intranet",
  "lan",
  "home",
  "corp",
  "private",
  "test",
  "invalid",
  "onion",
  "arpa",
];

function toAscii(host: string): string | null {
  // WHATWG URL performs IDNA/punycode conversion in both browsers and Node.
  try {
    const u = new URL(`http://${host}/`);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Normalize free-form user input ("https://www.Example.com:443/path?q") into a
 * bare registrable-looking hostname ("example.com"). Pure; safe on client and server.
 */
export function normalizeDomain(input: unknown): DomainResult {
  if (typeof input !== "string") {
    return { ok: false, error: "Please enter a company domain, like example.com." };
  }
  let s = input.trim();
  if (!s) return { ok: false, error: "Please enter a company domain, like example.com." };
  if (s.length > MAX_INPUT) return { ok: false, error: "That doesn't look like a domain — it's far too long." };

  // Strip scheme (any scheme-like prefix), credentials, path, query, fragment, port.
  const schemeMatch = s.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      return { ok: false, error: "Only website domains are supported (http or https)." };
    }
    s = s.slice(schemeMatch[0].length);
  } else if (/^\/\//.test(s)) {
    s = s.slice(2);
  }
  s = s.split(/[/?#\\]/, 1)[0];
  if (s.includes("@")) s = s.slice(s.lastIndexOf("@") + 1);
  if (s.startsWith("[")) {
    return { ok: false, error: "IP addresses aren't supported — please enter a company domain." };
  }
  s = s.replace(/:\d*$/, "");
  s = s.replace(/\.+$/, ""); // trailing dot(s)
  s = s.trim().toLowerCase();

  if (!s) return { ok: false, error: "Please enter a company domain, like example.com." };
  if (/\s/.test(s)) return { ok: false, error: "Domains can't contain spaces." };
  if (s.includes(":")) {
    return { ok: false, error: "IP addresses aren't supported — please enter a company domain." };
  }
  if (IPV4_RE.test(s) || /^[0-9.]+$/.test(s) || /^0x[0-9a-f]+$/i.test(s)) {
    return { ok: false, error: "IP addresses aren't supported — please enter a company domain." };
  }

  const ascii = toAscii(s);
  if (!ascii) return { ok: false, error: "That domain contains characters that aren't allowed." };
  let host = ascii.toLowerCase().replace(/\.+$/, "");
  if (IPV4_RE.test(host)) {
    return { ok: false, error: "IP addresses aren't supported — please enter a company domain." };
  }
  if (host.startsWith("www.")) host = host.slice(4);

  if (host.length > 253) return { ok: false, error: "That domain is too long." };
  const labels = host.split(".");
  if (labels.length < 2) {
    return { ok: false, error: "Please include the full domain, like example.com." };
  }
  for (const label of labels) {
    if (label.length === 0) return { ok: false, error: "That domain has an empty part (two dots in a row)." };
    if (label.length > 63) return { ok: false, error: "Part of that domain is too long (max 63 characters)." };
    if (!LABEL_RE.test(label)) {
      return { ok: false, error: "That domain contains characters that aren't allowed." };
    }
  }
  const tld = labels[labels.length - 1];
  if (!TLD_RE.test(tld)) return { ok: false, error: "That domain's ending doesn't look valid." };
  if (BLOCKED_SUFFIXES.includes(tld) || host === "localhost") {
    return { ok: false, error: "That's a local or reserved name — please enter a public company domain." };
  }
  return { ok: true, domain: host };
}
