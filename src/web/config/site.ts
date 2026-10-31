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