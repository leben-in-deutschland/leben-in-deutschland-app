"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "react-toastify";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { EdgeToEdge } from "@capawesome/capacitor-android-edge-to-edge-support";
import { evaluationData } from "@/data/data";
import { User } from "@/types/user";
import { dayKey } from "@/utils/date-utils";
import { renderNotification, runEngagement } from "@/utils/engagement";
import { Translations } from "@/utils/i18n";
import { navigateTo } from "@/utils/navigation";
import { computeStreak, goalProgress } from "@/utils/streak-logic";
import { readUiMode } from "@/utils/ui-mode";
import { migrateUser, prefsOf } from "@/utils/user-defaults";
import { readUser, updateUser, useAppLanguage, useTranslations, useUser, writeUser } from "@/utils/user-store";
import { addNotificationTapListener, syncNativeNotifications } from "@/services/notifications";
import { useAndroidBackButton } from "./use-back-button";

interface AppSystemBarsPlugin {
    setStyle(options: { light: boolean }): Promise<void>;
}

const AppSystemBars = registerPlugin<AppSystemBarsPlugin>("AppSystemBars");

const EVALUATION = evaluationData();

/** Notification types worth a toast while the learner is using the app. */
const TOAST_TYPES = new Set(["goal", "streak", "freeze", "achievement"]);

let startupDone = false;

/** One-time upgrade of older records plus the "last opened" stamp, once per app start. */
function useStartup(user: User | null | undefined) {
    useEffect(() => {
        if (!user || startupDone) {
            return;
        }
        startupDone = true;
        updateUser((draft) => {
            const next = migrateUser(draft, dayKey());
            next.lastOpenedAt = new Date().toISOString();
            return next;
        });
    }, [user]);
}

/**
 * Keeps streak freezes, achievements, and in-app notifications current.
 * `runEngagement` is idempotent and returns the same object when nothing
 * changed, so saving here cannot loop. The toasts point at modern pages
 * (progress, achievements), so the classic design stores the items without
 * showing them; they wait in the inbox for a later switch.
 */
function useEngagement(user: User | null | undefined, t: Translations) {
    const toastsReady = useRef(false);
    useEffect(() => {
        if (!user) {
            return;
        }
        // Read the stored record again: another effect in the same commit
        // (the startup migration) may already have saved a newer version.
        const current = readUser();
        if (!current) {
            return;
        }
        const { user: next, added } = runEngagement(current, { now: new Date(), evaluation: EVALUATION });
        if (next !== current) {
            writeUser(next);
        }
        if (toastsReady.current && readUiMode().mode !== "classic") {
            for (const item of added.filter((entry) => TOAST_TYPES.has(entry.type))) {
                const { title, body } = renderNotification(t, item);
                toast(body ? `${title} — ${body}` : title, { toastId: item.id });
            }
        }
        toastsReady.current = true;
    }, [user, t]);
}

/**
 * A short string that changes whenever the planned Android notifications
 * could change. The cards carry numbers (answers, due reviews, mock exams),
 * so practice results are part of it too.
 */
function notificationSignature(user: User, language: string): string {
    const today = dayKey();
    const prefs = prefsOf(user);
    const streak = computeStreak(user, today);
    const goal = goalProgress(user, today);
    const lastMock = user.testProgress[user.testProgress.length - 1]?.datetime ?? "";
    let correct = 0;
    let wrong = 0;
    for (const question of user.questionProgress ?? []) {
        if (question?.answeredCorrectly === true) {
            correct++;
        } else if (question?.answeredCorrectly === false) {
            wrong++;
        }
    }
    return JSON.stringify([
        today,
        language,
        prefs.notificationsEnabled,
        prefs.reminders,
        prefs.restDays,
        prefs.dailyGoal,
        user.examDate,
        user.onboardingCompleted,
        streak.current,
        streak.todayDone,
        goal.met,
        lastMock,
        user.testProgress?.length ?? 0,
        correct,
        wrong,
        user.reviewSchedule?.length ?? 0,
        user.nickname ?? "",
    ]);
}

/** Re-plans Android notifications when something relevant changes. No-op on the web. */
function useNativeNotifications(user: User | null | undefined, t: Translations, language: string) {
    const lastSignature = useRef("");
    const pending = useRef<number | null>(null);
    const latest = useRef({ user, t });
    useEffect(() => {
        latest.current = { user, t };
    });
    useEffect(() => {
        if (user === undefined || !Capacitor.isNativePlatform()) {
            return;
        }
        const signature = user ? notificationSignature(user, language) : "none";
        if (signature === lastSignature.current) {
            // Same plan, so an already scheduled sync must survive this re-render.
            return;
        }
        lastSignature.current = signature;
        if (pending.current !== null) {
            window.clearTimeout(pending.current);
        }
        pending.current = window.setTimeout(() => {
            pending.current = null;
            void syncNativeNotifications(latest.current.user ?? null, latest.current.t);
        }, 800);
    }, [user, t, language]);
    useEffect(() => {
        return () => {
            if (pending.current !== null) {
                window.clearTimeout(pending.current);
            }
        };
    }, []);
}

/** Opens the matching screen when an Android notification is tapped. */
function useNotificationTaps() {
    const router = useRouter();
    useEffect(() => addNotificationTapListener((route) => navigateTo(route, router.push)), [router]);
}

/** Mirrors preferences onto <html>: language and larger text. */
function useDocumentAttributes(user: User | null | undefined, language: string) {
    const largeText = prefsOf(user).largeText;
    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);
    useEffect(() => {
        if (largeText) {
            document.documentElement.setAttribute("data-text-size", "large");
        } else {
            document.documentElement.removeAttribute("data-text-size");
        }
    }, [largeText]);
}

/** Matches the Android status and navigation bars to the theme. */
function useSystemBars() {
    const { resolvedTheme } = useTheme();
    useEffect(() => {
        if (Capacitor.getPlatform() !== "android" || !resolvedTheme) {
            return;
        }
        const light = resolvedTheme === "light";
        void Promise.all([
            EdgeToEdge.setBackgroundColor({ color: light ? "#F2F3F5" : "#140E10" }),
            AppSystemBars.setStyle({ light }),
        ]).catch((error: unknown) => {
            console.warn("Failed to update Android system bars", error);
        });
    }, [resolvedTheme]);
}

/** All app-wide side effects, mounted once by the shell. */
export function useAppEffects() {
    const user = useUser();
    const t = useTranslations();
    const language = useAppLanguage();
    useStartup(user);
    useEngagement(user, t);
    useNativeNotifications(user, t, language);
    useNotificationTaps();
    useDocumentAttributes(user, language);
    useSystemBars();
    useAndroidBackButton();
}
