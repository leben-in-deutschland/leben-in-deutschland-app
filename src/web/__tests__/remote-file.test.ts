/*
 * The shared native download against a mocked Capacitor HTTP client:
 * conditional requests, "not modified", optional "404 means nothing
 * published", shape checks, and warn-and-back-off on every failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRemoteStore, REMOTE_MAX_AGE_MS } from "@/utils/remote-cache";

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

import { nativeHttpSupported, refreshRemoteFile } from "@/services/remote-file";

type Thing = { name: string };
const isThing = (value: unknown): value is Thing => typeof value === "object" && value !== null && typeof (value as Thing).name === "string";

const URL = "https://example.test/thing.json";
const NOW = new Date("2026-10-16T06:00:00Z");
const DAY_LATER = new Date(NOW.getTime() + REMOTE_MAX_AGE_MS + 1000);

let counter = 0;
function makeStore() {
    counter += 1;
    return createRemoteStore<Thing>({ key: `lid:test-${counter}`, isValid: isThing, appVersion: "2.0.145" });
}

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

describe("nativeHttpSupported", () => {
    it("is true only on native with the plugin", () => {
        expect(nativeHttpSupported()).toBe(true);
        mocks.pluginAvailable = false;
        expect(nativeHttpSupported()).toBe(false);
        mocks.pluginAvailable = true;
        mocks.native = false;
        expect(nativeHttpSupported()).toBe(false);
    });
});

describe("refreshRemoteFile", () => {
    it("does nothing on the web", async () => {
        mocks.native = false;
        expect(await refreshRemoteFile(makeStore(), URL, { now: NOW, label: "t" })).toBeNull();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it("downloads, validates, stores the etag and sends it back next time", async () => {
        const store = makeStore();
        mocks.get.mockResolvedValueOnce({ status: 200, data: { name: "a" }, headers: { ETag: "\"v1\"" } });
        expect(await refreshRemoteFile(store, URL, { now: NOW, label: "t" })).toEqual({ name: "a" });
        expect(mocks.get).toHaveBeenCalledWith(expect.objectContaining({ url: URL, responseType: "json", headers: { Accept: "application/json" } }));
        expect(store.read().etag).toBe("\"v1\"");

        mocks.get.mockResolvedValueOnce({ status: 304, data: "", headers: {} });
        expect(await refreshRemoteFile(store, URL, { now: DAY_LATER, label: "t" })).toBeNull();
        expect(mocks.get).toHaveBeenLastCalledWith(expect.objectContaining({ headers: { Accept: "application/json", "If-None-Match": "\"v1\"" } }));
        expect(store.read().data).toEqual({ name: "a" });
        expect(store.read().fetchedAt).toBe(DAY_LATER.toISOString());
    });

    it("accepts a JSON string body", async () => {
        const store = makeStore();
        mocks.get.mockResolvedValueOnce({ status: 200, data: "{\"name\":\"text\"}", headers: {} });
        expect(await refreshRemoteFile(store, URL, { now: NOW, label: "t" })).toEqual({ name: "text" });
    });

    it("skips the download while the cache is fresh", async () => {
        const store = makeStore();
        store.storeData({ name: "a" }, { now: NOW });
        expect(await refreshRemoteFile(store, URL, { now: NOW, label: "t" })).toBeNull();
        expect(mocks.get).not.toHaveBeenCalled();
    });

    it("lets the caller keep nothing from a valid body", async () => {
        const store = makeStore();
        mocks.get.mockResolvedValueOnce({ status: 200, data: { name: "same" }, headers: { etag: "\"s\"" } });
        expect(await refreshRemoteFile(store, URL, { now: NOW, label: "t", keep: () => null })).toBeNull();
        expect(store.read().data).toBeNull();
        expect(store.read().etag).toBe("\"s\"");
        expect(store.shouldRefresh(NOW)).toBe(false);
    });

    it("treats 404 as a failure by default and as empty on request", async () => {
        const failing = makeStore();
        mocks.get.mockResolvedValueOnce({ status: 404, data: "Not Found", headers: {} });
        expect(await refreshRemoteFile(failing, URL, { now: NOW, label: "t" })).toBeNull();
        expect(failing.read().fetchedAt).toBeNull();
        expect(failing.read().attemptedAt).toBe(NOW.toISOString());

        const empty = makeStore();
        mocks.get.mockResolvedValueOnce({ status: 404, data: "Not Found", headers: {} });
        expect(await refreshRemoteFile(empty, URL, { now: NOW, label: "t", notFound: "empty" })).toBeNull();
        expect(empty.read().fetchedAt).toBe(NOW.toISOString());
        expect(empty.shouldRefresh(NOW)).toBe(false);
        // Only the failing store warned.
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("keeps old data on other errors and backs off", async () => {
        const store = makeStore();
        store.storeData({ name: "a" }, { etag: "\"v1\"", now: NOW });
        mocks.get.mockResolvedValueOnce({ status: 500, data: "", headers: {} });
        expect(await refreshRemoteFile(store, URL, { now: DAY_LATER, label: "t" })).toBeNull();
        expect(store.read().data).toEqual({ name: "a" });
        expect(store.read().etag).toBe("\"v1\"");
        expect(store.shouldRefresh(DAY_LATER)).toBe(false);
        expect(console.warn).toHaveBeenCalledWith("t: HTTP 500");
    });

    it("rejects an unexpected shape and a body that is not JSON", async () => {
        const store = makeStore();
        mocks.get.mockResolvedValueOnce({ status: 200, data: { nope: true }, headers: {} });
        expect(await refreshRemoteFile(store, URL, { now: NOW, label: "t" })).toBeNull();
        expect(store.read().data).toBeNull();
        expect(store.read().attemptedAt).toBe(NOW.toISOString());

        const other = makeStore();
        mocks.get.mockResolvedValueOnce({ status: 200, data: "<html>", headers: {} });
        expect(await refreshRemoteFile(other, URL, { now: NOW, label: "t" })).toBeNull();
        expect(console.warn).toHaveBeenCalledTimes(2);
    });

    it("never throws when the client fails", async () => {
        const store = makeStore();
        mocks.get.mockRejectedValueOnce(new Error("offline"));
        expect(await refreshRemoteFile(store, URL, { now: NOW, label: "t" })).toBeNull();
        expect(store.read().attemptedAt).toBe(NOW.toISOString());
    });

    it("shares one in-flight download per store", async () => {
        const store = makeStore();
        let release: (value: unknown) => void = () => undefined;
        mocks.get.mockReturnValueOnce(
            new Promise((resolve) => {
                release = resolve;
            }),
        );
        const first = refreshRemoteFile(store, URL, { now: NOW, label: "t" });
        const second = refreshRemoteFile(store, URL, { now: NOW, label: "t" });
        expect(mocks.get).toHaveBeenCalledTimes(1);
        release({ status: 200, data: { name: "a" }, headers: {} });
        expect(await first).toEqual({ name: "a" });
        expect(await second).toEqual({ name: "a" });
    });
});
