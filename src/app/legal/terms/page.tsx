import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/LegalPlaceholder";

export const metadata: Metadata = { title: "Terms · ENCHANTE ONE", robots: { index: false } };

// TODO (Martin): replace this placeholder with the final Terms of Service.
export default function TermsPage() {
  return <LegalPlaceholder title="Terms of Service" todo="add the final Terms of Service, including seller identification." />;
}
