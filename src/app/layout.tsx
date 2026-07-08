import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DealFlow AI — AI Affiliate Deal Automation Platform",
  description: "Discover, analyze, rank, and distribute affiliate deals automatically with AI-powered deal scoring, multi-platform scraping, and instant multi-channel publishing.",
  keywords: "affiliate marketing, deal automation, AI deals, coupon finder, price tracker, telegram automation",
  authors: [{ name: "DealFlow AI" }],
  openGraph: {
    title: "DealFlow AI — AI Affiliate Deal Automation Platform",
    description: "The smartest way to discover and distribute affiliate deals automatically.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>
        {/* Background Orbs */}
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        {children}
      </body>
    </html>
  );
}
