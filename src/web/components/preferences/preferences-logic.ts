import type { ReminderPreferences, UserPreferences } from "@/types/user";
import { daysBetween, isDayKey } from "@/utils/date-utils";
import { localeFor, plural, type Translations } from "@/utils/i18n";
import { MAX_REST_DAYS } from "@/utils/user-defaults";

/**
 * Pure helpers for the settings screen. No React, no storage.
 */

/** Question translation languages, named in their own language. Same list as `normalizePreferences` accepts. */
export const TRANSLATION_LANGUAGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: "en", label: "English" },
    { value: "tr", label: "Türkçe" },
    { value: "ru", label: "Русский" },
    { value: "fr", label: "Français" },
    { value: "ar", label: "العربية" },
    { value: "uk", label: "Українська" },
    { value: "hi", label: "हिन्दी" },
];

/** Weekdays in display order, Monday first, in the 0 = Sunday numbering of `restDays`. */
export const WEEKDAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

/** Short localized weekday name for 0 = Sunday ... 6 = Saturday, e.g. "Mo" or "Mon". */
export function weekdayLabel(weekday: number, language: string): string {
    // 7 January 2024 was a Sunday.
    const date = new Date(2024, 0, 7 + weekday);
    return new Intl.DateTimeFormat(localeFor(language), { weekday: "short" }).format(date).replace(/\.$/, "");
}

/** Adds or removes a rest day. Never more than `max` days; the result is sorted and unique. */
export function toggleRestDay(restDays: readonly number[], weekday: number, max: number = MAX_REST_DAYS): number[] {
    const current = Array.from(new Set(restDays)).sort((a, b) => a - b);
    if (current.includes(weekday)) {
        return current.filter((day) => day !== weekday);
    }
    if (current.length >= max) {
        return current;
    }
    return [...current, weekday].sort((a, b) => a - b);
}

/** One line for the streak fold-out while it is closed, e.g. "Any practice · no rest days". */
export function streakSummary(t: Translations, prefs: Pick<UserPreferences, "streakRule" | "restDays">, freezes: number): string {
    const parts = [
        prefs.streakRule === "goal" ? t.settings_streak_rule_goal : t.settings_streak_rule_activity,
        prefs.restDays.length > 0 ? plural(t, "settings_streak_summary_rest_days", prefs.restDays.length) : t.settings_streak_summary_no_rest_days,
    ];
    // Freezes are earned, not set; mention them only once there is one so the line stays short.
    if (freezes > 0) {
        parts.push(plural(t, "settings_streak_summary_freezes", freezes));
    }
    return parts.join(" · ");
}

/** Keys of `ReminderPreferences` that are switches, not times. */
type ReminderKind = { [K in keyof ReminderPreferences]: ReminderPreferences[K] extends boolean ? K : never }[keyof ReminderPreferences];

/** Reminder kinds with their own switch, in the order the settings screen lists them. */
export const REMINDER_KINDS: readonly ReminderKind[] = ["daily", "streak", "examCountdown", "weekly", "mockNudge", "comeback"];

/** How many reminder kinds are switched on, over how many exist, for the fold-out summary. */
export function countActiveReminders(reminders: ReminderPreferences): { active: number; total: number } {
    return { active: REMINDER_KINDS.filter((kind) => reminders[kind]).length, total: REMINDER_KINDS.length };
}

export type ExamCountdown =
    | { kind: "none" }
    | { kind: "past"; days: number }
    | { kind: "today" }
    | { kind: "future"; days: number };

/** Where the planned exam day lies relative to `today` (both "YYYY-MM-DD"). */
export function examCountdown(examDate: string | null | undefined, today: string): ExamCountdown {
    if (!isDayKey(examDate)) {
        return { kind: "none" };
    }
    const days = daysBetween(today, examDate);
    if (days < 0) {
        return { kind: "past", days: -days };
    }
    if (days === 0) {
        return { kind: "today" };
    }
    return { kind: "future", days };
}

/** Value of an `<input type="date">` as a day key, or null when empty or invalid. */
export function dayKeyFromInput(value: string): string | null {
    return isDayKey(value) ? value : null;
}

/** Value of an `<input type="time">` as "HH:MM"; seconds are dropped, anything else falls back. */
export function timeFromInput(value: string, fallback: string): string {
    const match = /^(([01]\d|2[0-3]):[0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
    return match ? match[1] : fallback;
}
