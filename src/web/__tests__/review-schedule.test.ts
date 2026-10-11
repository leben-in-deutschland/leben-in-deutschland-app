import { describe, it, expect } from "vitest";
import {
    MAX_BOX,
    REVIEW_INTERVALS,
    dueCount,
    dueItems,
    getReviewItem,
    masteryLevel,
    scheduleAnswer,
    type MasteryLevel,
} from "@/utils/review-schedule";
import type { ReviewItem, User } from "@/types/user";

const TODAY = "2026-10-09";
const YESTERDAY = "2026-10-08";
const TOMORROW = "2026-10-10";
const EARLIER = "2026-10-01";

function item(num: string, box: number, due: string, lastReviewed = EARLIER): ReviewItem {
    return { num, box, due, lastReviewed };
}

/** Frozen copy of a schedule: any attempt to change it throws. */
function frozen(items: ReviewItem[]): ReviewItem[] {
    return Object.freeze(items.map((entry) => Object.freeze({ ...entry }))) as ReviewItem[];
}

/** A record written before version 2.1: it has no `reviewSchedule` field. */
function makeLegacyUser(): User {
    return {
        id: "legacy-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [{ date: "Thu Oct 08 2026", correct: 1, incorrect: 0, attempted: 1, skipped: 0, flagged: 0 }],
        questionProgress: [{ num: "1", answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false }],
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: new Date(2026, 0, 1),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
    };
}

/** The learner's catalogue for Berlin: general questions plus "BE-" questions. */
function isBerlinQuestion(num: string): boolean {
    return /^\d+$/.test(num) || num.startsWith("BE-");
}

function nums(items: ReviewItem[]): string[] {
    return items.map((entry) => entry.num);
}

describe("constants", () => {
    it("uses review intervals of 1, 2, 4, 8, and 16 days", () => {
        expect(REVIEW_INTERVALS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 });
        expect(MAX_BOX).toBe(5);
    });

    it("has a growing interval for every box up to MAX_BOX", () => {
        for (let box = 1; box <= MAX_BOX; box++) {
            expect(REVIEW_INTERVALS[box]).toBeGreaterThan(box > 1 ? REVIEW_INTERVALS[box - 1] : 0);
        }
    });
});

describe("scheduleAnswer: new questions", () => {
    it("puts a first correct answer in box 2, due in two days", () => {
        expect(scheduleAnswer([], "42", true, TODAY)).toEqual([
            { num: "42", box: 2, due: "2026-10-11", lastReviewed: TODAY },
        ]);
    });

    it("puts a first wrong answer in box 1, due today", () => {
        expect(scheduleAnswer([], "42", false, TODAY)).toEqual([{ num: "42", box: 1, due: TODAY, lastReviewed: TODAY }]);
    });

    it("starts a schedule for older records without reviewSchedule", () => {
        const user = makeLegacyUser();
        const schedule = scheduleAnswer(user.reviewSchedule, "1", true, TODAY);

        expect(schedule).toEqual([{ num: "1", box: 2, due: "2026-10-11", lastReviewed: TODAY }]);
        expect(user.reviewSchedule).toBeUndefined();
    });

    it("appends a new question after the existing ones and keeps their identity", () => {
        const schedule = frozen([item("1", 3, TOMORROW), item("BE-2", 1, TODAY)]);
        const result = scheduleAnswer(schedule, "7", false, TODAY);

        expect(nums(result)).toEqual(["1", "BE-2", "7"]);
        expect(result[0]).toBe(schedule[0]);
        expect(result[1]).toBe(schedule[1]);
        expect(result[2]).toEqual({ num: "7", box: 1, due: TODAY, lastReviewed: TODAY });
    });

    it("returns a new array even for an empty schedule", () => {
        const schedule: ReviewItem[] = [];
        const result = scheduleAnswer(schedule, "1", true, TODAY);

        expect(result).not.toBe(schedule);
        expect(schedule).toEqual([]);
    });
});

