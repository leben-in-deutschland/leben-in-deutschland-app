import { MockTestProgress, User, UserQuestionProgress } from "@/types/user";
import { EXAM_QUESTION_COUNT, getRelevantQuestions, isStateQuestion, normalizeCategory } from "./question-bank";
import { computeReadiness, Readiness } from "./readiness-logic";
import { activityByDay, computeStreak, goalProgress, StreakInfo } from "./streak-logic";

/**
 * Achievements: badges for answering questions, keeping a streak, reaching
 * the daily goal, mock exams, and knowing the catalogue.
 *
 * Every achievement measures one number (its progress) against a fixed
 * target. It unlocks once the progress reaches the target and then stays
 * unlocked, even when the progress drops again (for example after a wrong
 * answer). `user.achievements` stores the unlocked ids with their time.
 *
 * Pure: no clock and no storage. Callers pass "today" and "now".
 */

export type AchievementTier = "bronze" | "silver" | "gold";

export interface AchievementContext {
    user: User;
    /** Local day, "YYYY-MM-DD". */
    today: string;
    /** Streak of `user` on `today`, see `computeStreak`. */
    streak: StreakInfo;
    /** Readiness of `user`, see `computeReadiness`. */
    readiness: Readiness;
}

export interface AchievementDef {
    id: string;
    /** Icon name for `<Icon name>` in components/ui/icons.tsx. */
    icon: string;
    tier: AchievementTier;
    /** "ach_<id>_title" */
    titleKey: string;
    /** "ach_<id>_desc" */
    descriptionKey: string;
    /** Progress at which the achievement unlocks. */
    target: number;
    /** Current value toward `target`. It can exceed the target; clamp it for display. */
    progress: (ctx: AchievementContext) => number;
}

/** A learner's catalogue: 300 general questions plus the 10 of their federal state. */
const CATALOGUE_TARGET = 310;
const STATE_TARGET = 10;
/** category_master reports the best topic as a percentage. */
const TOPIC_TARGET = 100;
const MOCK_RUN_TARGET = 3;

interface CatalogueSummary {
    /** Questions in the learner's catalogue. */
    total: number;
    /** Catalogue questions answered right or wrong at least once. */
    answered: number;
    /** Catalogue questions whose latest answer was right. */
    known: number;
    stateTotal: number;
    stateKnown: number;
    /** Highest share (0..1) of known questions within one topic. */
    bestTopicRatio: number;
}

/**
 * Answers over the learner's catalogue (general questions plus their
 * state's), counted by the same rules as `computeReadiness`.
 */
function catalogueSummary(user: User): CatalogueSummary {
    const stateCode = user.state?.stateCode ?? "";

    // Every writer updates the first entry of a question (findIndex), so if an
    // older record holds duplicates, the first one carries the latest answer.
    const latest = new Map<string, UserQuestionProgress>();
    for (const progress of user.questionProgress ?? []) {
        if (progress && !latest.has(progress.num)) {
            latest.set(progress.num, progress);
        }
    }

    let total = 0;
    let answered = 0;
    let known = 0;
    let stateTotal = 0;
    let stateKnown = 0;
    const topics = new Map<string, { total: number; known: number }>();
    for (const question of getRelevantQuestions(stateCode)) {
        const answer = latest.get(question.num)?.answeredCorrectly;
        const isKnown = answer === true;
        total += 1;
        answered += typeof answer === "boolean" ? 1 : 0;
        known += isKnown ? 1 : 0;
        if (isStateQuestion(question.num, stateCode)) {
            stateTotal += 1;
            stateKnown += isKnown ? 1 : 0;
        }
        const topic = normalizeCategory(question.category);
        const counts = topics.get(topic) ?? { total: 0, known: 0 };
        topics.set(topic, { total: counts.total + 1, known: counts.known + (isKnown ? 1 : 0) });
    }

    let bestTopicRatio = 0;
    for (const counts of topics.values()) {
        bestTopicRatio = Math.max(bestTopicRatio, counts.known / counts.total);
    }
    return { total, answered, known, stateTotal, stateKnown, bestTopicRatio };
}

/**
 * `count` of `total` on the scale of a fixed `target`: equal to `count` when
 * `total` is the usual size, and equal to `target` only once `count` reaches
 * `total`. Keeps the fixed targets right for a learner without a state (300
 * questions) or if the catalogue ever changes size.
 */
function scaled(count: number, total: number, target: number): number {
    if (total <= 0) {
        return 0;
    }
    return count >= total ? target : Math.floor((count * target) / total);
}

function answeredQuestions(ctx: AchievementContext): number {
    return catalogueSummary(ctx.user).answered;
}

function catalogueAnswered(ctx: AchievementContext): number {
    const summary = catalogueSummary(ctx.user);
    return scaled(summary.answered, summary.total, CATALOGUE_TARGET);
}

function catalogueKnown(ctx: AchievementContext): number {
    const summary = catalogueSummary(ctx.user);
    return scaled(summary.known, summary.total, CATALOGUE_TARGET);
}

function stateQuestionsKnown(ctx: AchievementContext): number {
    const summary = catalogueSummary(ctx.user);
    return scaled(summary.stateKnown, summary.stateTotal, STATE_TARGET);
}

