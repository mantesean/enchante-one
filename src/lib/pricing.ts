/** Single source of truth for the Founding Access price shown anywhere in the UI. */
export const FOUNDING_ACCESS_PRICE_LABEL = "$990";

/**
 * Returns the Stripe Payment Link for Founding Access, or null if it is missing or not an
 * https:// URL (the UI then renders a disabled "Coming soon" button).
 *
 * `process.env.NEXT_PUBLIC_FOUNDING_ACCESS_URL` must be referenced literally so Next.js can
 * inline it into the client bundle at build time.
 */
export function getFoundingAccessUrl(
  raw: string | undefined = process.env.NEXT_PUBLIC_FOUNDING_ACCESS_URL,
): string | null {
  const value = raw?.trim();
  if (!value || !value.startsWith("https://")) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}
