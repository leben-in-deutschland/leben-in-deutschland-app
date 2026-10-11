import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { RemoteStore } from "@/utils/remote-cache";

/**
 * One native download for every small public file the Android app refreshes
 * (ADR-005, ADR-006): a conditional GET through Capacitor's HTTP client,
 * shape validation, and warn-and-back-off on any failure. The website never
 * calls this; its bundled copies are rebuilt on every data change.
 *
 * Never throws. Resolves with the newly stored content, or null when nothing
 * new was stored.
 */

export const REMOTE_TIMEOUT_MS = 10_000;

export type RemoteFileOptions<T> = {
    now?: Date;
    /** Prefix for console warnings. */
    label: string;
    /** How to treat a `404`: a failure (default) or a valid "nothing published" answer. */
    notFound?: "fail" | "empty";
    /** Decides what to keep from a valid body, e.g. null when it equals the bundled copy. */
    keep?: (data: T) => T | null;
};

/** True on Android where the native HTTP client exists. */
export function nativeHttpSupported(): boolean {
    try {
        return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("CapacitorHttp");
    } catch {
        return false;
    }
}

function parseBody(body: unknown): unknown {
    if (typeof body !== "string") {
        return body;
    }
    try {
        return JSON.parse(body);
    } catch {
        return null;
    }
}

function headerValue(headers: unknown, name: string): string | null {
    if (typeof headers !== "object" || headers === null) {
        return null;
    }
    const wanted = name.toLowerCase();
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        if (key.toLowerCase() === wanted && typeof value === "string" && value.length > 0) {
            return value;
        }
    }
    return null;
}

const inFlight = new Map<string, Promise<unknown>>();

/** Downloads `url` into `store` when the cache is missing or a day old. */
export function refreshRemoteFile<T>(store: RemoteStore<T>, url: string, options: RemoteFileOptions<T>): Promise<T | null> {
    const now = options.now ?? new Date();
    if (!nativeHttpSupported() || !store.shouldRefresh(now)) {
        return Promise.resolve(null);
    }
    const running = inFlight.get(store.key) as Promise<T | null> | undefined;
    if (running) {
        return running;
    }
    const request = download(store, url, now, options).finally(() => {
        inFlight.delete(store.key);
    });
    inFlight.set(store.key, request);
    return request;
}

async function download<T>(store: RemoteStore<T>, url: string, now: Date, options: RemoteFileOptions<T>): Promise<T | null> {
    const { label, notFound = "fail", keep } = options;
    try {
        const etag = store.read().etag;
        const response = await CapacitorHttp.get({
            url,
            responseType: "json",
            connectTimeout: REMOTE_TIMEOUT_MS,
            readTimeout: REMOTE_TIMEOUT_MS,
            headers: { Accept: "application/json", ...(etag ? { "If-None-Match": etag } : {}) },
        });
        if (response.status === 304) {
            store.storeUnchanged(now);
            return null;
        }
        if (response.status === 404 && notFound === "empty") {
            store.storeData(null, { etag: null, now });
            return null;
        }
        if (response.status !== 200) {
            console.warn(`${label}: HTTP ${response.status}`);
            store.storeAttempt(now);
            return null;
        }
        const body = parseBody(response.data);
        if (!store.isValid(body)) {
            console.warn(`${label}: unexpected response shape`);
            store.storeAttempt(now);
            return null;
        }
        const kept = keep ? keep(body) : body;
        store.storeData(kept, { etag: headerValue(response.headers, "etag"), now });
        return kept;
    } catch (error) {
        console.warn(`${label} failed`, error);
        store.storeAttempt(now);
        return null;
    }
}
