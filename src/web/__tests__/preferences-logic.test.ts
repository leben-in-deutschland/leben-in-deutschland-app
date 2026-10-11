import { describe, expect, it } from "vitest";
import {
    countActiveReminders,
    dayKeyFromInput,
    examCountdown,
    REMINDER_KINDS,
    streakSummary,
    timeFromInput,
    toggleRestDay,
    TRANSLATION_LANGUAGE_OPTIONS,
    WEEKDAY_ORDER,
    weekdayLabel,
} from "@/components/preferences/preferences-logic";
import { getTranslations } from "@/data/data";
import type { Translations } from "@/utils/i18n";
import { DEFAULT_PREFERENCES, DEFAULT_REMINDERS, MAX_REST_DAYS, normalizePreferences } from "@/utils/user-defaults";

describe("toggleRestDay", () => {
    it("adds a day, sorted and unique", () => {
        expect(toggleRestDay([6], 0)).toEqual([0, 6]);
        expect(toggleRestDay([6, 6], 0)).toEqual([0, 6]);
    });

    it("removes a selected day", () => {
        expect(toggleRestDay([0, 6], 6)).toEqual([0]);
    });

    it("never exceeds the maximum", () => {
        const full = [0, 5, 6];
        expect(full).toHaveLength(MAX_REST_DAYS);
        expect(toggleRestDay(full, 3)).toEqual(full);
        expect(toggleRestDay(full, 6)).toEqual([0, 5]);
    });

    it("does not mutate the input", () => {
        const input = [1];
        toggleRestDay(input, 2);
        expect(input).toEqual([1]);
    });
});

describe("weekdays", () => {
    it("lists Monday to Sunday in restDays numbering", () => {
        expect(WEEKDAY_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
    });

    it("labels weekdays in the app language without trailing dots", () => {
        expect(weekdayLabel(1, "de")).toBe("Mo");
        expect(weekdayLabel(0, "de")).toBe("So");
        expect(weekdayLabel(1, "en")).toBe("Mon");
        expect(weekdayLabel(0, "en")).toBe("Sun");
    });
});

describe("examCountdown", () => {
    const today = "2026-10-09";

    it("handles missing or invalid dates", () => {
        expect(examCountdown(null, today)).toEqual({ kind: "none" });
        expect(examCountdown(undefined, today)).toEqual({ kind: "none" });
        expect(examCountdown("09.10.2026", today)).toEqual({ kind: "none" });
    });

    it("counts days until the exam", () => {
        expect(examCountdown("2026-10-19", today)).toEqual({ kind: "future", days: 10 });
        expect(examCountdown("2026-10-09", today)).toEqual({ kind: "today" });
        expect(examCountdown("2026-10-01", today)).toEqual({ kind: "past", days: 8 });
    });
});

describe("input parsing", () => {
    it("accepts only day keys from the date input", () => {
        expect(dayKeyFromInput("2026-10-09")).toBe("2026-10-09");
        expect(dayKeyFromInput("")).toBeNull();
        expect(dayKeyFromInput("2026-13-01")).toBeNull();
    });

    it("keeps HH:MM, drops seconds, and falls back otherwise", () => {
        expect(timeFromInput("07:05", "18:00")).toBe("07:05");
        expect(timeFromInput("23:59:30", "18:00")).toBe("23:59");
        expect(timeFromInput("", "18:00")).toBe("18:00");
        expect(timeFromInput("24:00", "18:00")).toBe("18:00");
    });
});

describe("TRANSLATION_LANGUAGE_OPTIONS", () => {
    it("offers exactly the languages the record accepts", () => {
        for (const option of TRANSLATION_LANGUAGE_OPTIONS) {
            expect(normalizePreferences({ translationLanguage: option.value }).translationLanguage).toBe(option.value);
            expect(option.label.trim().length).toBeGreaterThan(0);
        }
        expect(normalizePreferences({ translationLanguage: "xx" }).translationLanguage).toBe("en");
    });
});

describe("countActiveReminders", () => {
    it("lists every reminder switch exactly once", () => {
        const switches = Object.entries(DEFAULT_REMINDERS)
            .filter(([, value]) => typeof value === "boolean")
            .map(([key]) => key)
            .sort();
        expect([...REMINDER_KINDS].sort()).toEqual(switches);
    });

    it("counts switched-on kinds over all kinds, ignoring the times", () => {
        expect(countActiveReminders(DEFAULT_REMINDERS)).toEqual({ active: 6, total: 6 });
        expect(countActiveReminders({ ...DEFAULT_REMINDERS, weekly: false, comeback: false, dailyTime: "07:00" })).toEqual({ active: 4, total: 6 });
        expect(
            countActiveReminders({ ...DEFAULT_REMINDERS, daily: false, streak: false, weekly: false, examCountdown: false, mockNudge: false, comeback: false }),
        ).toEqual({ active: 0, total: 6 });
    });
});

describe("streakSummary", () => {
    const de = getTranslations("de") as Translations;
    const en = getTranslations("en") as Translations;

    it("names the rule and the rest days", () => {
        expect(streakSummary(de, DEFAULT_PREFERENCES, 0)).toBe("Jedes Üben · keine Ruhetage");
        expect(streakSummary(en, DEFAULT_PREFERENCES, 0)).toBe("Any practice · no rest days");
        expect(streakSummary(de, { streakRule: "goal", restDays: [0] }, 0)).toBe("Tagesziel · 1 Ruhetag");
        expect(streakSummary(en, { streakRule: "goal", restDays: [0, 6] }, 0)).toBe("Daily goal · 2 rest days");
    });

    it("mentions freezes only once there is one", () => {
        expect(streakSummary(de, DEFAULT_PREFERENCES, 1)).toBe("Jedes Üben · keine Ruhetage · 1 Serienschutz");
        expect(streakSummary(en, { streakRule: "activity", restDays: [3] }, 2)).toBe("Any practice · 1 rest day · 2 freezes");
    });
});
