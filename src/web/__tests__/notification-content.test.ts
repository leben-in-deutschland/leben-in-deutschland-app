import { describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/data/data";
import type { Question } from "@/types/question";
import type { MockTestProgress, ReviewItem, User, UserDailyProgress, UserPreferences, UserQuestionProgress } from "@/types/user";
import { addDays } from "@/utils/date-utils";
import type { Translations } from "@/utils/i18n";
import {
    dayOfYear,
    encouragementCard,
    examCard,
    germanDate,
    learnerFacts,
    mockCard,
    pickQuestionOfTheDay,
    questionCard,
    questionRoute,
    stableHash,
    streakCard,
    translate,
    weeklyCard,
    type LearnerFacts,
    type QuestionPick,
} from "@/utils/notification-content";
import type { NotificationCard } from "@/utils/notification-planner";
import * as questionBank from "@/utils/question-bank";
import { computeReadiness } from "@/utils/readiness-logic";
import { DEFAULT_PREFERENCES } from "@/utils/user-defaults";

vi.mock("@/utils/question-bank", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/utils/question-bank")>();
    return { ...actual, getRelevantQuestions: vi.fn(actual.getRelevantQuestions) };
});

const { getQuestion, getRelevantQuestions } = questionBank;

/* "Today" is Friday 2026-10-09, day 282 of the year (even). */
const YESTERDAY = "2026-10-08";
const TODAY = "2026-10-09";
const TOMORROW = "2026-10-10";
const SUNDAY = "2026-10-11";

const DE = getTranslations("de");
const EN = getTranslations("en");

/** Generic texts a card falls back to when no fact applies. */
const FALLBACK = { titleKey: "notif_daily_title_0", bodyKey: "notif_daily_body_0" };

/** The Berlin catalogue in catalogue order: 300 general questions, then BE-1 to BE-10. */
const BERLIN = getRelevantQuestions("BE");

function hasImage(question: Question): boolean {
    return Boolean(question.image) && question.image !== "-";
}

/** First catalogue question with/without an image, so tests never hard-code numbers. */
const TEXT_QUESTION = BERLIN.find((question) => !hasImage(question)) as Question;
const IMAGE_QUESTION = BERLIN.find((question) => hasImage(question)) as Question;

function makeUser(overrides: Partial<User> = {}, preferences: Partial<UserPreferences> = {}): User {
    return {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: new Date(2026, 0, 1),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        onboardingCompleted: true,
        preferences: { ...DEFAULT_PREFERENCES, ...preferences },
        ...overrides,
    };
}

function local(day: string, hours = 0): Date {
    const [year, month, date] = day.split("-").map(Number);
    return new Date(year, month - 1, date, hours, 0, 0, 0);
}

function dayEntry(day: string, answered: number): UserDailyProgress {
    return { date: local(day).toDateString(), correct: answered, incorrect: 0, attempted: answered, skipped: 0, flagged: 0, answered };
}

/** Practice on the three days before `today`: a streak of three, today still open. */
function streakBefore(today: string): UserDailyProgress[] {
    return [3, 2, 1].map((back) => dayEntry(addDays(today, -back), 12));
}

function general(count: number, first = 1): string[] {
    return Array.from({ length: count }, (_, i) => String(first + i));
}

function answered(nums: string[], correct: (index: number) => boolean = (i) => i % 2 === 0): UserQuestionProgress[] {
    return nums.map((num, i) => ({ num, answeredCorrectly: correct(i), skipped: false, answerSelected: "a", flagged: false }));
}

function dueItem(num: string, due: string): ReviewItem {
    return { num, box: 1, due, lastReviewed: YESTERDAY };
}

/** A mock exam with `correct` right answers out of 33. */
function mockExam(correct: number, overrides: Partial<MockTestProgress> = {}): MockTestProgress {
    const questions: UserQuestionProgress[] = general(33).map((num, i) => ({
        num,
        answeredCorrectly: i < correct,
        skipped: false,
        answerSelected: "a",
        flagged: false,
    }));
    return { datetime: local(YESTERDAY, 9).toISOString(), timeTake: "900", passed: correct >= 17, cancelled: false, questions, ...overrides };
}

