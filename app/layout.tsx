import "../styles/globals.css";
import { Metadata, Viewport } from "next";
import { siteConfig } from "../config/site";
import { fontSans } from "../config/fonts";
import { Providers } from "./provider";
import { NavigationBar } from "../components/navigation-bar";
import clsx from "clsx";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "react-hot-toast";
import { GoogleAnalytics } from '@next/third-parties/google'

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
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
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
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <SpeedInsights />
        <Providers themeProps={{ attribute: "class", enableSystem: false }}>
          <div>
            <NavigationBar />
            <main>
              <div><Toaster position="top-right" reverseOrder={true} /></div>
              {children}
            </main>
            <footer className="container mx-auto flex flex-grow">
              <span className="text-smsm:text-center">© {new Date().getFullYear()} <a href="https://www.bitesinbyte.com/" className="hover:underline font-bold">bitesinbyte</a> All Rights Reserved
              </span>
              <ul className="flex flex-wrap items-center mt-3 text-sm font-medium sm:mt-0">
                <li>
                  <a href="/privacy-policy" target="_blank" className="mr-4 hover:underline md:mr-6">Privacy Policy</a>
                </li>
                <li>
                  <a href="mailto:hello@bitesinbyte.com" target="_blank" className="hover:underline">Contact</a>
                </li>
              </ul>
            </footer>
          </div>
        </Providers>
      </body>
      <GoogleAnalytics gaId="G-0XMD5RVLHB" />
    </html >
  );
}
