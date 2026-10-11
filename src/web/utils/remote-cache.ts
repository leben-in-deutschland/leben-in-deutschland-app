import packageJson from "@/package.json";

/**
 * Shared cache for small public files the Android app downloads at most once
 * a day (ADR-005, ADR-006). Each file lives under its own `lid:*` key, apart
 * from the learner record, so older app versions simply ignore it and the
 * bundled copy always remains the fallback.
 */

/** Re-download when the cached copy is older than this. */
export const REMOTE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** After a failed download, wait this long before trying again. */
export const REMOTE_RETRY_MS = 60 * 60 * 1000;

/** The version of the running app, stamped on caches that must not outlive it. */
export const APP_VERSION: string = packageJson.version;

export type RemoteCache<T> = {
    /** Last successfully downloaded content; null when nothing was fetched or there was nothing worth keeping. */
    data: T | null;
    /** ISO time of the last successful check (a download or a "not modified" answer). */
    fetchedAt: string | null;
    /** ISO time of the last attempt, successful or not. */
    attemptedAt: string | null;
    /** Validator of the stored copy, sent back as `If-None-Match`. */
    etag: string | null;
    /** App version that wrote the data, for caches that are tied to the build. */
    appVersion: string | null;
};

export type RemoteStoreOptions<T> = {
    key: string;
    isValid: (value: unknown) => value is T;
    maxAgeMs?: number;
    retryMs?: number;
    /** When true, data written by another app version is ignored and refreshed. */
    versioned?: boolean;
    /** Overrides the running app version (tests). */
    appVersion?: string;
};

export type RemoteStore<T> = {
    key: string;
    empty: RemoteCache<T>;
    isValid: (value: unknown) => value is T;
    /** Current cache. Returns the same object while the stored text is unchanged, as `useSyncExternalStore` requires. */
    read(): RemoteCache<T>;
    write(cache: RemoteCache<T>): RemoteCache<T>;
    subscribe(listener: () => void): () => void;
    /** Records a successful download; `data` may be null when there is nothing worth keeping. */
    storeData(data: T | null, options?: { etag?: string | null; now?: Date }): RemoteCache<T>;
    /** Records a "not modified" answer: the copy is confirmed fresh. */
    storeUnchanged(now?: Date): RemoteCache<T>;
    /** Records a failed download so the next try waits. */
    storeAttempt(now?: Date): RemoteCache<T>;
    shouldRefresh(now?: Date): boolean;
};

function isoOrNull(value: unknown): string | null {
    return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

function stringOrNull(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function ageMs(iso: string | null, now: Date): number {
    if (!iso) {
        return Number.POSITIVE_INFINITY;
    }
    const time = new Date(iso).getTime();
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : now.getTime() - time;
}

/** True when the last successful check is older than a day (or missing) and no attempt failed within the last hour. */
export function shouldRefreshCache(
    cache: Pick<RemoteCache<unknown>, "fetchedAt" | "attemptedAt">,
    now: Date = new Date(),
    maxAgeMs: number = REMOTE_MAX_AGE_MS,
    retryMs: number = REMOTE_RETRY_MS,
): boolean {
    if (ageMs(cache.fetchedAt, now) < maxAgeMs) {
        return false;
    }
    return ageMs(cache.attemptedAt, now) >= retryMs;
}

export function createRemoteStore<T>(options: RemoteStoreOptions<T>): RemoteStore<T> {
    const { key, isValid, maxAgeMs = REMOTE_MAX_AGE_MS, retryMs = REMOTE_RETRY_MS, versioned = false } = options;
    const appVersion = options.appVersion ?? APP_VERSION;
    const empty = Object.freeze({ data: null, fetchedAt: null, attemptedAt: null, etag: null, appVersion: null }) as RemoteCache<T>;
    const listeners = new Set<() => void>();
    let lastRaw: string | null | undefined;
    let lastCache: RemoteCache<T> = empty;

    function parse(raw: string | null): RemoteCache<T> {
        if (!raw) {
            return empty;
        }
        try {
            const parsed: unknown = JSON.parse(raw);
            if (typeof parsed !== "object" || parsed === null) {
                return empty;
            }
            const record = parsed as Record<string, unknown>;
            const writtenBy = stringOrNull(record.appVersion);
            if (versioned && writtenBy !== appVersion) {
                // Another build wrote this; the bundled copy of this build may be newer, so start over right away.
                return empty;
            }
            if (record.data !== null && record.data !== undefined && !isValid(record.data)) {
                // Stored content no longer passes this build's check: forget it and download again soon.
                return { ...empty, attemptedAt: isoOrNull(record.attemptedAt) };
            }
            return {
                data: (record.data as T | null | undefined) ?? null,
                fetchedAt: isoOrNull(record.fetchedAt),
                attemptedAt: isoOrNull(record.attemptedAt),
                etag: stringOrNull(record.etag),
                appVersion: writtenBy,
            };
        } catch {
            return empty;
        }
    }

    function read(): RemoteCache<T> {
        if (typeof window === "undefined") {
            return empty;
        }
        let raw: string | null;
        try {
            raw = window.localStorage.getItem(key);
        } catch {
            raw = null;
        }
        if (raw !== lastRaw) {
            lastRaw = raw;
            lastCache = parse(raw);
        }
        return lastCache;
    }

    function write(cache: RemoteCache<T>): RemoteCache<T> {
        try {
            window.localStorage.setItem(key, JSON.stringify(cache));
        } catch {
            /* storage full or disabled: the bundled copy keeps working */
        }
        lastRaw = undefined;
        const current = read();
        listeners.forEach((listener) => listener());
        return current;
    }

    return {
        key,
        empty,
        isValid,
        read,
        write,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        storeData(data, { etag = null, now = new Date() } = {}) {
            const stamp = now.toISOString();
            return write({ data, fetchedAt: stamp, attemptedAt: stamp, etag, appVersion });
        },
        storeUnchanged(now = new Date()) {
            const stamp = now.toISOString();
            return write({ ...read(), fetchedAt: stamp, attemptedAt: stamp, appVersion });
        },
        storeAttempt(now = new Date()) {
            return write({ ...read(), attemptedAt: now.toISOString() });
        },
        shouldRefresh(now = new Date()) {
            return shouldRefreshCache(read(), now, maxAgeMs, retryMs);
        },
    };
}