function facts(user: User, today = TODAY): LearnerFacts {
    return learnerFacts(user, today);
}

function pick(user: User, day: string, exclude?: ReadonlySet<string>): QuestionPick {
    const picked = pickQuestionOfTheDay(user, day, exclude);
    expect(picked).not.toBeNull();
    return picked as QuestionPick;
}

/** Every text a card shows. */
function textsOf(card: NotificationCard): string[] {
    return [card.title, card.body, card.largeBody, card.summaryText, ...(card.inboxList ?? [])].filter(
        (value): value is string => typeof value === "string",
    );
}

function expectFilled(card: NotificationCard): void {
    for (const value of textsOf(card)) {
        expect(value, JSON.stringify(card)).not.toContain("{");
        expect(value, JSON.stringify(card)).not.toContain("notif_");
        expect(value.trim().length, JSON.stringify(card)).toBeGreaterThan(0);
    }
}

describe("helpers", () => {
    it("hashes like FNV-1a 32-bit", () => {
        expect(stableHash("")).toBe(0x811c9dc5);
        expect(stableHash("a")).toBe(0xe40c292c);
        expect(stableHash("2026-10-09|BE")).toBe(stableHash("2026-10-09|BE"));
        expect(stableHash("2026-10-09|BE")).not.toBe(stableHash("2026-10-10|BE"));
    });

    it("counts the day of the year, leap years included", () => {
        expect(dayOfYear("2026-01-01")).toBe(1);
        expect(dayOfYear("2026-10-09")).toBe(282);
        expect(dayOfYear("2026-12-31")).toBe(365);
        expect(dayOfYear("2028-12-31")).toBe(366);
    });

    it("writes dates the German way", () => {
        expect(germanDate("2026-11-18")).toBe("18.11.2026");
        expect(germanDate("2027-01-05")).toBe("05.01.2027");
    });

    it("falls back to the key for missing or empty translations", () => {
        expect(translate({ a: "A", b: "" }, "a")).toBe("A");
        expect(translate({ a: "A", b: "" }, "b")).toBe("b");
        expect(translate({}, "c")).toBe("c");
    });
});