describe("scheduleAnswer: existing questions", () => {
    it.each<[number, number, string]>([
        [1, 2, "2026-10-11"],
        [2, 3, "2026-10-13"],
        [3, 4, "2026-10-17"],
        [4, 5, "2026-10-25"],
    ])("promotes box %i to box %i when the question is due today", (box, nextBox, due) => {
        const result = scheduleAnswer([item("5", box, TODAY)], "5", true, TODAY);

        expect(result).toEqual([{ num: "5", box: nextBox, due, lastReviewed: TODAY }]);
    });

    it("promotes an overdue question and counts the next interval from today", () => {
        const result = scheduleAnswer([item("5", 2, "2026-09-01")], "5", true, TODAY);

        expect(result).toEqual([{ num: "5", box: 3, due: "2026-10-13", lastReviewed: TODAY }]);
    });

    it("keeps a mastered question in the last box and schedules it 16 days out", () => {
        const result = scheduleAnswer([item("5", MAX_BOX, YESTERDAY)], "5", true, TODAY);

        expect(result).toEqual([{ num: "5", box: MAX_BOX, due: "2026-10-25", lastReviewed: TODAY }]);
    });

    it("does not promote a correct answer before the due day", () => {
        const result = scheduleAnswer([item("5", 3, TOMORROW)], "5", true, TODAY);

        expect(result).toEqual([{ num: "5", box: 3, due: TOMORROW, lastReviewed: TODAY }]);
    });

    it("does not promote a question answered again and again on the same day", () => {
        let schedule = scheduleAnswer(undefined, "9", true, TODAY);
        schedule = scheduleAnswer(schedule, "9", true, TODAY);
        schedule = scheduleAnswer(schedule, "9", true, TODAY);

        expect(schedule).toEqual([{ num: "9", box: 2, due: "2026-10-11", lastReviewed: TODAY }]);
    });

    it("moves a question fixed on the same day up only one box", () => {
        let schedule = scheduleAnswer([item("9", 4, YESTERDAY)], "9", false, TODAY);
        expect(schedule).toEqual([{ num: "9", box: 1, due: TODAY, lastReviewed: TODAY }]);

        schedule = scheduleAnswer(schedule, "9", true, TODAY);
        expect(schedule).toEqual([{ num: "9", box: 2, due: "2026-10-11", lastReviewed: TODAY }]);

        schedule = scheduleAnswer(schedule, "9", true, TODAY);
        expect(schedule).toEqual([{ num: "9", box: 2, due: "2026-10-11", lastReviewed: TODAY }]);
    });

    it.each([1, 2, 3, 4, 5])("sends box %i back to box 1, due today, after a wrong answer", (box) => {
        const result = scheduleAnswer([item("5", box, YESTERDAY)], "5", false, TODAY);

        expect(result).toEqual([{ num: "5", box: 1, due: TODAY, lastReviewed: TODAY }]);
    });

    it("demotes a wrong answer even when the question was not due yet", () => {
        const result = scheduleAnswer([item("5", 4, "2026-10-20")], "5", false, TODAY);

        expect(result).toEqual([{ num: "5", box: 1, due: TODAY, lastReviewed: TODAY }]);
    });

    it("walks a question from new to mastered when it is answered on each due day", () => {
        const steps: { day: string; box: number; due: string; level: MasteryLevel }[] = [
            { day: "2026-10-09", box: 2, due: "2026-10-11", level: "learning" },
            { day: "2026-10-10", box: 2, due: "2026-10-11", level: "learning" },
            { day: "2026-10-11", box: 3, due: "2026-10-15", level: "known" },
            { day: "2026-10-15", box: 4, due: "2026-10-23", level: "known" },
            // This interval crosses the end of daylight saving time (25 October 2026).
            { day: "2026-10-23", box: 5, due: "2026-11-08", level: "mastered" },
            { day: "2026-11-08", box: 5, due: "2026-11-24", level: "mastered" },
        ];

        let schedule: ReviewItem[] | undefined;
        expect(masteryLevel(getReviewItem(schedule, "21"))).toBe("new");
        for (const step of steps) {
            schedule = scheduleAnswer(schedule, "21", true, step.day);
            expect(schedule).toEqual([{ num: "21", box: step.box, due: step.due, lastReviewed: step.day }]);
            expect(masteryLevel(getReviewItem(schedule, "21"))).toBe(step.level);
        }
    });

    it("counts days correctly across month, year, leap-day, and daylight-saving boundaries", () => {
        expect(scheduleAnswer([item("1", 3, "2026-12-30")], "1", true, "2026-12-30")[0].due).toBe("2027-01-07");
        expect(scheduleAnswer([], "1", true, "2028-02-27")[0].due).toBe("2028-02-29");
        expect(scheduleAnswer([], "1", true, "2027-02-27")[0].due).toBe("2027-03-01");
        // Daylight saving time starts on 29 March 2026.
        expect(scheduleAnswer([item("1", 4, "2026-03-20")], "1", true, "2026-03-20")[0].due).toBe("2026-04-05");
        expect(scheduleAnswer([item("1", 2, "2026-03-28")], "1", true, "2026-03-28")[0].due).toBe("2026-04-01");
    });

    it("changes only the answered question and keeps the order", () => {
        const schedule = frozen([item("1", 2, TOMORROW), item("2", 3, TODAY), item("BE-1", 1, YESTERDAY)]);
        const result = scheduleAnswer(schedule, "2", true, TODAY);

        expect(nums(result)).toEqual(["1", "2", "BE-1"]);
        expect(result[0]).toBe(schedule[0]);
        expect(result[1]).toEqual({ num: "2", box: 4, due: "2026-10-17", lastReviewed: TODAY });
        expect(result[2]).toBe(schedule[2]);
    });

    it("never changes the input schedule or its items", () => {
        const schedule = frozen([item("1", 2, TOMORROW), item("2", 3, TODAY), item("3", 5, YESTERDAY)]);
        const snapshot = JSON.parse(JSON.stringify(schedule));

        expect(() => {
            scheduleAnswer(schedule, "1", true, TODAY);
            scheduleAnswer(schedule, "1", false, TODAY);
            scheduleAnswer(schedule, "2", true, TODAY);
            scheduleAnswer(schedule, "3", false, TODAY);
            scheduleAnswer(schedule, "4", true, TODAY);
        }).not.toThrow();
        expect(schedule).toEqual(snapshot);
    });

    it("returns a new array even when the answer changes nothing", () => {
        const schedule = [item("1", 3, TOMORROW, TODAY)];
        const result = scheduleAnswer(schedule, "1", true, TODAY);

        expect(result).not.toBe(schedule);
        expect(result).toEqual(schedule);
    });

    it("keeps extra fields stored on an item", () => {
        const stored = { ...item("1", 2, TODAY), note: "kept" } as ReviewItem;
        const result = scheduleAnswer([stored], "1", true, TODAY);

        expect(result[0]).toEqual({ num: "1", box: 3, due: "2026-10-13", lastReviewed: TODAY, note: "kept" });
    });

    it("updates the first item of a question and drops later duplicates", () => {
        const schedule = frozen([item("1", 2, TODAY), item("2", 1, TODAY), item("1", 4, YESTERDAY)]);
        const result = scheduleAnswer(schedule, "1", true, TODAY);

        expect(result).toEqual([{ num: "1", box: 3, due: "2026-10-13", lastReviewed: TODAY }, schedule[1]]);
        expect(result[1]).toBe(schedule[1]);
    });

    it("repairs damaged box values", () => {
        expect(scheduleAnswer([item("1", 0, TODAY)], "1", true, TODAY)[0]).toMatchObject({ box: 2, due: "2026-10-11" });
        expect(scheduleAnswer([item("1", -4, TODAY)], "1", true, TODAY)[0]).toMatchObject({ box: 2, due: "2026-10-11" });
        expect(scheduleAnswer([item("1", Number.NaN, TODAY)], "1", true, TODAY)[0]).toMatchObject({ box: 2 });
        expect(scheduleAnswer([item("1", 2.7, TODAY)], "1", true, TODAY)[0]).toMatchObject({ box: 3, due: "2026-10-13" });
        expect(scheduleAnswer([item("1", 9, TODAY)], "1", true, TODAY)[0]).toMatchObject({ box: 5, due: "2026-10-25" });
        expect(scheduleAnswer([item("1", 9, TOMORROW)], "1", true, TODAY)[0]).toMatchObject({ box: 5, due: TOMORROW });
        expect(scheduleAnswer([item("1", 9, TOMORROW)], "1", false, TODAY)[0]).toMatchObject({ box: 1, due: TODAY });
    });
});

