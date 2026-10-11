// A plausible synthetic learner for store screenshots and videos. Nothing in
// here is a real person; the record is generated relative to the capture day
// so streaks, due reviews, and the exam countdown always look current.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../web");
const questionFile = path.join(webRoot, "data/questions-core.json");

export const APP_VERSION = JSON.parse(readFileSync(path.join(webRoot, "package.json"), "utf8")).version;

const STATE = { stateName: "Berlin", stateCode: "BE" };
const LETTERS = ["a", "b", "c", "d"];
const EXAM_PASS_MARK = 17;

/** Deterministic PRNG so every run produces the same record. */
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(items, random) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function dayKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Local date `offset` days from `today` at the given hour. */
function at(today, offset, hour = 19, minute = 15) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, hour, minute, 0, 0);
}

function loadCatalogue() {
    const raw = JSON.parse(readFileSync(questionFile, "utf8"));
    const list = Array.isArray(raw) ? raw : (raw.questions ?? Object.values(raw));
    const general = list.filter((q) => /^\d+$/.test(q.num)).sort((a, b) => Number(a.num) - Number(b.num));
    const state = list.filter((q) => q.num.startsWith(`${STATE.stateCode}-`));
    return { general, state };
}

function wrongLetter(solution, random) {
    const options = LETTERS.filter((letter) => letter !== solution);
    return options[Math.floor(random() * options.length)];
}

/**
 * Builds the demo record.
 * @param {{ language: "de" | "en", today?: Date, translationLanguage?: string }} options
 */
