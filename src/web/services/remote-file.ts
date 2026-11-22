import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { RemoteStore } from "@/utils/remote-cache";

/**
 * One native download for every small public file the Android app refreshes
 * (ADR-005, ADR-006): a conditional GET through Capacitor's HTTP client,
 * shape validation, and warn-and-back-off on any failure. The website never
 * calls this; its bundled copies are rebuilt on every data change.
 *
 * `refreshSiteFile` is the same download through the browser's own `fetch`,
 * for a file this website serves itself (ADR-050: the exam dates, which
 * change too often to be bundled).
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
    /** Download even when the cache is fresh or a try just failed: the learner asked for it. */
    force?: boolean;
};

/** What a download hands back: the status, the body (text or parsed JSON) and the headers. */
type RemoteResponse = { status: number; data: unknown; headers: unknown };
type Transport = (url: string, etag: string | null) => Promise<RemoteResponse>;

function requestHeaders(etag: string | null): Record<string, string> {
    return { Accept: "application/json", ...(etag ? { "If-None-Match": etag } : {}) };
}

const nativeTransport: Transport = (url, etag) =>
    CapacitorHttp.get({
        url,
        responseType: "json",
        connectTimeout: REMOTE_TIMEOUT_MS,
        readTimeout: REMOTE_TIMEOUT_MS,
        headers: requestHeaders(etag),
    });

const browserTransport: Transport = async (url, etag) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
    try {
        const response = await fetch(url, { headers: requestHeaders(etag), signal: controller.signal });
        const headers: Record<string, string> = {};
        response.headers.forEach((value, name) => {
            headers[name] = value;
        });
        return { status: response.status, data: response.status === 200 ? await response.text() : null, headers };
    } finally {
        clearTimeout(timer);
    }
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

function refresh<T>(store: RemoteStore<T>, url: string, options: RemoteFileOptions<T>, transport: Transport): Promise<T | null> {
    const now = options.now ?? new Date();
    if (!options.force && !store.shouldRefresh(now)) {
        return Promise.resolve(null);
    }
    const running = inFlight.get(store.key) as Promise<T | null> | undefined;
    if (running) {
        return running;
    }
    const request = download(store, url, now, options, transport).finally(() => {
        inFlight.delete(store.key);
    });
    inFlight.set(store.key, request);
    return request;
}

/** Downloads `url` into `store` when the cache is missing or a day old. */
export function refreshRemoteFile<T>(store: RemoteStore<T>, url: string, options: RemoteFileOptions<T>): Promise<T | null> {
    if (!nativeHttpSupported()) {
        return Promise.resolve(null);
    }
    return refresh(store, url, options, nativeTransport);
}

/**
 * Downloads a file of this website (`path` starts with "/") into `store`
 * through the browser. Does nothing while prerendering.
 */
export function refreshSiteFile<T>(store: RemoteStore<T>, path: string, options: RemoteFileOptions<T>): Promise<T | null> {
    if (typeof window === "undefined" || typeof fetch !== "function" || !path.startsWith("/") || path.startsWith("//")) {
        return Promise.resolve(null);
    }
    return refresh(store, path, options, browserTransport);
}

async function download<T>(store: RemoteStore<T>, url: string, now: Date, options: RemoteFileOptions<T>, transport: Transport): Promise<T | null> {
    const { label, notFound = "fail", keep } = options;
    try {
        const response = await transport(url, store.read().etag);
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
