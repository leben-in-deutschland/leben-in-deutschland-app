import { State } from "@/types/state";
import {
    ExamType,
    InAppNotification,
    MockTestProgress,
    ReminderPreferences,
    ReviewItem,
    StreakRule,
    StreakState,
    UnlockedAchievement,
    User,
    UserDailyProgress,
    UserPreferences,
    UserQuestionProgress,
} from "@/types/user";
import { addDays, isDayKey } from "./date-utils";

/**
 * Defaults, validation, and migration for the stored learner record.
 *
 * Records written by older app versions miss every field added in 2.1.
 * `normalizeUser` (read path, no side effects) fills those gaps in memory.
 * `migrateUser` (write path) performs one-time upgrades and stamps
 * `schemaVersion`. Neither function removes or renames existing fields, so an
 * older app version can still read what the new one writes.
 */

export const CURRENT_SCHEMA_VERSION = 2;

export const DAILY_GOAL_OPTIONS = [5, 10, 20, 33, 50] as const;
/** 0 means "all questions of the mode". */
export const SESSION_SIZE_OPTIONS = [10, 20, 33, 0] as const;
export const MAX_STREAK_FREEZES = 2;
export const MAX_REST_DAYS = 3;
export const MAX_INBOX_ITEMS = 60;

export const PASS_MARKS: Record<ExamType, number> = {
    einbuergerung: 17,
    lid: 15,
};

export const DEFAULT_REMINDERS: ReminderPreferences = {
    daily: true,
    /** Morning, so the question of the day is seen early; the streak check comes in the evening. */
    dailyTime: "07:00",
    streak: true,
    streakTime: "20:30",
    weekly: true,
    examCountdown: true,
    mockNudge: true,
    comeback: true,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
    dailyGoal: 10,
    streakRule: "activity",
    restDays: [],
    examType: "einbuergerung",
    mockTimer: true,
    confirmAnswers: false,
    autoAdvance: false,
    haptics: true,
    largeText: false,
    translationLanguage: "en",
    sessionSize: 20,
    notificationsEnabled: true,
    reminders: DEFAULT_REMINDERS,
    tips: true,
};

export const DEFAULT_STREAK: StreakState = {
    best: 0,
    freezes: 0,
    frozenDays: [],
    freezeEarnedDays: [],
};

const TRANSLATION_LANGUAGES = ["en", "tr", "ru", "fr", "ar", "uk", "hi"];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray<T>(value: unknown, keep: (item: unknown) => boolean = (item) => item !== null && item !== undefined): T[] {
    return Array.isArray(value) ? (value.filter(keep) as T[]) : [];
}

function asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function asTime(value: unknown, fallback: string): string {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function asCount(value: unknown, fallback = 0): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/** Pass mark for an exam type (17 for the Einbürgerungstest, 15 for "Leben in Deutschland"). */
export function passMarkFor(examType: ExamType | undefined): number {
    return PASS_MARKS[examType ?? "einbuergerung"] ?? 17;
}

/** Pass mark a stored mock exam was graded with. Older records used 17. */
export function passMarkOf(test: MockTestProgress): number {
    return typeof test.passMark === "number" ? test.passMark : 17;
}

export function normalizePreferences(value: unknown): UserPreferences {
    const raw = isRecord(value) ? value : {};
    const reminders = isRecord(raw.reminders) ? raw.reminders : {};
    const restDays = Array.from(
        new Set(asArray<number>(raw.restDays, (day) => Number.isInteger(day) && (day as number) >= 0 && (day as number) <= 6)),
    )
        .sort((a, b) => a - b)
        .slice(0, MAX_REST_DAYS);
    const dailyGoal = asCount(raw.dailyGoal, DEFAULT_PREFERENCES.dailyGoal);
    const sessionSize = asCount(raw.sessionSize, DEFAULT_PREFERENCES.sessionSize);
    const streakRule: StreakRule = raw.streakRule === "goal" ? "goal" : "activity";
    const examType: ExamType = raw.examType === "lid" ? "lid" : "einbuergerung";
    const translationLanguage =
        typeof raw.translationLanguage === "string" && TRANSLATION_LANGUAGES.includes(raw.translationLanguage)
            ? raw.translationLanguage
            : DEFAULT_PREFERENCES.translationLanguage;

    return {
        dailyGoal: dailyGoal >= 1 && dailyGoal <= 200 ? dailyGoal : DEFAULT_PREFERENCES.dailyGoal,
        streakRule,
        restDays,
        examType,
        mockTimer: asBoolean(raw.mockTimer, DEFAULT_PREFERENCES.mockTimer),
        confirmAnswers: asBoolean(raw.confirmAnswers, DEFAULT_PREFERENCES.confirmAnswers),
        autoAdvance: asBoolean(raw.autoAdvance, DEFAULT_PREFERENCES.autoAdvance),
        haptics: asBoolean(raw.haptics, DEFAULT_PREFERENCES.haptics),
        largeText: asBoolean(raw.largeText, DEFAULT_PREFERENCES.largeText),
        translationLanguage,
        sessionSize: (SESSION_SIZE_OPTIONS as readonly number[]).includes(sessionSize)
            ? sessionSize
            : DEFAULT_PREFERENCES.sessionSize,
        notificationsEnabled: asBoolean(raw.notificationsEnabled, DEFAULT_PREFERENCES.notificationsEnabled),
        reminders: {
            daily: asBoolean(reminders.daily, DEFAULT_REMINDERS.daily),
            dailyTime: asTime(reminders.dailyTime, DEFAULT_REMINDERS.dailyTime),
            streak: asBoolean(reminders.streak, DEFAULT_REMINDERS.streak),
            streakTime: asTime(reminders.streakTime, DEFAULT_REMINDERS.streakTime),
            weekly: asBoolean(reminders.weekly, DEFAULT_REMINDERS.weekly),
            examCountdown: asBoolean(reminders.examCountdown, DEFAULT_REMINDERS.examCountdown),
            mockNudge: asBoolean(reminders.mockNudge, DEFAULT_REMINDERS.mockNudge),
            comeback: asBoolean(reminders.comeback, DEFAULT_REMINDERS.comeback),
        },
        tips: asBoolean(raw.tips, DEFAULT_PREFERENCES.tips),
    };
}

export function normalizeStreak(value: unknown): StreakState {
    const raw = isRecord(value) ? value : {};
    return {
        best: asCount(raw.best),
        freezes: Math.min(MAX_STREAK_FREEZES, asCount(raw.freezes)),
        frozenDays: asArray<string>(raw.frozenDays, isDayKey),
        freezeEarnedDays: asArray<string>(raw.freezeEarnedDays, isDayKey),
    };
}

/**
 * Read path: turns whatever is stored into a complete `User`, filling every
 * missing field with its default. Returns null for unusable input. Pure.
 */
export function normalizeUser(value: unknown): User | null {
    if (!isRecord(value)) {
        return null;
    }
    const state = isRecord(value.state) ? value.state : {};
    const examDate = isDayKey(value.examDate) ? value.examDate : null;

    return {
        ...(value as unknown as User),
        id: typeof value.id === "string" ? value.id : "",
        state: {
            stateName: typeof state.stateName === "string" ? state.stateName : "",
            stateCode: typeof state.stateCode === "string" ? state.stateCode : "",
        },
        dailyProgress: asArray<UserDailyProgress>(value.dailyProgress, isRecord),
        questionProgress: asArray<UserQuestionProgress>(
            value.questionProgress,
            (item) => isRecord(item) && typeof item.num === "string",
        ),
        testProgress: asArray<MockTestProgress>(value.testProgress, (item) => isRecord(item) && Array.isArray(item.questions)),
        appLanguage: value.appLanguage === "en" ? "en" : "de",
        appFirstTimeOpenDateTime: (value.appFirstTimeOpenDateTime as Date) ?? new Date(0),
        lastReviewPromptDateTime: (value.lastReviewPromptDateTime as Date | null) ?? null,
        reviewNoCount: asCount(value.reviewNoCount),
        userReviewed: asBoolean(value.userReviewed, false),
        preferences: normalizePreferences(value.preferences),
        streak: normalizeStreak(value.streak),
        reviewSchedule: asArray<ReviewItem>(
            value.reviewSchedule,
            (item) => isRecord(item) && typeof item.num === "string" && isDayKey(item.due),
        ),
        achievements: asArray<UnlockedAchievement>(value.achievements, (item) => isRecord(item) && typeof item.id === "string"),
        inbox: asArray<InAppNotification>(value.inbox, (item) => isRecord(item) && typeof item.id === "string"),
        examDate,
        nickname: typeof value.nickname === "string" ? value.nickname.slice(0, 40) : "",
        onboardingCompleted: asBoolean(value.onboardingCompleted, Boolean(state.stateCode)),
    };
}

/** Preferences of a normalized user (never undefined). */
export function prefsOf(user: User | null | undefined): UserPreferences {
    return user?.preferences ?? DEFAULT_PREFERENCES;
}

/** Small stable hash used to spread seeded review dates. */
function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/**
 * Write path: one-time upgrades for records from older versions. Returns a
 * new object; the caller saves it. `today` is a "YYYY-MM-DD" day key.
 *
 * - Seeds the spaced-repetition schedule from existing answers. Known answers
 *   are spread over the next 7 days so the first review queue stays small;
 *   wrong answers are due today.
 * - Marks onboarding as done for learners who already chose a state.
 */
export function migrateUser(user: User, today: string): User {
    if ((user.schemaVersion ?? 1) >= CURRENT_SCHEMA_VERSION) {
        return user;
    }
    const next: User = { ...user, schemaVersion: CURRENT_SCHEMA_VERSION };

    if (!next.reviewSchedule || next.reviewSchedule.length === 0) {
        next.reviewSchedule = next.questionProgress
            .filter((progress) => progress.answeredCorrectly !== null && !progress.skipped)
            .map((progress) =>
                progress.answeredCorrectly
                    ? { num: progress.num, box: 2, due: addDays(today, 1 + (hashString(progress.num) % 7)), lastReviewed: today }
                    : { num: progress.num, box: 1, due: today, lastReviewed: today },
            );
    }
    if (next.onboardingCompleted === undefined) {
        next.onboardingCompleted = Boolean(next.state?.stateCode);
    }
    return next;
}

export interface NewUserOptions {
    state: State;
    language: string;
    preferences?: Partial<UserPreferences>;
    examDate?: string | null;
    nickname?: string;
}

/** A fresh learner record for onboarding. */
export function createNewUser(options: NewUserOptions, now: Date = new Date()): User {
    const preferences = normalizePreferences({ ...DEFAULT_PREFERENCES, ...options.preferences });
    return {
        id: "",
        state: { stateCode: options.state.code, stateName: options.state.name },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: options.language === "en" ? "en" : "de",
        appFirstTimeOpenDateTime: now,
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        preferences,
        streak: { ...DEFAULT_STREAK },
        reviewSchedule: [],
        achievements: [],
        inbox: [],
        examDate: isDayKey(options.examDate) ? options.examDate : null,
        nickname: (options.nickname ?? "").trim().slice(0, 40),
        onboardingCompleted: true,
        lastOpenedAt: now.toISOString(),
    };
}

/** Switches the federal state and keeps all progress. */
export function changeUserState(user: User, state: State): User {
    return { ...user, state: { stateCode: state.code, stateName: state.name } };
}

/**
 * "Start over": removes answers, mock exams, daily history, review schedule,
 * achievements, streak, and notifications. Keeps state, language, settings,
 * exam date, and nickname.
 */
export function resetProgress(user: User): User {
    return {
        ...user,
        questionProgress: [],
        testProgress: [],
        dailyProgress: [],
        reviewSchedule: [],
        achievements: [],
        inbox: [],
        streak: { ...DEFAULT_STREAK },
    };
}