export function buildDemoUser({ language, today = new Date(), translationLanguage = "en" }) {
    const random = mulberry32(20261011);
    const { general, state } = loadCatalogue();

    // Unanswered questions: the two showcase questions come first in "new"
    // mode (catalogue order), the last question of every topic stays open so
    // no topic is fully mastered yet (that would unlock an achievement at
    // capture time), the rest is drawn from later questions.
    const SHOWCASE = ["73", "74"];
    const lastByCategory = new Map();
    for (const q of general) {
        lastByCategory.set(q.category, q.num);
    }
    const unanswered = new Set([...SHOWCASE, ...lastByCategory.values()]);
    const later = shuffle(general.filter((q) => Number(q.num) > 74 && !unanswered.has(q.num)), random);
    for (const q of later) {
        if (unanswered.size >= 46) {
            break;
        }
        unanswered.add(q.num);
    }
    const generalPool = shuffle(general.filter((q) => !unanswered.has(q.num)), random);
    const knownGeneral = generalPool.slice(0, 213);
    const wrongGeneral = generalPool.slice(213);
    const statePool = shuffle(state, random);
    const knownState = statePool.slice(0, 7);
    const wrongState = statePool.slice(7, 9);

    const flaggedNums = new Set(shuffle([...wrongGeneral, ...knownGeneral.slice(0, 20)], random).slice(0, 6).map((q) => q.num));
    const questionProgress = [];
    for (const q of [...knownGeneral, ...knownState]) {
        questionProgress.push({ num: q.num, answeredCorrectly: true, skipped: false, answerSelected: q.solution, flagged: flaggedNums.has(q.num) });
    }
    for (const q of [...wrongGeneral, ...wrongState]) {
        questionProgress.push({ num: q.num, answeredCorrectly: false, skipped: false, answerSelected: wrongLetter(q.solution, random), flagged: flaggedNums.has(q.num) });
    }
    const orderedProgress = shuffle(questionProgress, random);

    // Activity: an earlier 16-day run, a gap, then the current 12-day streak
    // that ends today with 7 of 10 answers done.
    const dailyProgress = [];
    const pushDay = (offset, answered, correctShare) => {
        const correct = Math.round(answered * correctShare);
        const hour = offset === 0 ? Math.max(7, today.getHours() - 1) : 19;
        dailyProgress.push({
            date: at(today, offset, hour, 12).toISOString(),
            correct,
            incorrect: answered - correct,
            attempted: answered,
            skipped: Math.floor(random() * 2),
            flagged: Math.floor(random() * 2),
            answered,
        });
    };
    for (let offset = -34; offset <= -19; offset++) {
        pushDay(offset, 10 + Math.floor(random() * 12), 0.55 + random() * 0.2);
    }
    for (let offset = -11; offset <= -1; offset++) {
        pushDay(offset, 12 + Math.floor(random() * 14), 0.65 + random() * 0.25);
    }
    pushDay(0, 7, 0.72);

    // Three finished mock exams, improving: 18, 25, 29 of 33.
    const examQuestions = (correctCount) => {
        const picked = [...shuffle(general, random).slice(0, 30), ...shuffle(state, random).slice(0, 3)];
        return picked.map((q, index) => {
            const right = index < correctCount;
            return { num: q.num, answeredCorrectly: right, skipped: false, answerSelected: right ? q.solution : wrongLetter(q.solution, random), flagged: false };
        });
    };
    const mock = (offset, correctCount, seconds) => ({
        datetime: at(today, offset, 20, 5).toISOString(),
        timeTake: String(seconds),
        passed: correctCount >= EXAM_PASS_MARK,
        cancelled: false,
        questions: examQuestions(correctCount),
        passMark: EXAM_PASS_MARK,
        examType: "einbuergerung",
        timed: true,
    });
    const testProgress = [mock(-24, 18, 1740), mock(-9, 25, 1530), mock(-2, 29, 1385)];

    // Leitner schedule: wrong answers sit in box 1, 14 of them due today; known
    // questions spread over boxes 2-5 with later due dates.
    const reviewSchedule = [];
    [...wrongGeneral, ...wrongState].forEach((q, index) => {
        reviewSchedule.push({ num: q.num, box: 1, due: dayKey(at(today, index < 14 ? 0 : 1 + (index % 3))), lastReviewed: dayKey(at(today, -1 - Math.floor(random() * 4))) });
    });
    const spans = [0, 0, 2, 5, 10, 21];
    for (const q of [...knownGeneral, ...knownState]) {
        const box = 2 + Math.floor(random() * 4);
        const lastOffset = -Math.floor(random() * 11);
        reviewSchedule.push({ num: q.num, box, due: dayKey(at(today, lastOffset + spans[box])), lastReviewed: dayKey(at(today, lastOffset)) });
    }

    const unlocked = (id, offset) => ({ id, unlockedAt: at(today, offset, 19, 40).toISOString() });
    const achievements = [
        unlocked("first_answer", -34),
        unlocked("goal_first", -34),
        unlocked("streak_3", -32),
        unlocked("answers_50", -31),
        unlocked("streak_7", -28),
        unlocked("goal_7", -27),
        unlocked("mock_first", -24),
        unlocked("mock_pass", -24),
        unlocked("answers_150", -22),
    ];

    const inboxItem = (id, type, titleKey, bodyKey, offset, route, params) => ({
        id,
        type,
        titleKey,
        bodyKey,
        ...(params ? { params } : {}),
        createdAt: at(today, offset, 20, 10).toISOString(),
        read: true,
        route,
    });
    const inbox = [
        inboxItem("welcome", "welcome", "inbox_welcome_title", "inbox_welcome_body", -34, "/practice"),
        inboxItem("streak-7", "streak", "inbox_streak_title", "inbox_streak_body", -28, "/progress", { days: 7 }),
        inboxItem(`goal-${dayKey(at(today, -1))}`, "goal", "inbox_goal_title", "inbox_goal_body", -1, "/progress", { count: 10 }),
    ];

    return {
        id: "demo-learner",
        schemaVersion: 2,
        state: STATE,
        dailyProgress,
        questionProgress: orderedProgress,
        testProgress,
        appLanguage: language,
        appFirstTimeOpenDateTime: at(today, -36, 18, 2).toISOString(),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: true,
        preferences: {
            dailyGoal: 10,
            streakRule: "activity",
            restDays: [],
            examType: "einbuergerung",
            mockTimer: true,
            confirmAnswers: false,
            autoAdvance: false,
            haptics: true,
            largeText: false,
            translationLanguage,
            sessionSize: 20,
            notificationsEnabled: true,
            reminders: { daily: true, dailyTime: "19:00", streak: true, streakTime: "20:30", weekly: true, examCountdown: true, mockNudge: true, comeback: true },
            tips: true,
        },
        streak: { best: 16, freezes: 1, frozenDays: [], freezeEarnedDays: [dayKey(at(today, -5))] },
        reviewSchedule,
        achievements,
        inbox,
        examDate: dayKey(at(today, 21)),
        nickname: "Amina",
        onboardingCompleted: true,
        lastSeenEvaluationDate: dayKey(today),
        lastOpenedAt: today.toISOString(),
    };
}

/**
 * Browser `localStorage` seed for a capture: record, language, theme, fresh
 * remote caches (no network), the modern design (an existing record without
 * `lid:ui-mode` would open the classic design with the "new design" prompt),
 * and a used-up thank-you ask so the tip dialog never covers a shot.
 */
export function buildStorageSeed({ language, theme = "dark", today = new Date(), translationLanguage }) {
    const user = buildDemoUser({ language, today, translationLanguage });
    const stamp = today.toISOString();
    const cache = (extra = {}) => JSON.stringify({ data: null, fetchedAt: stamp, attemptedAt: stamp, etag: null, appVersion: APP_VERSION, ...extra });
    return {
        user: JSON.stringify(user),
        "app-language": language,
        theme,
        "lid:ui-mode": "modern",
        "lid:support-ask": JSON.stringify({ asks: 2, lastAskAt: stamp }),
        "lid:notices": cache(),
        "lid:questions": cache(),
        "lid:evaluation": cache(),
    };
}
