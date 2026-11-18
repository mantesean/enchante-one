import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="w-full max-w-xl mx-auto px-6 py-10 text-xs text-zinc-600 space-y-3">
      {/* TODO (Martin): replace with the legal seller identification (name / company, registration ID, registered address). Do not ship to paying customers without it. */}
      <p>
        <span className="text-zinc-500">Seller:</span> TODO (Martin): seller identification — legal name, registration
        ID and registered address.
      </p>
      <nav className="flex gap-6">
        {/* TODO (Martin): publish final Terms of Service at /legal/terms */}
        <Link href="/legal/terms" className="hover:text-zinc-300 transition">
          Terms (TODO)
        </Link>
        {/* TODO (Martin): publish final Refund policy at /legal/refund */}
        <Link href="/legal/refund" className="hover:text-zinc-300 transition">
          Refund policy (TODO)
        </Link>
      </nav>
    </footer>
  );
}
