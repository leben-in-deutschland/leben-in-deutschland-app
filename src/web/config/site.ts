import type { Metadata } from "next";

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
    name: "Einbürgerungstest | Leben in Deutschland",
    description: "Leben in Deutschland - Bereiten Sie sich auf den deutschen Einbürgerungstest vor. Genießen Sie einen kostenlosen Service mit umfassenden Ressourcen, die Ihnen zum Erfolg verhelfen!",
    descriptionEn: "Free, open-source platform to prepare for the German Einbürgerungstest (citizenship test). Practice 300+ official questions, take realistic mock exams, and track your progress — no ads, no signup.",
    navMenuItems: [
    ],
    links: {
        github: "https://github.com/leben-in-deutschland/leben-in-deutschland-app",
        lamplitLabs: "https://www.lamplitlabs.com/",
        playStore: "https://play.google.com/store/apps/details?id=org.lebenindeutschland.app",
        /**
         * App Store page of the iOS app (ADR-047, PLAN-013): the landing badge, the
         * footer, the structured data and the in-app rate/update links read it.
         * Empty would show a "coming soon" badge instead.
         */
        appStore: "https://apps.apple.com/de/app/id6829151281",
        website: "https://www.lebenindeutschland.org",
    }
};

/** The App Store URL once the iOS app is published, otherwise undefined. */
export function appStoreUrl(): string | undefined {
    return siteConfig.links.appStore || undefined;
}

/** The pictures a link preview shows (Open Graph, Twitter). */
export const shareImages = [
    { url: "/mobile/app-1.png", width: 1080, height: 1920, alt: "Leben in Deutschland - Einbürgerungstest App Dashboard" },
    { url: "/mobile/app-2.png", width: 1080, height: 1920, alt: "Übungsfragen für den Einbürgerungstest" },
    { url: "/mobile/app-3.png", width: 1080, height: 1920, alt: "Fragen übersetzt in 7 Sprachen" },
];

/**
 * The link preview of a page that has its own title, description and
 * address. Next replaces the layout's `openGraph` and `twitter` as a whole
 * when a page sets them, so the shared parts are repeated here; without
 * this a page is shared as the start page.
 */
export function sharePreview(page: { title: string; description: string; path: string }): Pick<Metadata, "openGraph" | "twitter"> {
    return {
        openGraph: { type: "website", locale: "de_DE", siteName: siteConfig.name, title: page.title, description: page.description, url: page.path, images: shareImages },
        twitter: { card: "summary_large_image", title: page.title, description: page.description, images: [shareImages[0].url] },
    };
}
