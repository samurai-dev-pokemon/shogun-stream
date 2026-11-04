import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Splash from "@/components/Splash";
import AccentApplier from "@/components/AccentApplier";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: { default: "Shogun Stream", template: "%s · Shogun Stream" },
  description: "Movies, series and anime in a quiet, minimal glass interface.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = { themeColor: "#09090a" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Splash />
        <AccentApplier />
        <Navbar />
        <main className="mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-28 sm:px-6 md:pt-24">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <div className="glass flex flex-col items-center justify-between gap-3 rounded-3xl px-6 py-5 text-xs text-white/45 sm:flex-row">
            <Logo size={20} />
            <p>Metadata from Cinemeta, AniList &amp; TMDB. Playback by VidRift. Not endorsed or certified by TMDB.</p>
            <div className="flex gap-4">
              <Link href="/settings" className="hover:text-white">Settings</Link>
              <Link href="/library" className="hover:text-white">Library</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