describe("pickQuestionOfTheDay", () => {
    const fresh = makeUser();

    it("picks the same question for the same day and catalogue on every run", () => {
        const first = pick(fresh, TODAY);
        for (let run = 0; run < 5; run++) {
            expect(pick(makeUser(), TODAY)).toEqual(first);
        }
    });

    it("does not depend on the app language", () => {
        expect(pick(makeUser({ appLanguage: "de" }), TODAY)).toEqual(pick(makeUser({ appLanguage: "en" }), TODAY));
    });

    it("changes with the day", () => {
        const picks = new Set(Array.from({ length: 10 }, (_, i) => pick(fresh, addDays(TODAY, i)).question.num));
        expect(picks.size).toBeGreaterThan(1);
    });

    it("changes with the catalogue", () => {
        const berlin = Array.from({ length: 10 }, (_, i) => pick(fresh, addDays(TODAY, i)).question.num);
        const bavaria = Array.from({ length: 10 }, (_, i) =>
            pick(makeUser({ state: { stateName: "Bayern", stateCode: "BY" } }), addDays(TODAY, i)).question.num,
        );
        expect(berlin).not.toEqual(bavaria);
    });

    it("asks a new question when the learner has no history", () => {
        const picked = pick(fresh, TODAY);
        expect(picked.mode).toBe("new");
        expect(BERLIN.map((question) => question.num)).toContain(picked.question.num);
    });

    it("prefers due reviews over wrong answers over new questions", () => {
        const wrong = answered(["5", "6"], () => false);
        const withReview = makeUser({ questionProgress: wrong, reviewSchedule: [dueItem(TEXT_QUESTION.num, TODAY)] });
        expect(pick(withReview, TODAY)).toEqual({ question: TEXT_QUESTION, mode: "review" });

        const withMistakes = makeUser({ questionProgress: wrong });
        const picked = pick(withMistakes, TODAY);
        expect(picked.mode).toBe("incorrect");
        expect(["5", "6"]).toContain(picked.question.num);

        const withKnown = makeUser({ questionProgress: answered(["5", "6"], () => true) });
        const fromNew = pick(withKnown, TODAY);
        expect(fromNew.mode).toBe("new");
        expect(["5", "6"]).not.toContain(fromNew.question.num);
    });

    it("ignores a review that is not due yet", () => {
        const user = makeUser({ reviewSchedule: [dueItem(TEXT_QUESTION.num, TOMORROW)] });
        expect(pick(user, TODAY).mode).toBe("new");
        expect(pick(user, TOMORROW)).toEqual({ question: TEXT_QUESTION, mode: "review" });
    });

    it("falls back to the whole catalogue once everything is answered correctly", () => {
        const allKnown = makeUser({ questionProgress: answered(BERLIN.map((question) => question.num), () => true) });
        const picked = pick(allKnown, TODAY);
        expect(picked.mode).toBe("quick");
        expect(BERLIN).toContainEqual(picked.question);
    });

    it("never picks a question with an image", () => {
        for (let i = 0; i < 40; i++) {
            expect(hasImage(pick(fresh, addDays(TODAY, i)).question)).toBe(false);
        }
        // The only wrong answer is an image question: the card moves on to a new question.
        const onlyImageWrong = makeUser({ questionProgress: answered([IMAGE_QUESTION.num], () => false) });
        const picked = pick(onlyImageWrong, TODAY);
        expect(picked.mode).toBe("new");
        expect(picked.question.num).not.toBe(IMAGE_QUESTION.num);
        // Same for a due review of an image question.
        const onlyImageDue = makeUser({ reviewSchedule: [dueItem(IMAGE_QUESTION.num, TODAY)] });
        expect(pick(onlyImageDue, TODAY).mode).toBe("new");
    });

    it("skips excluded questions and moves on to the next pool when a pool is used up", () => {
        const first = pick(fresh, TODAY);
        const second = pick(fresh, TODAY, new Set([first.question.num]));
        expect(second.question.num).not.toBe(first.question.num);
        expect(second.mode).toBe("new");

        const user = makeUser({ questionProgress: answered(["5"], () => false) });
        expect(pick(user, TODAY)).toEqual({ question: getQuestion("5"), mode: "incorrect" });
        const next = pick(user, TODAY, new Set(["5"]));
        expect(next.mode).toBe("new");
        expect(next.question.num).not.toBe("5");
    });

    it("returns null when nothing is left to pick", () => {
        expect(pickQuestionOfTheDay(fresh, TODAY, new Set(BERLIN.map((question) => question.num)))).toBeNull();
    });

    it("returns null for an empty catalogue", () => {
        vi.mocked(getRelevantQuestions).mockReturnValueOnce([]);
        expect(pickQuestionOfTheDay(fresh, TODAY)).toBeNull();
    });

    it("works for a learner without a state", () => {
        const stateless = makeUser({ state: { stateName: "", stateCode: "" } });
        const picked = pick(stateless, TODAY);
        expect(/^\d+$/.test(picked.question.num)).toBe(true);
    });
});