describe("getReviewItem", () => {
    const schedule = [item("1", 2, TODAY), item("BE-3", 4, TOMORROW)];

    it("finds the item of a question", () => {
        expect(getReviewItem(schedule, "BE-3")).toBe(schedule[1]);
    });

    it("returns undefined for unknown questions and missing schedules", () => {
        expect(getReviewItem(schedule, "2")).toBeUndefined();
        expect(getReviewItem([], "1")).toBeUndefined();
        expect(getReviewItem(undefined, "1")).toBeUndefined();
        expect(getReviewItem(makeLegacyUser().reviewSchedule, "1")).toBeUndefined();
    });

    it("returns the first item when a question appears twice", () => {
        const duplicated = [item("1", 2, TODAY), item("1", 5, TOMORROW)];
        expect(getReviewItem(duplicated, "1")).toBe(duplicated[0]);
    });
});

describe("dueItems", () => {
    it("returns nothing for missing or empty schedules", () => {
        expect(dueItems(undefined, TODAY)).toEqual([]);
        expect(dueItems([], TODAY)).toEqual([]);
        expect(dueItems(makeLegacyUser().reviewSchedule, TODAY)).toEqual([]);
    });

    it("includes questions due today or earlier and leaves out later ones", () => {
        const schedule = [item("1", 1, TODAY), item("2", 1, YESTERDAY), item("3", 1, TOMORROW), item("4", 1, "2027-01-01")];

        expect(nums(dueItems(schedule, TODAY))).toEqual(["2", "1"]);
        expect(nums(dueItems(schedule, YESTERDAY))).toEqual(["2"]);
        expect(nums(dueItems(schedule, TOMORROW))).toEqual(["2", "1", "3"]);
    });

    it("sorts by due day, then box, then catalogue number", () => {
        const schedule = [
            item("10", 2, YESTERDAY),
            item("2", 2, YESTERDAY),
            item("5", 1, YESTERDAY),
            item("7", 3, EARLIER),
            item("BE-2", 1, TODAY),
            item("3", 4, TODAY),
            item("1", 1, TODAY),
            item("8", 1, TOMORROW),
        ];

        expect(nums(dueItems(schedule, TODAY))).toEqual(["7", "5", "2", "10", "1", "BE-2", "3"]);
    });

    it("orders question numbers like the catalogue", () => {
        const schedule = ["BE-10", "300", "BE-2", "10", "2", "BE-1"].map((num) => item(num, 1, TODAY));

        expect(nums(dueItems(schedule, TODAY))).toEqual(["2", "10", "300", "BE-1", "BE-2", "BE-10"]);
    });

    it("sorts damaged boxes as if they were repaired", () => {
        const schedule = [item("1", 9, TODAY), item("2", 4, TODAY), item("3", Number.NaN, TODAY), item("4", 2, TODAY)];

        expect(nums(dueItems(schedule, TODAY))).toEqual(["3", "4", "2", "1"]);
    });

    it("keeps only relevant questions when a filter is given", () => {
        const schedule = [item("1", 1, TODAY), item("BY-3", 1, TODAY), item("BE-4", 2, YESTERDAY), item("2", 1, TOMORROW)];

        expect(nums(dueItems(schedule, TODAY, isBerlinQuestion))).toEqual(["BE-4", "1"]);
        expect(nums(dueItems(schedule, TODAY))).toEqual(["BE-4", "1", "BY-3"]);
        expect(dueItems(schedule, TODAY, () => false)).toEqual([]);
    });

    it("lists each question once and uses its first item", () => {
        const schedule = [
            item("4", 2, YESTERDAY),
            item("6", 3, TOMORROW),
            item("4", 1, EARLIER),
            item("6", 1, YESTERDAY),
        ];

        expect(dueItems(schedule, TODAY)).toEqual([item("4", 2, YESTERDAY)]);
    });

    it("does not reorder or change the input schedule", () => {
        const schedule = frozen([item("3", 2, TODAY), item("1", 1, YESTERDAY), item("2", 5, EARLIER)]);
        const snapshot = JSON.parse(JSON.stringify(schedule));

        const result = dueItems(schedule, TODAY);

        expect(nums(result)).toEqual(["2", "1", "3"]);
        expect(result).not.toBe(schedule);
        expect(schedule).toEqual(snapshot);
    });
});

