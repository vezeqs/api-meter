import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_NAME, APP_TAGLINE } from "@production/shared";
import { absoluteUrl, BASE_PATH, SITE_URL } from "@/lib/site";
import "./globals.css";

const DESCRIPTION =
  "Meter shows API request volume, quota consumption, error rate, and spend in one place, so a metered bill never arrives as a surprise.";

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}${BASE_PATH}`),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s — ${APP_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: APP_NAME }],
  keywords: [
    "API usage dashboard",
    "metered billing",
    "API quota",
    "usage-based pricing",
    "request analytics",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "The Meter dashboard, showing request volume and quota consumption.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0c" },
  ],
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_NAME,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  url: absoluteUrl("/"),
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "49", priceCurrency: "USD" },
    { "@type": "Offer", name: "Team", price: "199", priceCurrency: "USD" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <script
          type="application/ld+json"
          // Static, build-time constant. No user input reaches this string.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </body>
    </html>
  );
}
