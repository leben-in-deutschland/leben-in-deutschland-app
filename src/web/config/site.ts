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
         * App Store page of the iOS app (ADR-047, PLAN-013). Empty until the app is
         * live: the landing then shows a "coming soon" badge and the footer, hero
         * and structured data leave iOS out. Setting the URL is the launch switch.
         */
        appStore: "",
        website: "https://www.lebenindeutschland.org",
    }
};

/** The App Store URL once the iOS app is published, otherwise undefined. */
export function appStoreUrl(): string | undefined {
    return siteConfig.links.appStore || undefined;
}