/** Best topic as a whole percentage. Only a fully known topic reaches 100, however large it is. */
function bestTopicPercent(ctx: AchievementContext): number {
    const ratio = catalogueSummary(ctx.user).bestTopicRatio;
    return ratio >= 1 ? TOPIC_TARGET : Math.min(TOPIC_TARGET - 1, Math.round(ratio * TOPIC_TARGET));
}

function longestStreak(ctx: AchievementContext): number {
    return Math.max(ctx.streak.best, ctx.streak.current);
}

/** Days up to today on which the answers reached the current daily goal. */
function goalDays(ctx: AchievementContext): number {
    const goal = goalProgress(ctx.user, ctx.today).goal;
    let days = 0;
    for (const activity of activityByDay(ctx.user).values()) {
        if (activity.day <= ctx.today && activity.answered >= goal) {
            days += 1;
        }
    }
    return days;
}

/** Mock exams that were not cancelled, oldest first (testProgress is chronological). */
function finishedMocks(user: User): MockTestProgress[] {
    return (user.testProgress ?? []).filter((test) => Boolean(test) && test.cancelled !== true);
}

function correctAnswers(test: MockTestProgress): number {
    const questions = Array.isArray(test.questions) ? test.questions : [];
    return questions.filter((question) => question?.answeredCorrectly === true).length;
}

function finishedMockCount(ctx: AchievementContext): number {
    return finishedMocks(ctx.user).length;
}

function passedMockCount(ctx: AchievementContext): number {
    return finishedMocks(ctx.user).filter((test) => test.passed === true).length;
}

function bestMockScore(ctx: AchievementContext): number {
    return finishedMocks(ctx.user).reduce((best, test) => Math.max(best, correctAnswers(test)), 0);
}

/** Passed mock exams at the end of the history, up to MOCK_RUN_TARGET. */
function passedMockRun(ctx: AchievementContext): number {
    const mocks = finishedMocks(ctx.user);
    let run = 0;
    for (let i = mocks.length - 1; i >= 0 && run < MOCK_RUN_TARGET && mocks[i].passed === true; i--) {
        run += 1;
    }
    return run;
}

function examReady(ctx: AchievementContext): number {
    return ctx.readiness.status === "ready" ? 1 : 0;
}

function achievement(
    id: string,
    icon: string,
    tier: AchievementTier,
    target: number,
    progress: (ctx: AchievementContext) => number,
): AchievementDef {
    return { id, icon, tier, titleKey: `ach_${id}_title`, descriptionKey: `ach_${id}_desc`, target, progress };
}

/** Every achievement, in display order. */
export const ACHIEVEMENTS: AchievementDef[] = [
    achievement("first_answer", "sparkles", "bronze", 1, answeredQuestions),
    achievement("answers_50", "book", "bronze", 50, answeredQuestions),
    achievement("answers_150", "book", "silver", 150, answeredQuestions),
    achievement("catalogue_complete", "layers", "gold", CATALOGUE_TARGET, catalogueAnswered),
    achievement("all_known", "crown", "gold", CATALOGUE_TARGET, catalogueKnown),
    achievement("streak_3", "flame", "bronze", 3, longestStreak),
    achievement("streak_7", "flame", "silver", 7, longestStreak),
    achievement("streak_30", "flame", "gold", 30, longestStreak),
    achievement("streak_100", "flame", "gold", 100, longestStreak),
    achievement("goal_first", "target", "bronze", 1, goalDays),
    achievement("goal_7", "target", "silver", 7, goalDays),
    achievement("mock_first", "clipboard", "bronze", 1, finishedMockCount),
    achievement("mock_pass", "trophy", "silver", 1, passedMockCount),
    achievement("mock_perfect", "star", "gold", EXAM_QUESTION_COUNT, bestMockScore),
    achievement("mock_three_in_row", "medal", "gold", MOCK_RUN_TARGET, passedMockRun),
    achievement("state_expert", "map-pin", "silver", STATE_TARGET, stateQuestionsKnown),
    achievement("category_master", "award", "silver", TOPIC_TARGET, bestTopicPercent),
    achievement("exam_ready", "shield-check", "gold", 1, examReady),
];

/** The context for `newlyEarned` and `unlockAchievements`: the user's streak on `today` and their readiness. */
export function buildAchievementContext(user: User, today: string): AchievementContext {
    return { user, today, streak: computeStreak(user, today), readiness: computeReadiness(user) };
}

export function isUnlocked(user: User, id: string): boolean {
    return (user.achievements ?? []).some((item) => item?.id === id);
}

/** Ids of achievements whose progress reached the target but that are not unlocked yet, in display order. */
export function newlyEarned(ctx: AchievementContext): string[] {
    const unlocked = new Set((ctx.user.achievements ?? []).map((item) => item?.id));
    return ACHIEVEMENTS.filter((def) => !unlocked.has(def.id) && def.progress(ctx) >= def.target).map((def) => def.id);
}

/**
 * Unlocks every newly earned achievement at `now`. Returns the same user
 * object and no ids when nothing new was earned.
 */
export function unlockAchievements(ctx: AchievementContext, now: Date): { user: User; unlocked: string[] } {
    const unlocked = newlyEarned(ctx);
    if (unlocked.length === 0) {
        return { user: ctx.user, unlocked };
    }
    const unlockedAt = now.toISOString();
    return {
        user: {
            ...ctx.user,
            achievements: [...(ctx.user.achievements ?? []), ...unlocked.map((id) => ({ id, unlockedAt }))],
        },
        unlocked,
    };
}
