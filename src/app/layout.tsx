import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ENCHANTE ONE",
  description: "The intelligent operating layer for companies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
