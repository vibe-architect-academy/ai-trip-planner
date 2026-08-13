import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { siteUrl, siteName, siteDescription } from "@/lib/site";
import { getLocale } from "@/lib/i18n";
import PerfBanner from "@/components/PerfBanner";
import "./globals.css";

/**
 * Defaults every page inherits, so a new page is discoverable and shareable
 * without anyone remembering to wire it up. Pages override the title and
 * description; the rest carries down.
 */
export const metadata: Metadata = {
  // Without this, every relative URL below stays relative, and a relative
  // og:image is ignored by every scraper that reads it.
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    // Page titles become "Your trips | AI Trip Planner" on their own.
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description: siteDescription,
    url: siteUrl,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The <html lang> attribute is not decoration. Screen readers pick a voice
  // from it, and browsers pick hyphenation and quote marks from it.
  const locale = await getLocale();

  return (
    <ClerkProvider>
      <html lang={locale}>
        <body className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100 antialiased">
          {children}
          <PerfBanner />
        </body>
      </html>
    </ClerkProvider>
  );
}
