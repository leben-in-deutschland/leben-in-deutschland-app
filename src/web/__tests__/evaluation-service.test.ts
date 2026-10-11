/*
 * The BAMF status download against a mocked Capacitor HTTP client: web is a
 * no-op, a fresh cache is a no-op, and every failure leaves the bundled value
 * alone while backing off for an hour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvaluationData } from "@/types/evaluation";
import { EVALUATION_KEY, readEvaluationCache, storeEvaluation, storeEvaluationAttempt } from "@/utils/evaluation-store";

const mocks = vi.hoisted(() => ({
    native: true,
    pluginAvailable: true,
    get: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
    Capacitor: {
        isNativePlatform: () => mocks.native,
        getPlatform: () => (mocks.native ? "android" : "web"),
        isPluginAvailable: (name: string) => name === "CapacitorHttp" && mocks.pluginAvailable,
    },
    CapacitorHttp: { get: mocks.get },
}));

import { EVALUATION_URL, refreshEvaluation } from "@/services/evaluation";

const sample: EvaluationData = {
    examDate: "21.07.2026",
    lastSyncAt: "15.10.2026 02:10:00",
    history: [{ examDate: "14.07.2026", checkedAt: "08.10.2026" }],
};

const NOW = new Date("2026-10-16T06:00:00Z");

beforeEach(() => {
    localStorage.clear();
    mocks.native = true;
    mocks.pluginAvailable = true;
    mocks.get.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("refreshEvaluation", () => {
    it("does nothing on the web", async () => {
        mocks.native = false;
        expect(await refreshEvaluation(NOW)).toBeNull();
        expect(mocks.get).not.toHaveBeenCalled();
        expect(localStorage.getItem(EVALUATION_KEY)).toBeNull();
    });

    it("does nothing without the native HTTP plugin", async () => {
        mocks.pluginAvailable = false;
        expect(await refreshEvaluation(NOW)).toBeNull();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it("downloads, validates, and caches the file", async () => {
        mocks.get.mockResolvedValue({ status: 200, data: sample, headers: {}, url: EVALUATION_URL });
        expect(await refreshEvaluation(NOW)).toEqual(sample);
        expect(mocks.get).toHaveBeenCalledTimes(1);
        expect(mocks.get.mock.calls[0][0]).toMatchObject({ url: EVALUATION_URL, responseType: "json" });
        const cache = readEvaluationCache();
        expect(cache.data).toEqual(sample);
        expect(cache.fetchedAt).toBe(NOW.toISOString());
    });

    it("accepts a JSON string body (GitHub serves text/plain)", async () => {
        mocks.get.mockResolvedValue({ status: 200, data: JSON.stringify(sample), headers: {}, url: EVALUATION_URL });
        expect(await refreshEvaluation(NOW)).toEqual(sample);
    });

    it("skips the download while the cache is fresh", async () => {
        storeEvaluation(sample, NOW);
        expect(await refreshEvaluation(new Date(NOW.getTime() + 60_000))).toBeNull();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it("downloads again once the cache is a day old", async () => {
        storeEvaluation({ ...sample, examDate: "14.07.2026" }, new Date(NOW.getTime() - 25 * 60 * 60 * 1000));
        mocks.get.mockResolvedValue({ status: 200, data: sample, headers: {}, url: EVALUATION_URL });
        expect(await refreshEvaluation(NOW)).toEqual(sample);
        expect(readEvaluationCache().data?.examDate).toBe("21.07.2026");
    });

    it("keeps the old data on a non-200 answer and backs off", async () => {
        storeEvaluation(sample, new Date(NOW.getTime() - 25 * 60 * 60 * 1000));
        mocks.get.mockResolvedValue({ status: 429, data: "<html>challenge</html>", headers: {}, url: EVALUATION_URL });
        expect(await refreshEvaluation(NOW)).toBeNull();
        const cache = readEvaluationCache();
        expect(cache.data).toEqual(sample);
        expect(cache.attemptedAt).toBe(NOW.toISOString());
        expect(await refreshEvaluation(new Date(NOW.getTime() + 10 * 60_000))).toBeNull();
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });

    it("rejects an unexpected shape", async () => {
        mocks.get.mockResolvedValue({ status: 200, data: { examDate: "2026-07-21" }, headers: {}, url: EVALUATION_URL });
        expect(await refreshEvaluation(NOW)).toBeNull();
        expect(readEvaluationCache().data).toBeNull();
        expect(readEvaluationCache().attemptedAt).toBe(NOW.toISOString());
    });

    it("rejects a body that is not JSON", async () => {
        mocks.get.mockResolvedValue({ status: 200, data: "not json", headers: {}, url: EVALUATION_URL });
        expect(await refreshEvaluation(NOW)).toBeNull();
        expect(readEvaluationCache().data).toBeNull();
    });

    it("never throws when the client fails", async () => {
        mocks.get.mockRejectedValue(new Error("offline"));
        await expect(refreshEvaluation(NOW)).resolves.toBeNull();
        expect(readEvaluationCache().attemptedAt).toBe(NOW.toISOString());
    });

    it("waits an hour after a failed attempt", async () => {
        storeEvaluationAttempt(new Date(NOW.getTime() - 30 * 60_000));
        expect(await refreshEvaluation(NOW)).toBeNull();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it("shares one in-flight download", async () => {
        let resolve!: (value: unknown) => void;
        mocks.get.mockReturnValue(new Promise((r) => (resolve = r)));
        const first = refreshEvaluation(NOW);
        const second = refreshEvaluation(NOW);
        resolve({ status: 200, data: sample, headers: {}, url: EVALUATION_URL });
        expect(await Promise.all([first, second])).toEqual([sample, sample]);
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });
});
