import "../styles/globals.css";
import { Metadata, Viewport } from "next";
import { siteConfig } from "../config/site";
import { fontDisplay, fontSans } from "../config/fonts";
import { Providers } from "./provider";
import clsx from "clsx";
import { keywords } from "@/data/keyword";
import { AppShell } from "@/components/shell/app-shell";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F3F5" },
    { media: "(prefers-color-scheme: dark)", color: "#140E10" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.lebenindeutschland.org"),
  alternates: {
    canonical: "/",
    languages: {
      de: "/",
      en: "/",
    },
  },
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "de_DE",
    alternateLocale: "en_US",
    title: siteConfig.name,
    url: "https://www.lebenindeutschland.org",
    siteName: siteConfig.name,
    description: siteConfig.descriptionEn,
    images: [
      {
        url: "/mobile/app-1.png",
        width: 1080,
        height: 1920,
        alt: "Leben in Deutschland - Einbürgerungstest App Dashboard",
      },
      {
        url: "/mobile/app-2.png",
        width: 1080,
        height: 1920,
        alt: "Übungsfragen für den Einbürgerungstest",
      },
      {
        url: "/mobile/app-3.png",
        width: 1080,
        height: 1920,
        alt: "Fragen übersetzt in 7 Sprachen",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.descriptionEn,
    images: ["/mobile/app-1.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  generator: "Next.js",
  keywords: keywords,
  category: "Education",
  applicationName: "Leben in Deutschland",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Leben in DE",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning={true}>
      <body
        className={clsx(
          "min-h-dvh bg-background font-sans text-foreground antialiased overflow-x-hidden",
          fontSans.variable,
          fontDisplay.variable,
        )}
      >
        <Providers themeProps={{ attribute: "class", enableSystem: true, defaultTheme: "system" }}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
