import { describe, it, expect } from "vitest";
import {
    CURRENT_SCHEMA_VERSION,
    DEFAULT_PREFERENCES,
    changeUserState,
    createNewUser,
    migrateUser,
    normalizePreferences,
    normalizeUser,
    passMarkFor,
    passMarkOf,
    resetProgress,
} from "@/utils/user-defaults";
import type { User } from "@/types/user";

/** A record exactly as version 2.0.145 stored it. */
function legacyRecord() {
    return {
        state: { stateCode: "BE", stateName: "Berlin" },
        dailyProgress: [
            { attempted: 12, date: "Wed Oct 07 2026", correct: 8, incorrect: 3, skipped: 1, flagged: 0 },
            { attempted: 5, date: "Thu Oct 08 2026", correct: 4, incorrect: 1, skipped: 0, flagged: 1 },
        ],
        questionProgress: [
            { num: "1", answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false },
            { num: "2", answeredCorrectly: false, skipped: false, answerSelected: "c", flagged: true },
            { num: "BE-3", answeredCorrectly: null, skipped: true, answerSelected: null, flagged: false },
        ],
        id: "",
        testProgress: [
            {
                datetime: "2026-10-01T10:00:00.000Z",
                timeTake: "1500",
                passed: true,
                cancelled: false,
                questions: [{ num: "1", answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false }],
            },
        ],
        appLanguage: "en",
        appFirstTimeOpenDateTime: "2026-09-01T08:00:00.000Z",
        lastReviewPromptDateTime: null,
        reviewNoCount: 1,
        userReviewed: false,
    };
}

describe("normalizeUser", () => {
    it("returns null for unusable input", () => {
        expect(normalizeUser(null)).toBeNull();
        expect(normalizeUser("user")).toBeNull();
        expect(normalizeUser([1, 2])).toBeNull();
    });

    it("keeps every field of a 2.0.145 record and adds defaults", () => {
        const raw = legacyRecord();
        const user = normalizeUser(JSON.parse(JSON.stringify(raw)))!;
        expect(user.state).toEqual(raw.state);
        expect(user.dailyProgress).toEqual(raw.dailyProgress);
        expect(user.questionProgress).toEqual(raw.questionProgress);
        expect(user.testProgress).toEqual(raw.testProgress);
        expect(user.appLanguage).toBe("en");
        expect(user.reviewNoCount).toBe(1);
        expect(user.preferences).toEqual(DEFAULT_PREFERENCES);
        expect(user.streak).toEqual({ best: 0, freezes: 0, frozenDays: [], freezeEarnedDays: [] });
        expect(user.reviewSchedule).toEqual([]);
        expect(user.inbox).toEqual([]);
        expect(user.achievements).toEqual([]);
        expect(user.examDate).toBeNull();
        expect(user.onboardingCompleted).toBe(true);
    });

    it("keeps unknown fields for forward compatibility", () => {
        const user = normalizeUser({ ...legacyRecord(), futureField: { a: 1 } }) as User & { futureField?: unknown };
        expect(user.futureField).toEqual({ a: 1 });
    });

    it("drops broken entries instead of crashing", () => {
        const user = normalizeUser({
            ...legacyRecord(),
            questionProgress: [null, { num: 5 }, { num: "7", answeredCorrectly: true }],
            testProgress: [{ datetime: "x" }, null],
            reviewSchedule: [{ num: "1", due: "not a day" }, { num: "2", box: 1, due: "2026-10-09", lastReviewed: "2026-10-09" }],
        })!;
        expect(user.questionProgress.map((progress) => progress.num)).toEqual(["7"]);
        expect(user.testProgress).toEqual([]);
        expect(user.reviewSchedule?.map((item) => item.num)).toEqual(["2"]);
    });

    it("treats a record without a state as not onboarded", () => {
        const user = normalizeUser({ ...legacyRecord(), state: { stateCode: "", stateName: "" } })!;
        expect(user.onboardingCompleted).toBe(false);
    });

    it("rejects an invalid exam date", () => {
        expect(normalizeUser({ ...legacyRecord(), examDate: "2026-02-30" })!.examDate).toBeNull();
        expect(normalizeUser({ ...legacyRecord(), examDate: "2026-11-20" })!.examDate).toBe("2026-11-20");
    });
});