describe("questionCard", () => {
    const question = getQuestion("1") as Question;
    const picked: QuestionPick = { question, mode: "new" };

    it("asks the German question with a translated frame", () => {
        const de = questionCard(picked, DE, "daily");
        expect(de.title).toBe("Frage des Tages: Geschichte & Geographie");
        expect(de.body).toBe(question.question);
        expect(de.summaryText).toBe("Nr. 1 · Geschichte & Geographie");
        expect(de.actionTypeId).toBe("question");
        expect(de.questionNum).toBe("1");
        expect(de.route).toBe("/prepare?action=new&start=1");

        const en = questionCard(picked, EN, "daily");
        expect(en.title).toBe("Question of the day: History & Geography");
        expect(en.body).toBe(question.question);
        expect(en.summaryText).toBe("No. 1 · History & Geography");
        expect(en.route).toBe(de.route);
    });

    it("lists all four options and the hint in the expanded text", () => {
        const card = questionCard(picked, DE, "daily");
        expect(card.largeBody).toBe(
            `${question.question}\n\nA ${question.a}\nB ${question.b}\nC ${question.c}\nD ${question.d}\n\nTippen und antworten`,
        );
        expect(questionCard(picked, EN, "daily").largeBody?.endsWith("\n\nTap to answer")).toBe(true);
    });

    it("has a come-back title and a test prefix", () => {
        const comeback = questionCard(picked, DE, "comeback");
        expect(comeback.title).toBe("Weißt du es noch?");
        expect(comeback.summaryText).toBe("Nr. 1 · Geschichte & Geographie");
        expect(questionCard(picked, EN, "comeback").title).toBe("Do you still know this one?");

        const test = questionCard(picked, DE, "test");
        expect(test.title).toBe("Frage des Tages: Geschichte & Geographie");
        expect(test.summaryText).toBe("Test · Nr. 1 · Geschichte & Geographie");
        expect(test.route).toBe("/prepare?action=new&start=1");
    });

    it("routes to the practice mode the question came from and escapes the number", () => {
        const stateQuestion = getQuestion("BE-3") as Question;
        expect(questionRoute({ question: stateQuestion, mode: "review" })).toBe("/prepare?action=review&start=BE-3");
        expect(questionRoute({ question, mode: "incorrect" })).toBe("/prepare?action=incorrect&start=1");
        expect(questionRoute({ question, mode: "quick" })).toBe("/prepare?action=quick&start=1");
        expect(questionRoute({ question: { ...question, num: "a b&c" }, mode: "new" })).toBe("/prepare?action=new&start=a%20b%26c");
    });

    it("falls back to the keys without translations", () => {
        const card = questionCard(picked, {}, "test");
        expect(card.title).toBe("notif_question_title");
        expect(card.summaryText).toBe("notif_test_prefixnotif_question_summary");
        expect(card.body).toBe(question.question);
    });
});

