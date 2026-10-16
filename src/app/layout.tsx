import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flatmate",
  description: "Split bills and share chores fairly with your flatmates.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Mobile-first: content never wider than a phone, centred on desktop. */}
        {/* Suspense: pages are client-rendered and read route params via hooks (required by cacheComponents). */}
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <Suspense>{children}</Suspense>
        </div>
      </body>
    </html>
  );
}
