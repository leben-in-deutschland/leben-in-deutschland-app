"use client";

import type { ReactNode } from "react";
import type { Accent } from "@/components/ui/icon-badge";
import {
    BellIcon,
    ClipboardCheckIcon,
    DownloadIcon,
    FlameIcon,
    HeartIcon,
    InfoIcon,
    MapPinIcon,
    SparklesIcon,
    TargetIcon,
    type IconComponent,
} from "@/components/ui/icons";
import packageJson from "@/package.json";
import { tipJarSupported } from "@/services/tip-jar";
import type { Translations } from "@/utils/i18n";
import { fmt, formatDate, plural } from "@/utils/i18n";
import { dayKey, parseDayKey } from "@/utils/date-utils";
import { MAX_STREAK_FREEZES, prefsOf } from "@/utils/user-defaults";
import type { User } from "@/types/user";
import { AboutSection } from "./about-section";
import { DataSection } from "./data-section";
import { ExamSection } from "./exam-section";
import { NotificationsSection } from "./notifications-section";
import { PracticeSection } from "./practice-section";
import { countActiveReminders, examCountdown, streakSummary } from "./preferences-logic";
import { ProfileSection } from "./profile-section";
import { StreakSection } from "./streak-section";
import { SupportSection } from "./support-section";
import { type SettingsSectionId } from "./settings-ids";
import { UiModeSection } from "./ui-mode-section";

/**
 * The settings sections: one registry for the hub (`/settings`, a row per
 * section with its current value) and the sub-pages (`/settings/<id>`, the
 * section on its own). Adding a section means adding one entry here; the
 * static route list in `app/settings/[section]/page.tsx` reads the ids.
 */

export { SETTINGS_SECTION_IDS, isSettingsSectionId, type SettingsSectionId } from "./settings-ids";

export const SETTINGS_GROUPS: { id: "learning" | "motivation" | "app"; sections: SettingsSectionId[] }[] = [
    { id: "learning", sections: ["profile", "practice", "exam"] },
    { id: "motivation", sections: ["streak", "notifications"] },
    { id: "app", sections: ["design", "data", "support", "about"] },
];

/** What a summary line may look at; kept plain so it is cheap to test. */
export type SummaryContext = {
    t: Translations;
    user: User;
    language: "de" | "en";
    isNative: boolean;
    today?: string;
};

export type SettingsSectionEntry = {
    id: SettingsSectionId;
    icon: IconComponent;
    accent: Accent;
    title: (t: Translations) => string;
    description?: (t: Translations) => string;
    /** One line with the current value, shown under the title on the hub. */
    summary: (ctx: SummaryContext) => string;
    /** False hides the row and the sub-page content (e.g. tips without a store). */
    available?: (ctx: Pick<SummaryContext, "isNative">) => boolean;
    render: (user: User) => ReactNode;
};

const languageName = (language: "de" | "en") => (language === "de" ? "Deutsch" : "English");

export const SETTINGS_SECTIONS: Record<SettingsSectionId, SettingsSectionEntry> = {
    profile: {
        id: "profile",
        icon: MapPinIcon,
        accent: "primary",
        title: (t) => t.settings_section_profile,
        summary: ({ user, language }) => [user.state?.stateName, languageName(language)].filter(Boolean).join(" · "),
        render: (user) => <ProfileSection user={user} />,
    },
    practice: {
        id: "practice",
        icon: TargetIcon,
        accent: "success",
        title: (t) => t.settings_section_practice,
        summary: ({ t, user }) => {
            const prefs = prefsOf(user);
            const size = prefs.sessionSize === 0 ? t.settings_session_size_all : String(prefs.sessionSize);
            return `${plural(t, "settings_daily_goal_value", prefs.dailyGoal)} · ${fmt(t.settings_hub_session_size, { count: size })}`;
        },
        render: (user) => <PracticeSection user={user} />,
    },
    exam: {
        id: "exam",
        icon: ClipboardCheckIcon,
        accent: "secondary",
        title: (t) => t.settings_section_exam,
        summary: ({ t, user, language, today = dayKey() }) => {
            const prefs = prefsOf(user);
            const type = prefs.examType === "lid" ? t.exam_type_lid : t.exam_type_einbuergerung;
            const countdown = examCountdown(user.examDate ?? null, today);
            let date = t.settings_exam_date_none;
            if (countdown.kind === "future") {
                date = plural(t, "settings_exam_date_in", countdown.days);
            } else if (countdown.kind === "today") {
                date = t.settings_exam_date_today;
            } else if (countdown.kind === "past") {
                date = formatDate(parseDayKey(user.examDate as string), language);
            }
            return `${type} · ${date}`;
        },
        render: (user) => <ExamSection user={user} />,
    },
    streak: {
        id: "streak",
        icon: FlameIcon,
        accent: "warning",
        title: (t) => t.settings_section_streak,
        description: (t) => t.settings_section_streak_hint,
        summary: ({ t, user }) => streakSummary(t, prefsOf(user), Math.max(0, Math.min(MAX_STREAK_FREEZES, user.streak?.freezes ?? 0))),
        render: (user) => <StreakSection user={user} />,
    },
    notifications: {
        id: "notifications",
        icon: BellIcon,
        accent: "danger",
        title: (t) => t.notifications_title,
        summary: ({ t, user, isNative }) => {
            if (!isNative) {
                return t.settings_hub_notifications_web;
            }
            const prefs = prefsOf(user);
            if (!prefs.notificationsEnabled) {
                return t.settings_hub_notifications_off;
            }
            const { active, total } = countActiveReminders(prefs.reminders);
            return fmt(t.settings_reminders_active_count, { count: active, total });
        },
        render: (user) => <NotificationsSection user={user} />,
    },
    design: {
        id: "design",
        icon: SparklesIcon,
        accent: "primary",
        title: (t) => t.ui_mode_section_title,
        description: (t) => t.ui_mode_section_hint,
        summary: ({ t }) => t.ui_mode_current_modern,
        render: () => <UiModeSection />,
    },
    data: {
        id: "data",
        icon: DownloadIcon,
        accent: "default",
        title: (t) => t.settings_section_data,
        description: (t) => t.settings_section_data_hint,
        summary: ({ t }) => t.settings_hub_data,
        render: (user) => <DataSection user={user} />,
    },
    support: {
        id: "support",
        icon: HeartIcon,
        accent: "danger",
        title: (t) => t.settings_section_support,
        summary: ({ t }) => t.settings_hub_support,
        available: ({ isNative }) => isNative && tipJarSupported(),
        render: () => <SupportSection />,
    },
    about: {
        id: "about",
        icon: InfoIcon,
        accent: "default",
        title: (t) => t.settings_section_about,
        summary: ({ t }) => `${t.settings_version} ${packageJson.version}`,
        render: () => <AboutSection />,
    },
};
