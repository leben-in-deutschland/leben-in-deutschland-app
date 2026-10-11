import type { State } from "@/types/state";
import type { User, UserPreferences } from "@/types/user";
import { isDayKey } from "@/utils/date-utils";
import { createNewUser, DAILY_GOAL_OPTIONS, DEFAULT_PREFERENCES, normalizePreferences, prefsOf } from "@/utils/user-defaults";

/**
 * Pure helpers for the first-run flow. No React, no storage.
 */

export type OnboardingStep = "state" | "goal" | "reminders";

/** Steps in order. The reminders step only exists in the Android app, so the last step finishes the flow. */
export function onboardingSteps(isNative: boolean): OnboardingStep[] {
    return isNative ? ["state", "goal", "reminders"] : ["state", "goal"];
}

/**
 * Interface language for a learner who has not chosen one yet: German on a
 * German device (`navigator.language` such as "de", "de-DE", "de-AT"),
 * English everywhere else.
 */
export function deviceLanguage(navigatorLanguage: string | null | undefined): "de" | "en" {
    return (navigatorLanguage ?? "").trim().toLowerCase().startsWith("de") ? "de" : "en";
}

export type GoalLevel = {
    goal: number;
    /** Translation key of the friendly label, e.g. "onboarding_goal_steady". */
    labelKey: string;
    /** Rough minutes per day at about half a minute per question. */
    minutes: number;
    recommended: boolean;
};

const GOAL_LABEL_KEYS: Record<number, string> = {
    5: "onboarding_goal_light",
    10: "onboarding_goal_steady",
    20: "onboarding_goal_serious",
    33: "onboarding_goal_exam",
    50: "onboarding_goal_intense",
};

export const RECOMMENDED_GOAL = DEFAULT_PREFERENCES.dailyGoal;

/** One row per `DAILY_GOAL_OPTIONS` entry, with a friendly label and a time estimate. */
export function goalLevels(): GoalLevel[] {
    return DAILY_GOAL_OPTIONS.map((goal) => ({
        goal,
        labelKey: GOAL_LABEL_KEYS[goal] ?? "onboarding_goal_steady",
        minutes: Math.max(1, Math.round(goal / 2)),
        recommended: goal === RECOMMENDED_GOAL,
    }));
}

export type OnboardingResult = {
    state: State;
    language: "de" | "en";
    dailyGoal: number;
    /**
     * Android: daily reminder on (permission already granted) or off ("Not now").
     * Null when the step was not shown (web); the stored value then stays as it is.
     */
    remindersEnabled: boolean | null;
    /** "HH:MM" for the daily reminder. */
    reminderTime: string;
};

/**
 * Builds the record to save when the flow finishes.
 *
 * A new learner gets a fresh record without an exam date; the date is set in
 * Settings. An existing record (a learner from an older version without a
 * state) keeps every bit of progress, including an exam date it already has;
 * only state, language, the chosen preferences, and the completion flag
 * change. The stored shape and date formats stay as they are.
 */
export function completeOnboarding(existing: User | null, result: OnboardingResult, now: Date = new Date()): User {
    const dailyGoal = (DAILY_GOAL_OPTIONS as readonly number[]).includes(result.dailyGoal) ? result.dailyGoal : RECOMMENDED_GOAL;
    const base = existing ? prefsOf(existing) : DEFAULT_PREFERENCES;
    // normalizePreferences validates the goal and the "HH:MM" time and fills every other field.
    const asked = result.remindersEnabled !== null;
    const preferences = normalizePreferences({
        ...base,
        dailyGoal,
        notificationsEnabled: asked ? Boolean(result.remindersEnabled) : base.notificationsEnabled,
        reminders: {
            ...base.reminders,
            // "Not now" only turns the master switch off, so the daily reminder is ready when reminders are enabled later.
            daily: result.remindersEnabled ? true : base.reminders.daily,
            dailyTime: asked ? result.reminderTime : base.reminders.dailyTime,
        },
    } satisfies UserPreferences);

    if (!existing) {
        return createNewUser({ state: result.state, language: result.language, preferences }, now);
    }

    return {
        ...existing,
        state: { stateCode: result.state.code, stateName: result.state.name },
        appLanguage: result.language,
        preferences,
        examDate: isDayKey(existing.examDate) ? existing.examDate : null,
        onboardingCompleted: true,
    };
}
