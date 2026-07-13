import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { buildWebSiteSchema } from "@/lib/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Кибер СЕО";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "SEO и GEO оптимизация — экспертные статьи и руководства",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL,
    siteName: SITE_NAME,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const websiteSchema = buildWebSiteSchema();

  return (
    <html lang="ru">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
