export interface User {
    id: string;
    state: UserState;
    dailyProgress: UserDailyProgress[];
    questionProgress: UserQuestionProgress[];
    testProgress: MockTestProgress[];
    appLanguage: string;
    appFirstTimeOpenDateTime: Date;
    lastReviewPromptDateTime: Date | null;
    reviewNoCount: number;
    userReviewed: boolean;

    /*
     * Fields below were added in 2.1 (UI revamp). They are optional because
     * records written by older versions do not have them; `normalizeUser`
     * fills defaults when a record is read.
     */

    /** Layout version of the stored record. Missing before 2.1. */
    schemaVersion?: number;
    preferences?: UserPreferences;
    streak?: StreakState;
    /** Spaced-repetition state per question. */
    reviewSchedule?: ReviewItem[];
    achievements?: UnlockedAchievement[];
    /** In-app notification center. Newest first. */
    inbox?: InAppNotification[];
    /** Planned exam day as "YYYY-MM-DD" (local calendar day). */
    examDate?: string | null;
    nickname?: string;
    onboardingCompleted?: boolean;
    /** BAMF exam date ("DD.MM.YYYY") the learner was last told about. */
    lastSeenEvaluationDate?: string;
    /** ISO timestamp of the last app start. */
    lastOpenedAt?: string;
}

export interface MockTestProgress {
    datetime: string;
    timeTake: string;
    passed: boolean;
    cancelled: boolean;
    questions: UserQuestionProgress[];
    /** Correct answers needed to pass. Missing on older records, which used 17. */
    passMark?: number;
    examType?: ExamType;
    /** Whether the 60-minute timer was on. Missing on older records (timed). */
    timed?: boolean;
}

export interface UserDailyProgress {
    date: string;
    correct: number;
    incorrect: number;
    attempted: number;
    skipped: number;
    flagged: number;
    /**
     * Answers given that day (practice answers plus answered mock questions).
     * Missing on older records; use `correct + incorrect` as a fallback.
     */
    answered?: number;
}

export interface UserQuestionProgress {
    num: string;
    answeredCorrectly: boolean | null;
    skipped: boolean;
    answerSelected: string | null;
    flagged: boolean;
}

export interface UserState {
    stateName: string;
    stateCode: string;
}

/** "einbuergerung" needs 17 of 33 correct, "lid" (Leben in Deutschland) needs 15. */
export type ExamType = "einbuergerung" | "lid";

/** "activity": any practice keeps the streak. "goal": the daily goal must be reached. */
export type StreakRule = "activity" | "goal";

export interface ReminderPreferences {
    /** Daily study reminder. */
    daily: boolean;
    /** "HH:MM", 24-hour local time. */
    dailyTime: string;
    /** Evening reminder when the streak is at risk. */
    streak: boolean;
    streakTime: string;
    /** Sunday evening weekly summary. */
    weekly: boolean;
    /** Reminders 30, 14, 7, 3, 1 days before the exam and on exam day. */
    examCountdown: boolean;
    /** Nudge to take a mock exam when none was taken recently. */
    mockNudge: boolean;
    /** Come-back reminders after 3, 5, 7, and 14 days away. */
    comeback: boolean;
}

export interface UserPreferences {
    /** Questions to answer per day: 5, 10, 20, 33, or 50. */
    dailyGoal: number;
    streakRule: StreakRule;
    /** Weekdays that never break the streak. 0 = Sunday ... 6 = Saturday. */
    restDays: number[];
    examType: ExamType;
    /** Mock exams run with the 60-minute timer. */
    mockTimer: boolean;
    /** Practice: pick an answer, then tap "Check" (instead of instant feedback). */
    confirmAnswers: boolean;
    /** Practice: move on automatically after a correct answer. */
    autoAdvance: boolean;
    /** Android: vibrate on correct and wrong answers. */
    haptics: boolean;
    /** Larger question and answer text. */
    largeText: boolean;
    /** Default language for question translations, e.g. "en" or "tr". */
    translationLanguage: string;
    /** Questions per practice session: 10, 20, 33, or 0 for all. */
    sessionSize: number;
    /** Android notifications master switch. */
    notificationsEnabled: boolean;
    reminders: ReminderPreferences;
    /** Show weekly study tips in the notification center. */
    tips: boolean;
}

export interface StreakState {
    /** Longest streak ever reached. */
    best: number;
    /** Saved streak freezes (0 to 2). */
    freezes: number;
    /** Days ("YYYY-MM-DD") that a freeze covered. */
    frozenDays: string[];
    /** Days ("YYYY-MM-DD") on which a freeze was earned. */
    freezeEarnedDays: string[];
}

export interface ReviewItem {
    num: string;
    /** Leitner box 1 (learning) to 5 (well known). */
    box: number;
    /** Next review day, "YYYY-MM-DD". */
    due: string;
    /** Day of the last answer, "YYYY-MM-DD". */
    lastReviewed: string;
}

export interface UnlockedAchievement {
    id: string;
    /** ISO timestamp. */
    unlockedAt: string;
}

export type InAppNotificationType =
    | "welcome"
    | "goal"
    | "streak"
    | "freeze"
    | "achievement"
    | "exam"
    | "evaluation"
    | "tip"
    | "mock";

export interface InAppNotification {
    /** Stable id so the same event is never added twice, e.g. "goal-2026-10-09". */
    id: string;
    type: InAppNotificationType;
    /** Translation key of the title. */
    titleKey: string;
    /** Translation key of the body. */
    bodyKey: string;
    /** Values for `{placeholders}` in the title and body. */
    params?: Record<string, string | number>;
    /** ISO timestamp. */
    createdAt: string;
    read: boolean;
    /** In-app route to open, e.g. "/progress". */
    route?: string;
}