describe("encouragementCard", () => {
    it("uses the generic fallback texts for a fresh learner", () => {
        const card = encouragementCard(facts(makeUser()), DE, TODAY, FALLBACK);
        expect(card).toEqual({
            title: DE.notif_daily_title_0,
            body: DE.notif_daily_body_0,
            route: "/practice",
            actionTypeId: "practice",
        });
    });

    it("mentions the streak and today's goal only on a card for today", () => {
        const user = makeUser({ dailyProgress: [...streakBefore(TODAY), dayEntry(TODAY, 3)] });
        // Eligible today: streak (4 days, today counts under the activity rule) and goal (3 of 10 answered).
        // Day 282 % 2 = 0 picks the streak.
        const today = encouragementCard(facts(user), DE, TODAY, FALLBACK);
        expect(today.title).toBe("4 Tage am Stück");
        expect(today.body).toBe("Mach heute weiter, damit die Serie hält.");
        // The same learner on tomorrow's card: no durable fact, so the fallback.
        const tomorrow = encouragementCard(facts(user), DE, TOMORROW, FALLBACK);
        expect(tomorrow.title).toBe(DE.notif_daily_title_0);
        // On an odd day of the year (Saturday is day 283) the rotation picks the goal.
        const saturday = makeUser({ dailyProgress: [...streakBefore(TOMORROW), dayEntry(TOMORROW, 3)] });
        expect(encouragementCard(facts(saturday, TOMORROW), DE, TOMORROW, FALLBACK).title).toBe("Noch 7 Fragen bis zum Tagesziel");
    });

    it("counts the questions left to today's goal once the learner has started", () => {
        const started = makeUser({ dailyProgress: [dayEntry(TODAY, 9)] }, { dailyGoal: 10 });
        const card = encouragementCard(facts(started), DE, TODAY, FALLBACK);
        expect(card.title).toBe("Noch 1 Frage bis zum Tagesziel");
        expect(card.body).toBe("Du hast heute schon angefangen. Mach den Tag voll.");
        expect(encouragementCard(facts(makeUser({ dailyProgress: [dayEntry(TODAY, 4)] })), EN, TODAY, FALLBACK).title).toBe(
            "6 questions to go for today's goal",
        );
        // Not started today: no goal fact.
        expect(encouragementCard(facts(makeUser()), DE, TODAY, FALLBACK).title).toBe(DE.notif_daily_title_0);
    });

    it("rotates through the applicable facts so consecutive days differ", () => {
        // Durable facts: readiness (40 answered) and known questions (20).
        const user = makeUser({ questionProgress: answered(general(40)) });
        const titles = [0, 1, 2, 3].map((offset) => encouragementCard(facts(user), DE, addDays(TOMORROW, offset), FALLBACK).title);
        expect(titles[0]).not.toBe(titles[1]);
        expect(titles[2]).toBe(titles[0]);
        expect(titles[3]).toBe(titles[1]);
        const score = computeReadiness(user).score;
        expect(new Set(titles)).toEqual(new Set([`${score} % Prüfungsreife`, "20 von 310 Fragen sitzen schon"]));
    });

    it("adds a readiness status line", () => {
        const user = makeUser({ questionProgress: answered(general(40)) });
        const readiness = computeReadiness(user);
        expect(readiness.status).toBe("start");
        const cards = [0, 1].map((offset) => encouragementCard(facts(user), EN, addDays(TOMORROW, offset), FALLBACK));
        const readinessCard = cards.find((card) => card.title === `${readiness.score}% exam readiness`);
        expect(readinessCard?.body).toBe("Every question gets you further. Keep going.");
    });

    it("counts due reviews with the right plural", () => {
        const one = makeUser({ reviewSchedule: [dueItem("1", TODAY)] });
        expect(encouragementCard(facts(one), DE, TODAY, FALLBACK).title).toBe("1 Frage wartet auf Wiederholung");
        expect(encouragementCard(facts(one), EN, TODAY, FALLBACK).title).toBe("1 question is due for review");
        const three = makeUser({ reviewSchedule: [dueItem("1", TODAY), dueItem("2", YESTERDAY), dueItem("3", TODAY)] });
        const card = encouragementCard(facts(three), DE, TODAY, FALLBACK);
        expect(card.title).toBe("3 Fragen warten auf Wiederholung");
        expect(card.body).toBe("Kurz wiederholen, dann bleibt es hängen.");
        // Due on a later day: the review of "4" is only due tomorrow.
        const later = makeUser({ reviewSchedule: [dueItem("4", TOMORROW)] });
        expect(encouragementCard(facts(later), DE, TODAY, FALLBACK).title).toBe(DE.notif_daily_title_0);
        expect(encouragementCard(facts(later), DE, TOMORROW, FALLBACK).title).toBe("1 Frage wartet auf Wiederholung");
    });

    it("reports the last mock exam that was not cancelled", () => {
        const passed = makeUser({ testProgress: [mockExam(10), mockExam(25)] });
        const card = encouragementCard(facts(passed), DE, TODAY, FALLBACK);
        expect(card.title).toBe("25 von 33 in der letzten Probeprüfung");
        expect(card.body).toBe("Bestanden! Bleib dran, damit es so bleibt.");

        const failed = makeUser({ testProgress: [mockExam(25), mockExam(12), mockExam(30, { cancelled: true })] });
        const failedCard = encouragementCard(facts(failed), EN, TODAY, FALLBACK);
        expect(failedCard.title).toBe("12 of 33 in your last mock exam");
        expect(failedCard.body).toBe("Not passed yet. Practise your mistakes and it will click.");

        const onlyCancelled = makeUser({ testProgress: [mockExam(30, { cancelled: true })] });
        expect(encouragementCard(facts(onlyCancelled), DE, TODAY, FALLBACK).title).toBe(DE.notif_daily_title_0);
    });

    it("addresses the learner by name when a nickname is set", () => {
        const known = answered(["1"], () => true);
        const named = encouragementCard(facts(makeUser({ questionProgress: known, nickname: " Mia " })), DE, TODAY, FALLBACK);
        expect(named.title).toBe("1 von 310 Fragen sitzen schon");
        expect(named.body).toBe("Stark, Mia! Jede weitere Frage macht die Prüfung leichter.");
        expect(encouragementCard(facts(makeUser({ questionProgress: known, nickname: "Mia" })), EN, TODAY, FALLBACK).body).toBe(
            "Nice work, Mia! Every extra question makes the exam easier.",
        );
        const anonymous = encouragementCard(facts(makeUser({ questionProgress: known, nickname: "  " })), DE, TODAY, FALLBACK);
        expect(anonymous.body).toBe("Jede weitere Frage macht die Prüfung leichter.");
    });

    it("adds the exam countdown as summary while the exam is ahead", () => {
        const user = makeUser({ examDate: addDays(TODAY, 12) });
        expect(encouragementCard(facts(user), DE, TODAY, FALLBACK).summaryText).toBe("Noch 12 Tage bis zur Prüfung");
        expect(encouragementCard(facts(user), EN, addDays(TODAY, 11), FALLBACK).summaryText).toBe("1 day until your exam");
        expect(encouragementCard(facts(user), DE, addDays(TODAY, 12), FALLBACK).summaryText).toBeUndefined();
        expect(encouragementCard(facts(user), DE, addDays(TODAY, 13), FALLBACK).summaryText).toBeUndefined();
        expect(encouragementCard(facts(makeUser({ examDate: "not a day" })), DE, TODAY, FALLBACK).summaryText).toBeUndefined();
    });

    it("falls back to the given keys when no translation exists", () => {
        const card = encouragementCard(facts(makeUser()), {}, TODAY, { titleKey: "x_title", bodyKey: "x_body" });
        expect(card.title).toBe("x_title");
        expect(card.body).toBe("x_body");
    });
});

