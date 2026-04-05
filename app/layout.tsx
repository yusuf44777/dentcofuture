import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "DentCo Outliers — Communitive Dentistry",
  description: "Breaking boundaries in dentistry. Istanbul's premier dental innovation congress.",
  openGraph: {
    title: "DentCo Outliers",
    description: "Breaking boundaries in dentistry.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${syne.variable}`}>
      <body className="antialiased bg-bg text-[var(--text)]">{children}</body>
    </html>
  );
}
