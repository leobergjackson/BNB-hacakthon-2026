import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emotional Duality Strategy (EDI v2)",
  description: "A cognitive-science trading skill for the CoinMarketCap Skills Marketplace. EDI v2 detects sentiment contradictions — sustained Fear & Greed extremes contradicted by derivatives positioning and momentum exhaustion. BNB HACK Track 2."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
