import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FoundingAccessButton } from "@/components/FoundingAccessButton";
import { FOUNDING_ACCESS_PRICE_LABEL, getFoundingAccessUrl } from "@/lib/pricing";

describe("Founding Access link", () => {
  it("has a single price constant", () => {
    expect(FOUNDING_ACCESS_PRICE_LABEL).toBe("$990");
  });

  it.each([undefined, "", "   ", "http://buy.stripe.com/x", "javascript:alert(1)", "buy.stripe.com/x", "https://"])(
    "rejects %j",
    (v) => {
      expect(getFoundingAccessUrl(v)).toBeNull();
    },
  );

  it("accepts an https Payment Link", () => {
    expect(getFoundingAccessUrl(" https://buy.stripe.com/test_123 ")).toBe("https://buy.stripe.com/test_123");
  });

  it("renders a disabled Coming soon button when the env var is missing", () => {
    const html = renderToStaticMarkup(<FoundingAccessButton url={getFoundingAccessUrl(undefined)} />);
    expect(html).toMatch(/^<button/);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("href");
  });

  it("renders a link with the price when configured", () => {
    const html = renderToStaticMarkup(<FoundingAccessButton url={getFoundingAccessUrl("https://buy.stripe.com/abc")} />);
    expect(html).toMatch(/^<a href="https:\/\/buy.stripe.com\/abc"/);
    expect(html).toContain(`Founding Access · ${FOUNDING_ACCESS_PRICE_LABEL}`);
  });
});
