import { describe, expect, it } from "vitest";
import { completeOnboarding, deviceLanguage, goalLevels, onboardingSteps, RECOMMENDED_GOAL, type OnboardingResult } from "@/components/onboarding/onboarding-logic";
import type { State } from "@/types/state";
import type { User } from "@/types/user";
import { DAILY_GOAL_OPTIONS, DEFAULT_PREFERENCES, prefsOf } from "@/utils/user-defaults";

const BERLIN: State = { name: "Berlin", code: "BE", eng: "Berlin", capital: "Berlin" };
const NOW = new Date("2026-10-09T10:00:00");

const result: OnboardingResult = {
    state: BERLIN,
    language: "en",
    dailyGoal: 20,
    remindersEnabled: true,
    reminderTime: "07:30",
};

/** A record written by version 2.0: no preferences, no onboarding flag, legacy date strings. */
function legacyUser(): User {
    return {
        id: "",
        state: { stateCode: "", stateName: "" },
        dailyProgress: [{ date: "Thu Oct 08 2026", correct: 3, incorrect: 1, attempted: 4, skipped: 0, flagged: 0 }],
        questionProgress: [{ num: "12", answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false }],
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: "Thu Oct 01 2026" as unknown as Date,
        lastReviewPromptDateTime: null,
        reviewNoCount: 2,
        userReviewed: false,
    };
}

describe("onboardingSteps", () => {
    it("asks about reminders only in the Android app, which makes it the last step there", () => {
        expect(onboardingSteps(true)).toEqual(["state", "goal", "reminders"]);
        expect(onboardingSteps(false)).toEqual(["state", "goal"]);
    });

    it("never asks for a welcome, exam date, or summary step", () => {
        for (const isNative of [true, false]) {
            expect(onboardingSteps(isNative).length).toBeLessThanOrEqual(3);
            expect(onboardingSteps(isNative)[0]).toBe("state");
        }
    });
});

describe("deviceLanguage", () => {
    it("picks German for German devices and English for everything else", () => {
        for (const tag of ["de", "de-DE", "de-AT", "de-CH", "DE-de", " de "]) {
            expect(deviceLanguage(tag)).toBe("de");
        }
        for (const tag of ["en", "en-US", "tr-TR", "ar", "uk-UA", "", null, undefined]) {
            expect(deviceLanguage(tag)).toBe("en");
        }
    });
});

describe("goalLevels", () => {
    it("covers every daily goal option once and recommends the default", () => {
        const levels = goalLevels();
        expect(levels.map((level) => level.goal)).toEqual([...DAILY_GOAL_OPTIONS]);
        expect(levels.filter((level) => level.recommended).map((level) => level.goal)).toEqual([RECOMMENDED_GOAL]);
        expect(RECOMMENDED_GOAL).toBe(DEFAULT_PREFERENCES.dailyGoal);
        expect(new Set(levels.map((level) => level.labelKey)).size).toBe(levels.length);
        for (const level of levels) {
            expect(level.minutes).toBeGreaterThan(0);
        }
    });
});

describe("completeOnboarding for a new learner", () => {
    it("creates a complete record with the chosen values and no exam date", () => {
        const user = completeOnboarding(null, result, NOW);
        expect(user.state).toEqual({ stateCode: "BE", stateName: "Berlin" });
        expect(user.appLanguage).toBe("en");
        expect(user.onboardingCompleted).toBe(true);
        expect(user.examDate).toBeNull();
        expect(user.appFirstTimeOpenDateTime).toEqual(NOW);
        expect(user.questionProgress).toEqual([]);
        const prefs = prefsOf(user);
        expect(prefs.dailyGoal).toBe(20);
        expect(prefs.notificationsEnabled).toBe(true);
        expect(prefs.reminders.daily).toBe(true);
        expect(prefs.reminders.dailyTime).toBe("07:30");
        expect(prefs.reminders.streak).toBe(DEFAULT_PREFERENCES.reminders.streak);
    });

    it("falls back to safe defaults for odd input", () => {
        const user = completeOnboarding(null, { ...result, dailyGoal: 7, reminderTime: "25:99" }, NOW);
        const prefs = prefsOf(user);
        expect(prefs.dailyGoal).toBe(RECOMMENDED_GOAL);
        expect(prefs.reminders.dailyTime).toBe(DEFAULT_PREFERENCES.reminders.dailyTime);
    });

    it("turns the master switch off on \"Not now\" but keeps the daily reminder ready", () => {
        const prefs = prefsOf(completeOnboarding(null, { ...result, remindersEnabled: false, reminderTime: "21:00" }, NOW));
        expect(prefs.notificationsEnabled).toBe(false);
        expect(prefs.reminders.daily).toBe(DEFAULT_PREFERENCES.reminders.daily);
        expect(prefs.reminders.dailyTime).toBe("21:00");
    });

    it("leaves notification settings untouched when the step was not shown", () => {
        const prefs = prefsOf(completeOnboarding(null, { ...result, remindersEnabled: null, reminderTime: "21:00" }, NOW));
        expect(prefs.notificationsEnabled).toBe(DEFAULT_PREFERENCES.notificationsEnabled);
        expect(prefs.reminders.dailyTime).toBe(DEFAULT_PREFERENCES.reminders.dailyTime);
    });
});

describe("completeOnboarding for an existing record", () => {
    it("keeps all progress and legacy fields and only sets state, language, preferences, and the flag", () => {
        const existing = legacyUser();
        const user = completeOnboarding(existing, result, NOW);
        expect(user.dailyProgress).toEqual(existing.dailyProgress);
        expect(user.questionProgress).toEqual(existing.questionProgress);
        expect(user.reviewNoCount).toBe(2);
        expect(user.appFirstTimeOpenDateTime).toBe(existing.appFirstTimeOpenDateTime);
        expect(user.state).toEqual({ stateCode: "BE", stateName: "Berlin" });
        expect(user.appLanguage).toBe("en");
        expect(user.examDate).toBeNull();
        expect(user.onboardingCompleted).toBe(true);
        expect(prefsOf(user).dailyGoal).toBe(20);
        expect(prefsOf(user).reminders.dailyTime).toBe("07:30");
    });

    it("keeps an exam date the learner set before, since the flow no longer asks for one", () => {
        const existing: User = { ...legacyUser(), examDate: "2026-12-01", nickname: "Amira" };
        const user = completeOnboarding(existing, result, NOW);
        expect(user.examDate).toBe("2026-12-01");
        expect(user.nickname).toBe("Amira");
        expect(user.questionProgress).toEqual(existing.questionProgress);
    });

    it("drops an exam date that is not a day key", () => {
        expect(completeOnboarding({ ...legacyUser(), examDate: "01.12.2026" }, result, NOW).examDate).toBeNull();
    });

    it("merges into existing preferences instead of replacing them", () => {
        const existing: User = { ...legacyUser(), preferences: { ...DEFAULT_PREFERENCES, largeText: true, restDays: [0], examType: "lid" } };
        const prefs = prefsOf(completeOnboarding(existing, result, NOW));
        expect(prefs.largeText).toBe(true);
        expect(prefs.restDays).toEqual([0]);
        expect(prefs.examType).toBe("lid");
        expect(prefs.dailyGoal).toBe(20);
    });

    it("does not mutate the existing record", () => {
        const existing = legacyUser();
        const snapshot = JSON.stringify(existing);
        completeOnboarding(existing, result, NOW);
        expect(JSON.stringify(existing)).toBe(snapshot);
    });
});