describe("normalizePreferences", () => {
    it("fills missing reminder settings and validates values", () => {
        const prefs = normalizePreferences({
            dailyGoal: -3,
            restDays: [6, 0, 0, 9, 3, 2],
            sessionSize: 17,
            streakRule: "goal",
            examType: "lid",
            reminders: { daily: false, dailyTime: "25:00" },
        });
        expect(prefs.dailyGoal).toBe(DEFAULT_PREFERENCES.dailyGoal);
        expect(prefs.restDays).toEqual([0, 2, 3]);
        expect(prefs.sessionSize).toBe(DEFAULT_PREFERENCES.sessionSize);
        expect(prefs.streakRule).toBe("goal");
        expect(prefs.examType).toBe("lid");
        expect(prefs.reminders.daily).toBe(false);
        expect(prefs.reminders.dailyTime).toBe("07:00");
        expect(prefs.reminders.streak).toBe(true);
    });
});

describe("migrateUser", () => {
    it("seeds the review schedule from earlier answers and stamps the version", () => {
        const user = normalizeUser(legacyRecord())!;
        const migrated = migrateUser(user, "2026-10-09");
        expect(migrated).not.toBe(user);
        expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        const byNum = Object.fromEntries((migrated.reviewSchedule ?? []).map((item) => [item.num, item]));
        expect(Object.keys(byNum).sort()).toEqual(["1", "2"]);
        expect(byNum["2"]).toEqual({ num: "2", box: 1, due: "2026-10-09", lastReviewed: "2026-10-09" });
        expect(byNum["1"].box).toBe(2);
        expect(byNum["1"].due > "2026-10-09" && byNum["1"].due <= "2026-10-16").toBe(true);
        expect(migrated.questionProgress).toEqual(user.questionProgress);
    });

    it("does nothing for a current record", () => {
        const user = { ...normalizeUser(legacyRecord())!, schemaVersion: CURRENT_SCHEMA_VERSION };
        expect(migrateUser(user, "2026-10-09")).toBe(user);
    });
});

describe("helpers", () => {
    it("knows the pass marks", () => {
        expect(passMarkFor("einbuergerung")).toBe(17);
        expect(passMarkFor("lid")).toBe(15);
        expect(passMarkFor(undefined)).toBe(17);
        expect(passMarkOf({ datetime: "", timeTake: "", passed: true, cancelled: false, questions: [] })).toBe(17);
        expect(passMarkOf({ datetime: "", timeTake: "", passed: true, cancelled: false, questions: [], passMark: 15 })).toBe(15);
    });

    it("creates a complete new learner", () => {
        const user = createNewUser(
            { state: { code: "BY", name: "Bayern", eng: "Bavaria", capital: "München" }, language: "en", preferences: { dailyGoal: 20 }, examDate: "2026-12-01", nickname: "  Amira  " },
            new Date("2026-10-09T09:00:00Z"),
        );
        expect(user.state).toEqual({ stateCode: "BY", stateName: "Bayern" });
        expect(user.appLanguage).toBe("en");
        expect(user.preferences?.dailyGoal).toBe(20);
        expect(user.examDate).toBe("2026-12-01");
        expect(user.nickname).toBe("Amira");
        expect(user.onboardingCompleted).toBe(true);
        expect(user.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it("changes the state without losing progress", () => {
        const user = normalizeUser(legacyRecord())!;
        const changed = changeUserState(user, { code: "HH", name: "Hamburg", eng: "", capital: "Hamburg" });
        expect(changed.state).toEqual({ stateCode: "HH", stateName: "Hamburg" });
        expect(changed.questionProgress).toBe(user.questionProgress);
        expect(changed.testProgress).toBe(user.testProgress);
    });

    it("starts over but keeps settings", () => {
        const user = { ...normalizeUser(legacyRecord())!, examDate: "2026-12-01", nickname: "Amira" };
        const reset = resetProgress(user);
        expect(reset.questionProgress).toEqual([]);
        expect(reset.testProgress).toEqual([]);
        expect(reset.dailyProgress).toEqual([]);
        expect(reset.preferences).toBe(user.preferences);
        expect(reset.state).toBe(user.state);
        expect(reset.examDate).toBe("2026-12-01");
        expect(reset.nickname).toBe("Amira");
    });
});