describe("streakCard", () => {
    const running = streakBefore(TODAY);

    it("names the streak and the answers that make today count", () => {
        const card = streakCard(facts(makeUser({ dailyProgress: running })), DE, 0);
        expect(card).toEqual({
            title: "3-Tage-Serie in Gefahr",
            body: "Noch 1 Frage, dann zählt der Tag.",
            route: "/practice",
            actionTypeId: "practice",
        });
        expect(streakCard(facts(makeUser({ dailyProgress: running })), EN, 0).title).toBe("3-day streak at risk");
    });

    it("counts to the daily goal under the goal rule", () => {
        const user = makeUser({ dailyProgress: [...running, dayEntry(TODAY, 3)] }, { streakRule: "goal", dailyGoal: 10 });
        const card = streakCard(facts(user), DE, 0);
        expect(card.title).toBe("3-Tage-Serie in Gefahr");
        expect(card.body).toBe("Noch 7 Fragen, dann zählt der Tag.");
        expect(streakCard(facts(user), EN, 0).body).toBe("7 more questions and today counts.");
    });

    it("keeps the generic title for a one-day streak", () => {
        const card = streakCard(facts(makeUser({ dailyProgress: [dayEntry(YESTERDAY, 5)] })), DE, 0);
        expect(card.title).toBe(DE.notif_streak_title);
        expect(card.body).toBe("Noch 1 Frage, dann zählt der Tag.");
    });

    it("shows the best streak when it is longer than the current one", () => {
        const best = { best: 9, freezes: 0, frozenDays: [], freezeEarnedDays: [] };
        expect(streakCard(facts(makeUser({ dailyProgress: running, streak: best })), DE, 0).summaryText).toBe("Beste Serie: 9 Tage");
        expect(streakCard(facts(makeUser({ dailyProgress: running, streak: best })), EN, 0).summaryText).toBe("Best streak: 9 days");
        expect(streakCard(facts(makeUser({ dailyProgress: running, streak: { ...best, best: 3 } })), DE, 0).summaryText).toBeUndefined();
    });

    it("stays generic for tomorrow", () => {
        const card = streakCard(facts(makeUser({ dailyProgress: running, nickname: "Mia" })), DE, 1);
        expect(card).toEqual({
            title: DE.notif_streak_title,
            body: DE.notif_streak_body,
            route: "/practice",
            actionTypeId: "practice",
        });
    });
});

