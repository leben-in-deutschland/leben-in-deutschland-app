"use client";

import { Spinner } from "@heroui/react";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import type { State } from "@/types/state";
import { InlineNotice } from "@/components/ui/feedback";
import { useIsNative, useTranslations, useUser } from "@/utils/user-store";
import { BamfEvaluation } from "./bamf-evaluation";
import type { EvaluationSummary } from "./evaluation-summary";
import { ExploreSection } from "./explore-section";
import { FaqSection } from "./faq-section";
import { ClosingCta, DownloadSection, ReviewsSection } from "./landing-download";
import { FeatureGrid, HowItWorks } from "./landing-features";
import { LandingHero } from "./landing-hero";

const SAMPLE_STATE = "Berlin";

type LandingPageProps = {
    evaluation: EvaluationSummary;
    states: State[];
};

/**
 * The public start page. Inside the Android app the start page is only a
 * doorway: it sends the learner straight to the dashboard.
 */
export function LandingPage({ evaluation, states }: LandingPageProps) {
    const t = useTranslations();
    const user = useUser();
    const isNative = useIsNative();

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            window.location.replace("/dashboard.html");
        }
    }, []);

    if (isNative) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
                <Spinner size="lg" label={t.loading} />
            </div>
        );
    }

    const hasRecord = Boolean(user?.state?.stateCode);
    const stateName = user?.state?.stateName || SAMPLE_STATE;

    return (
        <div className="flex flex-col gap-16 pb-6 sm:gap-24">
            <LandingHero t={t} hasRecord={hasRecord} stateName={stateName} />

            <InlineNotice tone="warning" className="-mt-6 sm:-mt-12">
                {t.alert1} {t.alert2}
            </InlineNotice>

            <HowItWorks t={t} />
            <FeatureGrid t={t} />
            <BamfEvaluation t={t} evaluation={evaluation} />
            <DownloadSection t={t} />
            <ReviewsSection t={t} />
            <FaqSection t={t} evaluation={evaluation} />
            <ExploreSection t={t} states={states} />
            <ClosingCta t={t} hasRecord={hasRecord} />
        </div>
    );
}