describe("dueCount", () => {
    const schedule = [
        item("1", 1, TODAY),
        item("2", 3, YESTERDAY),
        item("3", 2, TOMORROW),
        item("BY-1", 1, EARLIER),
        item("BE-1", 4, TODAY),
        item("2", 1, EARLIER),
    ];

    it("counts each due question once", () => {
        expect(dueCount(schedule, TODAY)).toBe(4);
        expect(dueCount(schedule, TODAY)).toBe(dueItems(schedule, TODAY).length);
    });

    it("applies the relevance filter", () => {
        expect(dueCount(schedule, TODAY, isBerlinQuestion)).toBe(3);
        expect(dueCount(schedule, TODAY, isBerlinQuestion)).toBe(dueItems(schedule, TODAY, isBerlinQuestion).length);
    });

    it("is 0 for missing, empty, or not yet due schedules", () => {
        expect(dueCount(undefined, TODAY)).toBe(0);
        expect(dueCount([], TODAY)).toBe(0);
        expect(dueCount(makeLegacyUser().reviewSchedule, TODAY)).toBe(0);
        expect(dueCount([item("1", 2, TOMORROW)], TODAY)).toBe(0);
    });
});

describe("masteryLevel", () => {
    it("treats a question without a schedule item as new", () => {
        expect(masteryLevel(undefined)).toBe("new");
        expect(masteryLevel(getReviewItem(makeLegacyUser().reviewSchedule, "1"))).toBe("new");
    });

    it.each<[number, MasteryLevel]>([
        [1, "learning"],
        [2, "learning"],
        [3, "known"],
        [4, "known"],
        [5, "mastered"],
    ])("maps box %i to %s", (box, level) => {
        expect(masteryLevel(item("1", box, TODAY))).toBe(level);
    });

    it("treats damaged boxes like the nearest valid box", () => {
        expect(masteryLevel(item("1", 0, TODAY))).toBe("learning");
        expect(masteryLevel(item("1", -2, TODAY))).toBe("learning");
        expect(masteryLevel(item("1", Number.NaN, TODAY))).toBe("learning");
        expect(masteryLevel(item("1", 3.5, TODAY))).toBe("known");
        expect(masteryLevel(item("1", 12, TODAY))).toBe("mastered");
    });

    it("drops back to learning after a wrong answer", () => {
        const schedule = scheduleAnswer([item("1", 5, TOMORROW)], "1", false, TODAY);

        expect(masteryLevel(getReviewItem(schedule, "1"))).toBe("learning");
    });
});