describe("weeklyCard", () => {
    it("lists the learner's numbers for that Sunday", () => {
        const user = makeUser({
            questionProgress: answered(general(40)),
            reviewSchedule: [dueItem("1", SUNDAY), dueItem("2", addDays(SUNDAY, 1))],
            examDate: addDays(SUNDAY, 20),
        });
        const score = computeReadiness(user).score;
        const card = weeklyCard(facts(user), DE, SUNDAY);
        expect(card.title).toBe(DE.notif_weekly_title);
        expect(card.body).toBe(DE.notif_weekly_body);
        expect(card.route).toBe("/progress");
        expect(card.actionTypeId).toBe("progress");
        expect(card.largeBody).toBeUndefined();
        expect(card.inboxList).toEqual([
            "20 von 310 Fragen sitzen",
            `${score} % Prüfungsreife`,
            "1 Frage wartet auf Wiederholung",
            "Noch 20 Tage bis zur Prüfung",
        ]);
        expect(weeklyCard(facts(user), EN, SUNDAY).inboxList).toEqual([
            "20 of 310 questions stick",
            `${score}% exam readiness`,
            "1 question is due for review",
            "20 days until your exam",
        ]);
    });

    it("leaves out lines that do not apply, and the list when none applies", () => {
        const fresh = weeklyCard(facts(makeUser()), DE, SUNDAY);
        expect(fresh.inboxList).toBeUndefined();
        expect(fresh.actionTypeId).toBe("progress");

        const few = weeklyCard(facts(makeUser({ questionProgress: answered(["1", "2"], () => true) })), DE, SUNDAY);
        expect(few.inboxList).toEqual(["2 von 310 Fragen sitzen"]);

        const examPassed = weeklyCard(facts(makeUser({ examDate: SUNDAY, reviewSchedule: [dueItem("1", TODAY)] })), DE, SUNDAY);
        expect(examPassed.inboxList).toEqual(["1 Frage wartet auf Wiederholung"]);
    });
});

describe("examCard", () => {
    const examDate = "2026-11-18";

    it("keeps the countdown texts and adds the exam date", () => {
        for (const days of [30, 14, 7, 3, 1, 0]) {
            const card = examCard(facts(makeUser({ examDate })), DE, examDate, days);
            expect(card.title).toBe(DE[`notif_exam_${days}_title`]);
            expect(card.body).toBe(DE[`notif_exam_${days}_body`]);
            expect(card.summaryText).toBe("Prüfung am 18.11.2026");
            expect(card.route).toBe(days === 0 ? "/dashboard" : "/mock");
            expect(card.actionTypeId).toBe(days === 0 ? undefined : "mock");
            expect(card.largeBody).toBeUndefined();
        }
        expect(examCard(facts(makeUser({ examDate })), EN, examDate, 7).summaryText).toBe("Exam on 18.11.2026");
    });

    it("expands with readiness and the last mock exam", () => {
        const user = makeUser({ examDate, questionProgress: answered(general(40)), testProgress: [mockExam(21)] });
        const score = computeReadiness(user).score;
        const card = examCard(facts(user), DE, examDate, 7);
        expect(card.largeBody).toBe(`${DE.notif_exam_7_body}\n\n${score} % Prüfungsreife\n21 von 33 in der letzten Probeprüfung`);
        const mockOnly = examCard(facts(makeUser({ examDate, testProgress: [mockExam(21)] })), EN, examDate, 0);
        expect(mockOnly.largeBody).toBe(`${EN.notif_exam_0_body}\n\n21 of 33 in your last mock exam`);
    });
});

