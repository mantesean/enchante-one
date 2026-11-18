import { FOUNDING_ACCESS_PRICE_LABEL, getFoundingAccessUrl } from "@/lib/pricing";

const base = "block w-full py-3 rounded-full text-sm font-medium text-center tracking-wide transition";

/**
 * Links to the Stripe Payment Link from NEXT_PUBLIC_FOUNDING_ACCESS_URL. If it is not
 * configured (or not https://), renders a disabled "Coming soon" button instead.
 */
export function FoundingAccessButton({ url = getFoundingAccessUrl() }: { url?: string | null }) {
  if (!url) {
    return (
      <button type="button" disabled aria-disabled="true" className={`${base} bg-zinc-800 text-zinc-500 cursor-not-allowed`}>
        Coming soon
      </button>
    );
  }
  return (
    <a href={url} rel="noopener noreferrer" className={`${base} bg-white text-black hover:bg-zinc-200`}>
      Founding Access · {FOUNDING_ACCESS_PRICE_LABEL}
    </a>
  );
}
