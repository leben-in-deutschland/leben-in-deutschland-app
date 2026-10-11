"use client";

import { Spinner } from "@heroui/react";
import { useEffect } from "react";
import { AchievementsSection } from "@/components/progress/achievements-section";
import { AnswersSection } from "@/components/progress/answers-section";
import { MockSection } from "@/components/progress/mock-section";
import { ReadinessSection } from "@/components/progress/readiness-section";
import { StateSection } from "@/components/progress/state-section";
import { StreakSection } from "@/components/progress/streak-section";
import { TopicsSection } from "@/components/progress/topics-section";
import { PageHeader } from "@/components/ui/surface";
import type { User } from "@/types/user";
import { dayKey } from "@/utils/date-utils";
import { useTranslations, useUser } from "@/utils/user-store";

/** Scrolls to the section named in the URL hash (e.g. /progress#streak) once the page is on screen. */
function useHashScroll(ready: boolean) {
    useEffect(() => {
        if (!ready || typeof window === "undefined") {
            return;
        }
        const id = window.location.hash.replace(/^#/, "");
        if (!id) {
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            const target = document.getElementById(id);
            if (!target) {
                return;
            }
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [ready]);
}

function ProgressScreen({ user }: { user: User }) {
    const t = useTranslations();
    const today = dayKey();
    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <PageHeader title={t.progress_title} description={t.progress_subtitle} className="animate-rise-in" />
            <div className="stagger-in grid gap-4 sm:gap-5 lg:grid-flow-dense lg:grid-cols-2 lg:items-start">
                <div className="lg:col-span-2">
                    <ReadinessSection user={user} today={today} />
                </div>
                <StreakSection user={user} today={today} />
                <TopicsSection user={user} today={today} />
                <AnswersSection user={user} />
                <div className="lg:col-span-2">
                    <MockSection user={user} />
                </div>
                <StateSection user={user} />
                <div className="lg:col-span-2">
                    <AchievementsSection user={user} today={today} />
                </div>
            </div>
        </div>
    );
}

/** Progress: readiness, streak, topics, answers, mock exams, state questions, and achievements. */
export default function ProgressPage() {
    const user = useUser();
    const t = useTranslations();
    useHashScroll(Boolean(user));

    if (user === undefined) {
        return (
            <div className="flex justify-center py-16">
                <Spinner label={t.loading} color="primary" />
            </div>
        );
    }
    if (!user) {
        return null;
    }
    return <ProgressScreen user={user} />;
}
