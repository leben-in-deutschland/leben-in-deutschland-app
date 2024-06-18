import "../styles/globals.css";
import { Metadata, Viewport } from "next";
import { siteConfig } from "../config/site";
import { fontSans } from "../config/fonts";
import { Providers } from "./provider";
import { NavigationBar } from "../components/navigation-bar";
import clsx from "clsx";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "react-hot-toast";

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
      </head>
      <body
        className={clsx(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <SpeedInsights />
        <Providers themeProps={{ attribute: "class", enableSystem: false }}>
          <div className="relative flex flex-col">
            <NavigationBar />
            <main className="container mx-auto max-w-7xl pt-5 flex-grow">
              <div><Toaster position="top-right" reverseOrder={true} /></div>
              {children}
            </main>
            <footer className="container mx-auto max-w-7xl pt-16 px-6 flex-grow md:flex md:items-center md:justify-between md:p-6">
              <span className="text-sm text-gray-500 sm:text-center dark:text-gray-400">© {new Date().getFullYear()} <a href="https://www.bitesinbyte.com/" className="hover:underline font-bold">bitesinbyte</a> All Rights Reserved
              </span>
              <ul className="flex flex-wrap items-center mt-3 text-sm font-medium text-gray-500 dark:text-gray-400 sm:mt-0">
                <li>
                  <a href="https://github.com/bitesinbyte/.github/blob/main/profile/privacy-policy.md#bitesinbyte--privacy-statement" target="_blank" className="mr-4 hover:underline md:mr-6">Privacy Policy</a>
                </li>
                <li>
                  <a href="mailto:hello@bitesinbyte.com" target="_blank" className="hover:underline">Contact</a>
                </li>
              </ul>
            </footer>
          </div>
        </Providers>
      </body>
    </html >
  );
}
