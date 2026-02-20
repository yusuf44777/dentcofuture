import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dent Co Future Canlı",
  description:
    "COMMUNITIVE DENTISTRY tarafından düzenlenen Dent Co Future etkinliği için gerçek zamanlı etkileşim ve canlı geri bildirim panosu."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
