export type DomainResult = { ok: true; domain: string } | { ok: false; error: string };

/** Syntax only: never resolves DNS or fetches the submitted host. */
export function normalizeDomain(input: string): DomainResult {
  const invalid = (error: string): DomainResult => ({ ok: false, error });
  const value = input.trim();
  if (!value) return invalid("Enter a public domain, such as yourcompany.com.");
  if (value.length > 2048 || /[\s\\%]/u.test(value)) {
    return invalid("Use a domain or HTTP(S) URL without spaces, backslashes or encoded characters.");
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) {
    return invalid("Only http:// and https:// URLs are supported. Ports are not allowed.");
  }
  const raw = value.replace(/^https?:\/\//i, "");
  const authority = raw.split(/[/?#]/, 1)[0];
  if (!authority || /[@:꞉\[\]]/u.test(authority)) {
    return invalid("Use a public domain without credentials, ports or IP addresses.");
  }
  let host: string;
  try {
    host = new URL(`https://${raw}`).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return invalid("Enter a valid public domain, such as yourcompany.com.");
  }
  const labels = host.split(".");
  const reserved = new Set(["localhost", "local", "internal", "lan", "home", "test", "invalid", "example", "onion"]);
  if (host.length > 253 || labels.length < 2 ||
      labels.some((label) => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/.test(label)) ||
      !/^[a-z][a-z\d-]*$/.test(labels.at(-1)!) ||
      reserved.has(labels.at(-1)!) || labels.includes("localhost") || host.endsWith(".home.arpa")) {
    return invalid("Enter a public domain, not an IP address, local name or reserved domain.");
  }
  return { ok: true, domain: host };
}
