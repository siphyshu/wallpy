import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/navbar";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["normal", "italic"],
});

const description =
  "Wallpy is a dynamic wallpaper engine that allows you to set dynamic wallpapers for your desktop through a simple CLI. It supports Windows, Linux, and macOS.";

// Defaults for every page. Pages set their own title, description and
// canonical; share images come from the opengraph-image files.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Wallpy - Dynamic Wallpapers for your desktop",
  description,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${instrumentSerif.variable} antialiased`}
      >
        <NavBar />
        {children}
      </body>
    </html>
  );
}
