"use client";

import { Spinner } from "@heroui/react";
import { useEffect } from "react";
import { PageHeader } from "@/components/ui/surface";
import { useTranslations, useUser } from "@/utils/user-store";
import { AboutSection } from "./about-section";
import { DataSection } from "./data-section";
import { ExamSection } from "./exam-section";
import { NotificationsSection } from "./notifications-section";
import { PracticeSection } from "./practice-section";
import { ProfileSection } from "./profile-section";
import { StreakSection } from "./streak-section";
import { SupportSection } from "./support-section";
import { UiModeSection } from "./ui-mode-section";

const SECTION_IDS = new Set(["profile", "practice", "design", "exam", "streak", "notifications", "data", "support", "about"]);

/** Scrolls to the section named in the URL hash (e.g. /settings#notifications) once the sections exist. */
function useScrollToHash(ready: boolean) {
    useEffect(() => {
        if (!ready) {
            return;
        }
        const id = window.location.hash.replace(/^#/, "");
        if (!SECTION_IDS.has(id)) {
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            const target = document.getElementById(id);
            if (!target) {
                return;
            }
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            target.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
            const heading = document.getElementById(`${id}-heading`);
            heading?.setAttribute("tabindex", "-1");
            heading?.focus({ preventScroll: true });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [ready]);
}

export function SettingsScreen() {
    const t = useTranslations();
    const user = useUser();
    useScrollToHash(Boolean(user));

    if (!user) {
        return (
            <div className="flex justify-center py-16">
                <Spinner color="primary" label={t.loading} />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-6 stagger-in">
            <PageHeader title={t.settings} description={t.settings_subtitle} />
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
                <div className="space-y-6 stagger-in">
                    <ProfileSection user={user} />
                    <PracticeSection user={user} />
                    <UiModeSection />
                    <ExamSection user={user} />
                    <DataSection user={user} />
                </div>
                <div className="space-y-6 stagger-in">
                    <StreakSection user={user} />
                    <NotificationsSection user={user} />
                    <SupportSection />
                    <AboutSection />
                </div>
            </div>
        </div>
    );
}
