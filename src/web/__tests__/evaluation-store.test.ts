/*
 * The BAMF status cache: its own storage key, tolerant reads, a stable
 * snapshot for React, and the rules for when to download again.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { EvaluationData } from "@/types/evaluation";
import {
    EMPTY_EVALUATION_CACHE,
    EVALUATION_KEY,
    isEvaluationData,
    newestEvaluation,
    readEvaluationCache,
    shouldRefreshEvaluation,
    storeEvaluation,
    storeEvaluationAttempt,
    subscribeEvaluationCache,
} from "@/utils/evaluation-store";

const sample: EvaluationData = {
    examDate: "14.07.2026",
    lastSyncAt: "08.10.2026 12:46:48",
    history: [{ examDate: "09.07.2026", checkedAt: "29.09.2026" }],
};

const NOW = new Date("2026-10-10T06:00:00Z");

beforeEach(() => {
    localStorage.clear();
});

describe("isEvaluationData", () => {
    it("accepts the scraper's shape", () => {
        expect(isEvaluationData(sample)).toBe(true);
        expect(isEvaluationData({ ...sample, history: [] })).toBe(true);
    });

    it("rejects anything else", () => {
        expect(isEvaluationData(null)).toBe(false);
        expect(isEvaluationData("14.07.2026")).toBe(false);
        expect(isEvaluationData({ ...sample, examDate: "2026-07-14" })).toBe(false);
        expect(isEvaluationData({ ...sample, lastSyncAt: 5 })).toBe(false);
        expect(isEvaluationData({ ...sample, history: [{ examDate: 1 }] })).toBe(false);
        expect(isEvaluationData({ ...sample, history: "none" })).toBe(false);
    });
});

describe("readEvaluationCache", () => {
    it("is empty when nothing is stored", () => {
        expect(readEvaluationCache()).toBe(EMPTY_EVALUATION_CACHE);
    });

    it("survives garbage and drops invalid data", () => {
        localStorage.setItem(EVALUATION_KEY, "{not json");
        expect(readEvaluationCache()).toBe(EMPTY_EVALUATION_CACHE);
        localStorage.setItem(EVALUATION_KEY, JSON.stringify({ data: { examDate: 1 }, fetchedAt: "2026-10-09T00:00:00Z", attemptedAt: "x" }));
        expect(readEvaluationCache()).toEqual({ ...EMPTY_EVALUATION_CACHE, data: null, fetchedAt: null, attemptedAt: null });
    });

    it("returns the same object while the stored text is unchanged", () => {
        storeEvaluation(sample, NOW);
        const first = readEvaluationCache();
        expect(readEvaluationCache()).toBe(first);
        expect(first.data).toEqual(sample);
        expect(first.fetchedAt).toBe(NOW.toISOString());
    });

    it("does not touch the learner record", () => {
        localStorage.setItem("user", '{"keep":true}');
        storeEvaluation(sample, NOW);
        expect(localStorage.getItem("user")).toBe('{"keep":true}');
        expect(localStorage.length).toBe(2);
    });
});

describe("storeEvaluationAttempt", () => {
    it("keeps the data and moves only the attempt stamp", () => {
        storeEvaluation(sample, NOW);
        const later = new Date(NOW.getTime() + 60_000);
        const cache = storeEvaluationAttempt(later);
        expect(cache.data).toEqual(sample);
        expect(cache.fetchedAt).toBe(NOW.toISOString());
        expect(cache.attemptedAt).toBe(later.toISOString());
    });

    it("notifies subscribers on every write", () => {
        let calls = 0;
        const unsubscribe = subscribeEvaluationCache(() => {
            calls += 1;
        });
        storeEvaluation(sample, NOW);
        storeEvaluationAttempt(NOW);
        unsubscribe();
        storeEvaluationAttempt(NOW);
        expect(calls).toBe(2);
    });
});

describe("shouldRefreshEvaluation", () => {
    const hours = (n: number) => new Date(NOW.getTime() + n * 60 * 60 * 1000);

    it("refreshes when nothing is cached", () => {
        expect(shouldRefreshEvaluation(EMPTY_EVALUATION_CACHE, NOW)).toBe(true);
    });

    it("waits a day after a successful download", () => {
        const cache = storeEvaluation(sample, NOW);
        expect(shouldRefreshEvaluation(cache, hours(23))).toBe(false);
        expect(shouldRefreshEvaluation(cache, hours(25))).toBe(true);
    });

    it("waits an hour after a failed attempt", () => {
        const cache = storeEvaluationAttempt(NOW);
        expect(shouldRefreshEvaluation(cache, hours(0.5))).toBe(false);
        expect(shouldRefreshEvaluation(cache, hours(1))).toBe(true);
    });

    it("treats unreadable stamps as old", () => {
        expect(shouldRefreshEvaluation({ ...EMPTY_EVALUATION_CACHE, data: sample, fetchedAt: "yesterday" }, NOW)).toBe(true);
    });
});

describe("newestEvaluation", () => {
    it("prefers the bundled file when nothing was downloaded", () => {
        expect(newestEvaluation(sample, null)).toBe(sample);
    });

    it("prefers whichever was synced later", () => {
        const newer = { ...sample, examDate: "21.07.2026", lastSyncAt: "15.10.2026 02:10:00" };
        const older = { ...sample, examDate: "09.07.2026", lastSyncAt: "29.09.2026 02:10:00" };
        expect(newestEvaluation(sample, newer)).toBe(newer);
        expect(newestEvaluation(sample, older)).toBe(sample);
        expect(newestEvaluation(sample, { ...sample })).not.toBe(sample);
    });
});
