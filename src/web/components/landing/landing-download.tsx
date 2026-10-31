import { Button } from "@heroui/react";
import { appStoreUrl, siteConfig } from "@/config/site";
import { AppLink } from "@/components/ui/app-link";
import { IconBadge } from "@/components/ui/icon-badge";
import { ArrowRightIcon, BellIcon, DownloadIcon, MonitorIcon, ShieldCheckIcon, SmartphoneIcon, VolumeIcon, type IconComponent } from "@/components/ui/icons";
import { Surface } from "@/components/ui/surface";
import type { Translations } from "@/utils/i18n";
import { AppStoreButton, LandingSection, PlayStoreButton, StarRow } from "./landing-primitives";

const APP_FEATURES: { icon: IconComponent; key: string }[] = [
    { icon: DownloadIcon, key: "download_features_offline" },
    { icon: BellIcon, key: "download_features_reminders" },
    { icon: VolumeIcon, key: "download_features_tts" },
    { icon: ShieldCheckIcon, key: "download_features_free" },
];

/** The App Store badge: a link once the iOS app is live, a "coming soon" marker before (ADR-047). */
function AppStoreBadge({ t, variant, className }: { t: Translations; variant?: "solid" | "paper" | "ghost"; className?: string }) {
    const href = appStoreUrl();
    return (
        <AppStoreButton
            href={href}
            eyebrow={href ? t.landing_app_store_eyebrow : t.landing_app_store_soon_eyebrow}
            label={href ? t.landing_app_store_cta : t.landing_app_store_soon_label}
            variant={variant}
            className={className}
        />
    );
}

/** Mobile app (Android today, iOS coming) and web app, side by side. */
export function DownloadSection({ t }: { t: Translations }) {
    return (
        <LandingSection id="download" eyebrow={t.landing_download_eyebrow} title={t.download_title} description={t.download_subtitle}>
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="pass-cover flex flex-col gap-5 rounded-2xl p-5 shadow-pass sm:p-6">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10" aria-hidden="true">
                            <SmartphoneIcon size={20} className="pass-foil" />
                        </span>
                        <div>
                            <h3 className="font-display text-lg font-semibold leading-tight">{t.landing_download_app_title}</h3>
                            <p className="text-sm opacity-80">{appStoreUrl() ? t.landing_download_app_desc : t.landing_download_app_desc_soon}</p>
                        </div>
                    </div>
                    <ul className="grid grid-cols-2 gap-2 text-sm">
                        {APP_FEATURES.map((feature) => (
                            <li key={feature.key} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                                <feature.icon size={16} className="pass-foil shrink-0" aria-hidden="true" />
                                <span className="min-w-0">{t[feature.key]}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-auto flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <PlayStoreButton href={siteConfig.links.playStore} eyebrow={t.landing_play_eyebrow} label={t.download_cta} variant="paper" className="justify-center sm:justify-start" />
                            <AppStoreBadge t={t} variant="paper" className="justify-center sm:justify-start" />
                        </div>
                        <p className="flex items-center justify-center gap-2 text-xs sm:justify-start">
                            <StarRow filled={4} label={t.download_rating_label} />
                            <span className="font-semibold">{t.download_rating}</span>
                        </p>
                    </div>
                </div>

                <Surface padding="lg" className="flex flex-col gap-5">
                    <div className="flex items-center gap-3">
                        <IconBadge icon={MonitorIcon} accent="primary" />
                        <div>
                            <h3 className="font-display text-lg font-semibold leading-tight text-foreground">{t.landing_download_web_title}</h3>
                            <p className="text-sm text-default-500">{t.landing_download_web_desc}</p>
                        </div>
                    </div>
                    <ul className="grid gap-2 text-sm text-default-600">
                        {[t.landing_download_web_point1, t.landing_download_web_point2, t.landing_download_web_point3].map((point) => (
                            <li key={point} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                                {point}
                            </li>
                        ))}
                    </ul>
                    <div className="mt-auto">
                        <Button as={AppLink} href="/dashboard" color="primary" variant="flat" className="h-12 w-full font-semibold sm:w-auto" endContent={<ArrowRightIcon size={18} aria-hidden="true" />}>
                            {t.landing_download_web_cta}
                        </Button>
                    </div>
                </Surface>
            </div>
        </LandingSection>
    );
}

const REVIEWS = [1, 2, 3] as const;

/** Three learner quotes. */
export function ReviewsSection({ t }: { t: Translations }) {
    return (
        <LandingSection id="reviews" eyebrow={t.landing_reviews_eyebrow} title={t.reviews_title} description={t.landing_reviews_subtitle}>
            <ul className="grid gap-4 md:grid-cols-3">
                {REVIEWS.map((index) => (
                    <Surface as="li" key={index} padding="lg" className="flex flex-col gap-4">
                        <StarRow filled={5} label={t.landing_reviews_stars_aria} />
                        <blockquote className="flex-1 text-[0.9375rem] leading-relaxed text-foreground">“{t[`review_${index}_text`]}”</blockquote>
                        <footer className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 font-display text-sm font-bold text-primary" aria-hidden="true">
                                {t[`review_${index}_author`].charAt(0)}
                            </span>
                            <div className="min-w-0 text-sm">
                                <p className="font-semibold text-foreground">{t[`review_${index}_author`]}</p>
                                <p className="text-default-500">{t[`review_${index}_detail`]}</p>
                            </div>
                        </footer>
                    </Surface>
                ))}
            </ul>
        </LandingSection>
    );
}

/** Closing call to action on a passport cover. */
export function ClosingCta({ t, hasRecord }: { t: Translations; hasRecord: boolean }) {
    return (
        <section aria-labelledby="landing-cta-title" className="pass-cover relative isolate overflow-hidden rounded-[22px] px-6 py-10 text-center shadow-pass sm:px-10 sm:py-14">
            <div className="pass-foil-rule absolute inset-x-10 top-5" aria-hidden="true" />
            <h2 id="landing-cta-title" className="font-display text-2xl font-bold leading-tight tracking-tight text-balance sm:text-3xl">
                {t.cta_banner_title}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[0.9375rem] opacity-85 text-balance sm:text-base">{t.cta_banner_subtitle}</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button as={AppLink} href="/dashboard" size="lg" className="h-12 w-full bg-white px-6 font-semibold text-pass-deep sm:w-auto" endContent={<ArrowRightIcon size={18} aria-hidden="true" />}>
                    {hasRecord ? t.landing_hero_cta_continue : t.landing_hero_cta_start}
                </Button>
                <PlayStoreButton href={siteConfig.links.playStore} label={t.download_cta} variant="ghost" className="w-full justify-center sm:w-auto" />
                {appStoreUrl() ? <AppStoreButton href={appStoreUrl()} label={t.landing_app_store_cta} variant="ghost" className="w-full justify-center sm:w-auto" /> : null}
            </div>
        </section>
    );
}
