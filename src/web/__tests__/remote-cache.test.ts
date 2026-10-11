/*
 * The shared cache behind every daily download: own storage key, memoised
 * reads, day/hour gates, ETag kept for conditional requests, and an optional
 * app-version stamp that makes a cache from another build invisible.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createRemoteStore, REMOTE_MAX_AGE_MS, REMOTE_RETRY_MS, shouldRefreshCache } from "@/utils/remote-cache";

type Thing = { name: string };
const isThing = (value: unknown): value is Thing => typeof value === "object" && value !== null && typeof (value as Thing).name === "string";

const NOW = new Date("2026-10-16T06:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

function makeStore(options: { versioned?: boolean; appVersion?: string } = {}) {
    return createRemoteStore<Thing>({ key: "lid:test-thing", isValid: isThing, appVersion: "2.0.145", ...options });
}

beforeEach(() => {
    localStorage.clear();
});

describe("createRemoteStore", () => {
    it("starts empty and never touches other keys", () => {
        localStorage.setItem("user", "{\"keep\":true}");
        const store = makeStore();
        expect(store.read()).toBe(store.empty);
        store.storeData({ name: "a" }, { etag: "\"1\"", now: NOW });
        expect(localStorage.getItem("user")).toBe("{\"keep\":true}");
        expect(localStorage.length).toBe(2);
    });

    it("stores data with stamps, etag and app version", () => {
        const store = makeStore();
        const cache = store.storeData({ name: "a" }, { etag: "\"1\"", now: NOW });
        expect(cache).toEqual({ data: { name: "a" }, fetchedAt: NOW.toISOString(), attemptedAt: NOW.toISOString(), etag: "\"1\"", appVersion: "2.0.145" });
    });

    it("returns the same object while the stored text is unchanged", () => {
        const store = makeStore();
        store.storeData({ name: "a" }, { now: NOW });
        expect(store.read()).toBe(store.read());
        store.storeAttempt(later(1000));
        expect(store.read().data).toEqual({ name: "a" });
    });

    it("survives garbage and drops data that fails the check", () => {
        const store = makeStore();
        localStorage.setItem(store.key, "{nope");
        expect(store.read()).toBe(store.empty);
        localStorage.setItem(store.key, JSON.stringify({ data: { name: 5 }, fetchedAt: NOW.toISOString(), attemptedAt: NOW.toISOString(), etag: "\"1\"" }));
        const cache = store.read();
        expect(cache.data).toBeNull();
        expect(cache.fetchedAt).toBeNull();
        expect(cache.etag).toBeNull();
        expect(cache.attemptedAt).toBe(NOW.toISOString());
        expect(store.shouldRefresh(later(REMOTE_RETRY_MS))).toBe(true);
    });

    it("keeps an empty-but-fresh answer (nothing published, same as bundled)", () => {
        const store = makeStore();
        store.storeData(null, { etag: "\"same\"", now: NOW });
        const cache = store.read();
        expect(cache.data).toBeNull();
        expect(cache.etag).toBe("\"same\"");
        expect(store.shouldRefresh(later(REMOTE_MAX_AGE_MS - 1))).toBe(false);
        expect(store.shouldRefresh(later(REMOTE_MAX_AGE_MS))).toBe(true);
    });

    it("confirms freshness on not-modified without losing data", () => {
        const store = makeStore();
        store.storeData({ name: "a" }, { etag: "\"1\"", now: NOW });
        const confirmed = store.storeUnchanged(later(REMOTE_MAX_AGE_MS + 1000));
        expect(confirmed.data).toEqual({ name: "a" });
        expect(confirmed.etag).toBe("\"1\"");
        expect(confirmed.fetchedAt).toBe(later(REMOTE_MAX_AGE_MS + 1000).toISOString());
    });

    it("moves only the attempt stamp on failure and waits an hour", () => {
        const store = makeStore();
        store.storeData({ name: "a" }, { now: NOW });
        const failedAt = later(REMOTE_MAX_AGE_MS + 1000);
        store.storeAttempt(failedAt);
        expect(store.read().fetchedAt).toBe(NOW.toISOString());
        expect(store.shouldRefresh(new Date(failedAt.getTime() + REMOTE_RETRY_MS - 1))).toBe(false);
        expect(store.shouldRefresh(new Date(failedAt.getTime() + REMOTE_RETRY_MS))).toBe(true);
    });

    it("notifies subscribers on every write", () => {
        const store = makeStore();
        let calls = 0;
        const stop = store.subscribe(() => {
            calls += 1;
        });
        store.storeData({ name: "a" }, { now: NOW });
        store.storeAttempt(NOW);
        store.storeUnchanged(NOW);
        stop();
        store.storeAttempt(NOW);
        expect(calls).toBe(3);
    });

    it("ignores a versioned cache written by another build", () => {
        makeStore({ versioned: true, appVersion: "2.0.100" }).storeData({ name: "old" }, { etag: "\"old\"", now: NOW });
        const current = makeStore({ versioned: true, appVersion: "2.0.145" });
        const cache = current.read();
        expect(cache.data).toBeNull();
        expect(cache.etag).toBeNull();
        expect(current.shouldRefresh(NOW)).toBe(true);
        expect(makeStore({ versioned: false, appVersion: "2.0.145" }).read().data).toEqual({ name: "old" });
    });
});

describe("shouldRefreshCache", () => {
    it("refreshes when nothing was ever fetched", () => {
        expect(shouldRefreshCache({ fetchedAt: null, attemptedAt: null }, NOW)).toBe(true);
    });

    it("treats unreadable stamps as old", () => {
        expect(shouldRefreshCache({ fetchedAt: "yesterday", attemptedAt: null }, NOW)).toBe(true);
    });
});
