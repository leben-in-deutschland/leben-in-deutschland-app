"use client";

import { siteConfig } from "@/config/site";
import { BrandLockup } from "@/components/shell/brand";
import { LanguageToggle } from "@/components/shell/language-toggle";
import { AppLink } from "@/components/ui/app-link";
import { ExternalLinkIcon } from "@/components/ui/icons";
import { fmt } from "@/utils/i18n";
import { useTranslations } from "@/utils/user-store";

const CONTACT_EMAIL = "hello@lamplitlabs.com";

type FooterLink = { label: string; href: string; external?: boolean };

const linkClass = "inline-flex min-h-[40px] items-center gap-1 text-sm text-default-500 transition-colors hover:text-foreground";

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
    return (
        <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-default-700">{title}</h2>
            <ul className="mt-2 flex flex-col">
                {links.map((link) => (
                    <li key={link.href}>
                        {link.external ? (
                            <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                                {link.label}
                                <ExternalLinkIcon size={12} className="text-default-400" aria-hidden="true" />
                            </a>
                        ) : (
                            <AppLink href={link.href} className={linkClass}>
                                {link.label}
                            </AppLink>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Site footer for the public pages: links, language, credits. */
export const Footer = () => {
    const t = useTranslations();
    const year = new Date().getFullYear();

    const columns: { title: string; links: FooterLink[] }[] = [
        {
            title: t.footer_new_product,
            links: [
                { label: t.footer_new_start, href: "/dashboard" },
                { label: t.footer_link_catalogue, href: "/question-catalogue" },
                { label: t.footer_link_centers, href: "/#explore" },
                { label: t.nav_bamf, href: "/#bamf-evaluation" },
            ],
        },
        {
            title: t.footer_new_legal,
            links: [
                { label: t.footer_link_privacy, href: "/privacy-policy" },
                { label: t.footer_link_impressum, href: "/impressum" },
                { label: t.footer_link_contact, href: `mailto:${CONTACT_EMAIL}`, external: true },
            ],
        },
        {
            title: t.footer_new_project,
            links: [
                { label: t.footer_link_github, href: siteConfig.links.github, external: true },
                { label: t.footer_new_play_store, href: siteConfig.links.playStore, external: true },
                { label: "Lamplit Labs", href: siteConfig.links.lamplitLabs, external: true },
            ],
        },
    ];

    return (
        <footer className="mt-12 border-t border-divider bg-content1">
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
                <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
                    <div className="max-w-xs">
                        <AppLink href="/" className="inline-flex rounded-lg" aria-label={t.nav_landing}>
                            <BrandLockup />
                        </AppLink>
                        <p className="mt-3 text-sm text-default-500">{t.footer_brand_desc}</p>
                        <LanguageToggle className="mt-4" />
                    </div>
                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:col-span-3">
                        {columns.map((column) => (
                            <FooterColumn key={column.title} title={column.title} links={column.links} />
                        ))}
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-2 border-t border-divider pt-5 text-xs text-default-500 sm:flex-row sm:items-center sm:justify-between">
                    <p>{fmt(t.footer_new_copyright, { year })}</p>
                    <p>{t.footer_new_bamf_credit}</p>
                </div>
            </div>
        </footer>
    );
};
