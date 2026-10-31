import { Button } from "@heroui/react";
import { appStoreUrl, siteConfig } from "@/config/site";
import { PassCard, type PassCardData } from "@/components/pass/pass-card";
import { AppLink } from "@/components/ui/app-link";
import { ArrowRightIcon, CheckCircleIcon, ShieldCheckIcon } from "@/components/ui/icons";
import type { Translations } from "@/utils/i18n";
import { AppStoreButton, PlayStoreButton } from "./landing-primitives";

type LandingHeroProps = {
    t: Translations;
    /** True when a learner record with a state exists on this device. */
    hasRecord: boolean;
    /** The learner's state, or a sample state for visitors. */
    stateName: string;
};

/** Headline, both calls to action, the trust row and a sample pass. */
export function LandingHero({ t, hasRecord, stateName }: LandingHeroProps) {
    const demo: PassCardData = {
        greeting: t.landing_demo_greeting,
        stateName,
        readiness: 72,
        readinessLabel: t.readiness_close,
        known: 218,
        total: 310,
        streak: 12,
        streakAtRisk: false,
        freezes: 1,
        answeredToday: 7,
        goal: 10,
    };
    const trust = [t.landing_trust_questions, t.landing_trust_states, t.landing_trust_free, t.landing_trust_offline, t.landing_trust_no_account];

    return (
        <section aria-labelledby="landing-hero-title" className="grid items-center gap-10 pt-2 sm:pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="animate-rise-in text-center lg:text-left">
                <p className="inline-flex items-center gap-2 rounded-full bg-content1/80 px-3.5 py-1.5 text-xs font-semibold text-default-600 shadow-card ring-1 ring-foreground/[0.06] backdrop-blur dark:ring-white/[0.08]">
                    <ShieldCheckIcon size={14} className="pass-foil" aria-hidden="true" />
                    {t.landing_hero_eyebrow}
                </p>
                <h1
                    id="landing-hero-title"
                    className="mt-4 font-display text-[2.25rem] font-bold leading-[1.05] tracking-tight text-foreground text-balance sm:text-5xl lg:text-[3.5rem]"
                >
                    {t.landing_hero_title}
                </h1>
                <p className="mx-auto mt-4 max-w-xl text-base text-default-500 text-balance sm:text-lg lg:mx-0">{t.landing_hero_subtitle}</p>

                <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                    <Button
                        as={AppLink}
                        href="/dashboard"
                        color="primary"
                        size="lg"
                        className="h-12 w-full px-6 font-semibold sm:w-auto"
                        endContent={<ArrowRightIcon size={18} aria-hidden="true" />}
                    >
                        {hasRecord ? t.landing_hero_cta_continue : t.landing_hero_cta_start}
                    </Button>
                    <PlayStoreButton href={siteConfig.links.playStore} eyebrow={t.landing_play_eyebrow} label={t.download_cta} className="w-full justify-center sm:w-auto" />
                    {appStoreUrl() ? (
                        <AppStoreButton href={appStoreUrl()} eyebrow={t.landing_app_store_eyebrow} label={t.landing_app_store_cta} className="w-full justify-center sm:w-auto" />
                    ) : null}
                </div>
                {hasRecord ? <p className="mt-3 text-sm text-default-500">{t.landing_hero_continue_hint}</p> : null}

                <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-default-600 lg:justify-start" aria-label={t.landing_trust_aria}>
                    {trust.map((item) => (
                        <li key={item} className="inline-flex items-center gap-1.5">
                            <CheckCircleIcon size={16} className="shrink-0 text-success-600" aria-hidden="true" />
                            {item}
                        </li>
                    ))}
                </ul>
            </div>

            <figure className="relative mx-auto w-full max-w-md animate-pop-in lg:max-w-none">
                <div aria-hidden="true" className="pass-cover absolute inset-x-5 -bottom-3 top-5 -z-10 -rotate-3 rounded-[22px] opacity-60" />
                <PassCard data={demo} t={t} headingLevel="h2" />
                <figcaption className="mt-3 text-center text-xs text-default-500">{t.landing_demo_caption}</figcaption>
            </figure>
        </section>
    );
}
