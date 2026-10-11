/*
 * Classic (2.0) state change on the 2.1 data layer: choosing a state keeps
 * the learner's progress and the 2.1 fields instead of rebuilding the record
 * as 2.0 did, and creates a complete 2.1 record when there is none yet.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { User } from "@/types/user";
import { saveStateChange } from "@/classic/utils/state-utils";
import { readUser } from "@/utils/user-store";
import { CURRENT_SCHEMA_VERSION, createNewUser, DEFAULT_PREFERENCES } from "@/utils/user-defaults";
import DEVICE_RECORD from "../fixtures/legacy-user-2.0-device.json";

const BERLIN = { name: "Berlin", code: "BE", eng: "Berlin", capital: "Berlin" };
const BAYERN = { name: "Bayern", code: "BY", eng: "Bavaria", capital: "München" };

const ALL_STATES = [
    { code: "BW", name: "Baden-Württemberg" },
    { code: "BY", name: "Bayern" },
    { code: "BE", name: "Berlin" },
    { code: "BB", name: "Brandenburg" },
    { code: "HB", name: "Bremen" },
    { code: "HH", name: "Hamburg" },
    { code: "HE", name: "Hessen" },
    { code: "NI", name: "Niedersachsen" },
    { code: "MV", name: "Mecklenburg-Vorpommern" },
    { code: "NW", name: "Nordrhein-Westfalen" },
    { code: "RP", name: "Rheinland-Pfalz" },
    { code: "SL", name: "Saarland" },
    { code: "SN", name: "Sachsen" },
    { code: "ST", name: "Sachsen-Anhalt" },
    { code: "SH", name: "Schleswig-Holstein" },
    { code: "TH", name: "Thüringen" },
].map((state) => ({ ...state, eng: state.name, capital: "" }));

function stored(): User {
    return JSON.parse(window.localStorage.getItem("user") ?? "null");
}

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    window.localStorage.clear();
});

describe("saveStateChange", () => {
    describe("with a record written by 2.0", () => {
        beforeEach(() => {
            window.localStorage.setItem("user", JSON.stringify(DEVICE_RECORD));
        });

        it("changes only the state", () => {
            const result = saveStateChange(BAYERN);
            expect(result.state).toEqual({ stateCode: "BY", stateName: "Bayern" });
            expect(stored().state).toEqual({ stateCode: "BY", stateName: "Bayern" });
        });

        it("keeps every answer, mock exam, and daily entry", () => {
            const result = saveStateChange(BAYERN);
            expect(result.questionProgress).toHaveLength(DEVICE_RECORD.questionProgress.length);
            expect(result.questionProgress).toEqual(DEVICE_RECORD.questionProgress);
            expect(result.testProgress).toHaveLength(DEVICE_RECORD.testProgress.length);
            expect(result.dailyProgress).toHaveLength(DEVICE_RECORD.dailyProgress.length);
            expect(result.appLanguage).toBe(DEVICE_RECORD.appLanguage);
        });

        it("keeps the 2.1 fields the normalizer filled in", () => {
            const result = saveStateChange(BAYERN);
            // The schema version is stamped by the shell's migration, not here.
            expect(result.schemaVersion).toBeUndefined();
            expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
            expect(result.streak).toBeDefined();
            expect(result.reviewSchedule).toEqual([]);
            expect(result.achievements).toEqual([]);
            expect(result.inbox).toEqual([]);
            expect(result.onboardingCompleted).toBe(true);
        });

        it("is what the shared store reads back", () => {
            const result = saveStateChange(BAYERN);
            expect(readUser()).toEqual(result);
        });
    });

    describe("with a 2.1 record", () => {
        it("keeps the 2.1 settings, streak, and schedule", () => {
            const current = createNewUser({
                state: BERLIN,
                language: "en",
                nickname: "Ada",
                examDate: "2026-12-01",
                preferences: { dailyGoal: 20, notificationsEnabled: true },
            });
            current.streak = { best: 9, freezes: 1, frozenDays: ["2026-10-07"], freezeEarnedDays: ["2026-10-05"] };
            current.reviewSchedule = [{ num: "1", box: 2, due: "2026-10-10", lastReviewed: "2026-10-07" }];
            current.achievements = [{ id: "first-answer", unlockedAt: "2026-10-01T10:00:00.000Z" }];
            window.localStorage.setItem("user", JSON.stringify(current));

            const result = saveStateChange(BAYERN);

            expect(result.state).toEqual({ stateCode: "BY", stateName: "Bayern" });
            expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
            expect(result.appLanguage).toBe("en");
            expect(result.nickname).toBe("Ada");
            expect(result.examDate).toBe("2026-12-01");
            expect(result.preferences?.dailyGoal).toBe(20);
            expect(result.preferences?.notificationsEnabled).toBe(true);
            expect(result.streak).toEqual({ best: 9, freezes: 1, frozenDays: ["2026-10-07"], freezeEarnedDays: ["2026-10-05"] });
            expect(result.reviewSchedule).toEqual([{ num: "1", box: 2, due: "2026-10-10", lastReviewed: "2026-10-07" }]);
            expect(result.achievements).toEqual([{ id: "first-answer", unlockedAt: "2026-10-01T10:00:00.000Z" }]);
        });
    });

    describe("without a record", () => {
        it("creates a complete 2.1 record with the selected state", () => {
            const result = saveStateChange(BERLIN);
            expect(result.state).toEqual({ stateCode: "BE", stateName: "Berlin" });
            expect(result.id).toBe("");
            expect(result.questionProgress).toEqual([]);
            expect(result.testProgress).toEqual([]);
            expect(result.dailyProgress).toEqual([]);
            expect(result.appLanguage).toBe("de");
            expect(result.lastReviewPromptDateTime).toBeNull();
            expect(result.reviewNoCount).toBe(0);
            expect(result.userReviewed).toBe(false);
            expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
            expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
            expect(result.onboardingCompleted).toBe(true);
            expect(stored().state.stateCode).toBe("BE");
        });

        it("works for all German states", () => {
            for (const state of ALL_STATES) {
                window.localStorage.clear();
                const result = saveStateChange(state);
                expect(result.state.stateCode).toBe(state.code);
                expect(result.state.stateName).toBe(state.name);
                expect(stored().state.stateName).toBe(state.name);
            }
        });
    });
});
