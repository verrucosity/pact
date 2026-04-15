import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const displaySans = Space_Grotesk({
  variable: "--font-display-sans",
  subsets: ["latin"],
});

const uiMono = IBM_Plex_Mono({
  variable: "--font-ui-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Leagues VI Demonic Pacts Companion",
  description:
    "Route-first Leagues VI planner and checklist built from Faux's Demonic Pacts guide with profile persistence, duo planning, and build tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displaySans.variable} ${uiMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
