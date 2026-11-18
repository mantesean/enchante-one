import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/LegalPlaceholder";

export const metadata: Metadata = { title: "Refund policy · ENCHANTE ONE", robots: { index: false } };

// TODO (Martin): replace this placeholder with the final Refund policy.
export default function RefundPage() {
  return <LegalPlaceholder title="Refund policy" todo="add the final Refund policy for Founding Access." />;
}
