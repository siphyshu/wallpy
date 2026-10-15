import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/navbar";

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

export const metadata = {
  title: "Wallpy - Dynamic Wallpapers for your desktop",
  description:
    "Wallpy is a dynamic wallpaper engine that allows you to set dynamic wallpapers for your desktop through a simple CLI. It supports Windows, Linux, and macOS.",
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
