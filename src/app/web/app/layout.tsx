import "../styles/globals.css";
import { Metadata, Viewport } from "next";
import { siteConfig } from "../config/site";
import { fontSans } from "../config/fonts";
import { Providers } from "./provider";
import { NavigationBar } from "../components/navigation-bar";
import clsx from "clsx";
import { Link } from "@heroui/link";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { keywords } from "@/data/keyword";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}


export const metadata: Metadata = {
  metadataBase: new URL('https://www.lebenindeutschland.org'),
  alternates: {
    canonical: '/',
  },
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "en_US",
    title: siteConfig.name,
    url: "www.lebenindeutschland.org",
    siteName: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: "./mobile/app-1.png",
        width: 1200,
        height: 2880,
        alt: siteConfig.name,
      },
      {
        url: "./mobile/app-2.png",
        width: 1200,
        height: 2880,
        alt: siteConfig.name,
      },
      {
        url: "./mobile/app-3.png",
        width: 1200,
        height: 2880,
        alt: siteConfig.name,
      },
      {
        url: "./mobile/app-4.png",
        width: 1200,
        height: 2880,
        alt: siteConfig.name,
      },
      {
        url: "./mobile/app-5.png",
        width: 1200,
        height: 2880,
        alt: siteConfig.name,
      },
      {
        url: "./mobile/app-6.png",
        width: 1200,
        height: 2880,
        alt: siteConfig.name,
      },
      {
        url: "./mobile/app-7.png",
        width: 1200,
        height: 2880,
        alt: siteConfig.name,
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    nocache: true
  },
  generator: "Next.js",
  keywords: keywords,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body
        className={clsx(
          "bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <SpeedInsights />
        <Providers themeProps={{ attribute: "class", enableSystem: true }}>
          <div className="flex flex-col min-h-screen">
            <NavigationBar />
            <main className="container mx-auto flex flex-col flex-grow w-full p-4">
              {children}
              <footer className="mt-auto flex p-4 bg-background justify-between items-center">
                <div className="flex items-center">
                  <span className="sm:text-center">
                    © {new Date().getFullYear()} <a href="https://www.bitesinbyte.com/" className="hover:underline font-bold">bitesinbyte</a> All Rights Reserved
                  </span>
                </div>
                <div className="items-center hidden md:flex">
                  <Link href="/privacy-policy" className="mr-4 hover:underline md:mr-6">Privacy Policy</Link>
                  <Link href="mailto:hello@bitesinbyte.com" target="_blank" className="hover:underline">Contact</Link>
                </div>
              </footer>
            </main>
          </div>
        </Providers>
      </body>
    </html >
  );
}
