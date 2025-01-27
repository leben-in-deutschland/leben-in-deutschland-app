import "../styles/globals.css";
import { Metadata, Viewport } from "next";
import { siteConfig } from "../config/site";
import { fontSans } from "../config/fonts";
import { Providers } from "./provider";
import { NavigationBar } from "../components/navigation-bar";
import clsx from "clsx";
import { Toaster } from "react-hot-toast";
import { GoogleAnalytics } from '@next/third-parties/google'
import { Link } from "@heroui/link";
import { SpeedInsights } from "@vercel/speed-insights/next"

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}


export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  manifest: "/manifest.json",
  description: siteConfig.description,
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
  keywords: ["Leben in Deutschland",
    "Leben in Deutschland Test Online",
    "Leben in Deutschland Test",
    "Leben in Deutschland Prüfung",
    "Test Leben in Deutschland 33 Fragen Online",
    "leben in deutschland app",
    "leben in deutschland antworten",
    "leben in deutschland english"
  ]
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
        <meta name="google-adsense-account" content="ca-pub-2889277787752693" />
      </head>
      <body
        className={clsx(
          "bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <SpeedInsights />
        <Toaster position="top-right" reverseOrder={true} />
        <Providers themeProps={{ attribute: "class", enableSystem: false }}>
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
                <div className="flex items-center">
                  <Link href="/privacy-policy" target="_blank" className="mr-4 hover:underline md:mr-6">Privacy Policy</Link>
                  <Link href="mailto:hello@bitesinbyte.com" target="_blank" className="hover:underline">Contact</Link>
                </div>
              </footer>
            </main>
          </div>
        </Providers>
      </body>
      <GoogleAnalytics gaId="G-0XMD5RVLHB" />
    </html >
  );
}
