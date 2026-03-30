"use client";

import { getTranslations } from "@/data/data";
import { getUserData } from "@/services/user";
import { siteConfig } from "@/config/site";
import { Logo } from "@/icons/Logo";
import { GithubIcon } from "@/icons/GithubIcon";
import { Link } from "@heroui/link";
import NextLink from "next/link";
import { useEffect, useState } from "react";
import { User } from "@/types/user";

export const Footer = () => {
  const [user, setUser] = useState<User>();
  const t = getTranslations(user?.appLanguage ?? "de");

  useEffect(() => {
    const handleUserChange = () => {
      const tempUser = getUserData();
      if (tempUser !== null) setUser(tempUser);
    };
    handleUserChange();
    window.addEventListener("user", handleUserChange);
    return () => window.removeEventListener("user", handleUserChange);
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-default-200 dark:border-default-100 bg-default-50 dark:bg-default-50/5 mt-auto">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Main footer grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 sm:py-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <NextLink href="/" className="flex items-center gap-2 w-fit" aria-label="Leben in Deutschland Home">
              <Logo />
              <div className="flex gap-1">
                <span className="font-bold text-foreground">Leben</span>
                <span className="font-bold text-red-500">in</span>
                <span className="font-bold text-yellow-400">Deutschland</span>
              </div>
            </NextLink>
            <p className="text-sm text-default-500 leading-relaxed max-w-xs">
              {t.footer_brand_desc}
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3 mt-1">
              <Link
                isExternal
                href={siteConfig.links.github}
                aria-label="GitHub Repository"
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-default-100 dark:bg-default-50 text-default-600 hover:text-foreground hover:bg-default-200 dark:hover:bg-default-100 transition-colors"
              >
                <GithubIcon className="w-5 h-5" />
              </Link>
              <Link
                isExternal
                href={siteConfig.links.sponsor}
                aria-label="Support on Ko-fi"
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-default-100 dark:bg-default-50 text-default-600 hover:text-red-500 hover:bg-default-200 dark:hover:bg-default-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </Link>
              <Link
                isExternal
                href="mailto:hello@bitesinbyte.com"
                aria-label="Email Contact"
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-default-100 dark:bg-default-50 text-default-600 hover:text-foreground hover:bg-default-200 dark:hover:bg-default-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </Link>
              <Link
                isExternal
                href={siteConfig.links.playStore}
                aria-label="Download on Google Play"
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-default-100 dark:bg-default-50 text-default-600 hover:text-green-500 hover:bg-default-200 dark:hover:bg-default-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.803-2.302 2.803-2.302zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <nav className="flex flex-col gap-3" aria-label="Quick Links">
            <h3 className="font-semibold text-sm text-foreground uppercase tracking-wider">
              {t.footer_quick_links}
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <NextLink href="/dashboard" className="text-sm text-default-500 hover:text-foreground transition-colors">
                  {t.footer_link_dashboard}
                </NextLink>
              </li>
              <li>
                <NextLink href="/prepare" className="text-sm text-default-500 hover:text-foreground transition-colors">
                  {t.footer_link_prepare}
                </NextLink>
              </li>
              <li>
                <NextLink href="/mock" className="text-sm text-default-500 hover:text-foreground transition-colors">
                  {t.footer_link_mock}
                </NextLink>
              </li>
              <li>
                <NextLink href="/question-catalogue" className="text-sm text-default-500 hover:text-foreground transition-colors">
                  {t.footer_link_catalogue}
                </NextLink>
              </li>
            </ul>
          </nav>

          {/* Resources */}
          <nav className="flex flex-col gap-3" aria-label="Resources">
            <h3 className="font-semibold text-sm text-foreground uppercase tracking-wider">
              {t.footer_resources}
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <NextLink href="/#explore" className="text-sm text-default-500 hover:text-foreground transition-colors">
                  {t.footer_link_centers}
                </NextLink>
              </li>
              <li>
                <NextLink href="/privacy-policy" className="text-sm text-default-500 hover:text-foreground transition-colors">
                  {t.footer_link_privacy}
                </NextLink>
              </li>
              <li>
                <Link isExternal href={siteConfig.links.github} className="text-sm text-default-500 hover:text-foreground transition-colors">
                  {t.footer_link_github}
                </Link>
              </li>
              <li>
                <Link isExternal href="mailto:hello@bitesinbyte.com" className="text-sm text-default-500 hover:text-foreground transition-colors">
                  {t.footer_link_contact}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Connect */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm text-foreground uppercase tracking-wider">
              {t.footer_connect}
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link isExternal href={siteConfig.links.bitesinbyte} className="text-sm text-default-500 hover:text-foreground transition-colors">
                  bitesinbyte
                </Link>
              </li>
              <li>
                <Link isExternal href={siteConfig.links.sponsor} className="text-sm text-default-500 hover:text-red-500 transition-colors">
                  Ko-fi (Donate)
                </Link>
              </li>
              <li>
                <Link isExternal href={siteConfig.links.playStore} className="text-sm text-default-500 hover:text-green-500 transition-colors inline-flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.803-2.302 2.803-2.302zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z"/>
                  </svg>
                  Google Play
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-default-200 dark:border-default-100 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-default-400 text-center sm:text-left">
            &copy; {currentYear}{" "}
            <Link isExternal href="https://www.bitesinbyte.com/" className="hover:underline font-semibold text-default-500 text-xs sm:text-sm">
              bitesinbyte
            </Link>
            {" "}{t.footer_rights}
          </p>
          <p className="text-xs text-default-400 flex items-center gap-1">
            {t.footer_made_with}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-red-500" aria-hidden="true">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </p>
        </div>
      </div>
    </footer>
  );
};
