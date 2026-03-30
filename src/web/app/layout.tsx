import "../styles/globals.css";
import { Metadata, Viewport } from "next";
import { siteConfig } from "../config/site";
import { fontSans } from "../config/fonts";
import { Providers } from "./provider";
import { NavigationBar } from "../components/navigation-bar";
import clsx from "clsx";
import { Link } from "@heroui/link";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { keywords } from "@/data/keyword";
import { Footer } from "@/components/footer";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
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
        width: 1200,
        height: 2880,
        alt: "Leben in Deutschland - Einbürgerungstest App Dashboard",
      },
      {
        url: "/mobile/app-2.png",
        width: 1200,
        height: 2880,
        alt: "Übungsfragen für den Einbürgerungstest",
      },
      {
        url: "/mobile/app-3.png",
        width: 1200,
        height: 2880,
        alt: "Probeprüfung mit Timer",
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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body
        className={clsx(
          "bg-background font-sans antialiased overflow-x-hidden",
          fontSans.variable,
        )}
      >
        <SpeedInsights />
        <Providers themeProps={{ attribute: "class", enableSystem: true }}>
          <div className="flex flex-col min-h-screen">
            <NavigationBar />
            <main className="container mx-auto flex flex-col flex-grow w-full px-4 sm:px-6 py-4">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