describe("mockCard", () => {
    it("keeps the nudge texts and expands with the learner's numbers", () => {
        const user = makeUser({ questionProgress: answered(general(40)) });
        const score = computeReadiness(user).score;
        const card = mockCard(facts(user), DE);
        expect(card).toEqual({
            title: DE.notif_mock_title,
            body: DE.notif_mock_body,
            route: "/mock",
            actionTypeId: "mock",
            largeBody: `${DE.notif_mock_body}\n\n20 von 310 Fragen sitzen\n${score} % Prüfungsreife`,
        });
    });

    it("has no expanded text without numbers", () => {
        expect(mockCard(facts(makeUser()), DE).largeBody).toBeUndefined();
    });
});

describe("every text", () => {
    const learners: [string, User][] = [
        ["fresh", makeUser()],
        ["named with everything", makeUser({
            nickname: "Mia",
            dailyProgress: [...streakBefore(TODAY), dayEntry(TODAY, 2)],
            questionProgress: answered(general(60)),
            reviewSchedule: [dueItem("1", TODAY), dueItem("2", TODAY)],
            testProgress: [mockExam(20)],
            examDate: addDays(TODAY, 25),
            streak: { best: 12, freezes: 1, frozenDays: [], freezeEarnedDays: [] },
        })],
        ["goal rule, failed mock", makeUser(
            { dailyProgress: [dayEntry(YESTERDAY, 10), dayEntry(TODAY, 4)], questionProgress: answered(general(12)), testProgress: [mockExam(9)] },
            { streakRule: "goal", dailyGoal: 10 },
        )],
    ];

    it.each(learners)("is filled in for a %s learner in both languages", (_, user) => {
        for (const t of [DE, EN] as Translations[]) {
            const f = facts(user);
            const asked = new Set<string>();
            for (let offset = 0; offset < 8; offset++) {
                const day = addDays(TODAY, offset);
                const picked = pickQuestionOfTheDay(user, day, asked);
                if (picked) {
                    asked.add(picked.question.num);
                    expectFilled(questionCard(picked, t, "daily"));
                    expectFilled(questionCard(picked, t, "comeback"));
                    expectFilled(questionCard(picked, t, "test"));
                }
                expectFilled(encouragementCard(f, t, day, FALLBACK));
                expectFilled(weeklyCard(f, t, day));
            }
            expectFilled(streakCard(f, t, 0));
            expectFilled(streakCard(f, t, 1));
            expectFilled(mockCard(f, t));
            for (const days of [30, 14, 7, 3, 1, 0]) {
                expectFilled(examCard(f, t, "2026-11-18", days));
            }
        }
    });

    it("keeps titles and bodies short", () => {
        for (const [, user] of learners) {
            for (const t of [DE, EN]) {
                for (let offset = 0; offset < 8; offset++) {
                    const card = encouragementCard(facts(user), t, addDays(TODAY, offset), FALLBACK);
                    expect(card.title.length, card.title).toBeLessThanOrEqual(45);
                    expect(card.body.length, card.body).toBeLessThanOrEqual(90);
                }
                const streak = streakCard(facts(user), t, 0);
                expect(streak.title.length, streak.title).toBeLessThanOrEqual(45);
                expect(streak.body.length, streak.body).toBeLessThanOrEqual(90);
            }
        }
    });
});
