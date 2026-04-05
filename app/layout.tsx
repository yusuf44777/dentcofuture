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
  description: "Diş hekimliğinde sınırları zorlayan, İstanbul'un öncü dental inovasyon kongresi.",
  openGraph: {
    title: "DentCo Outliers",
    description: "Diş hekimliğinde sınırları zorluyoruz.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} ${syne.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        />
      </head>
      <body className="antialiased bg-bg text-[var(--text)]">{children}</body>
    </html>
  );
}
