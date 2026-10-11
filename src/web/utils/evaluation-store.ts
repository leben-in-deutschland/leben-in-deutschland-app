import type { EvaluationData, EvaluationEntry } from "@/types/evaluation";
import { parseGermanDate } from "@/utils/date-utils";
import { createRemoteStore, REMOTE_MAX_AGE_MS, REMOTE_RETRY_MS, shouldRefreshCache, type RemoteCache } from "@/utils/remote-cache";

/** Where the downloaded BAMF status lives. Separate from the learner record, so old versions simply ignore it. */
export const EVALUATION_KEY = "lid:evaluation";

/** Re-download when the cached copy is older than this. */
export const EVALUATION_MAX_AGE_MS = REMOTE_MAX_AGE_MS;

/** After a failed download, wait this long before trying again. */
export const EVALUATION_RETRY_MS = REMOTE_RETRY_MS;

export type EvaluationCache = RemoteCache<EvaluationData>;

const GERMAN_DATE = /^\d{1,2}\.\d{1,2}\.\d{4}(\s.*)?$/;

function isEntry(value: unknown): value is EvaluationEntry {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const entry = value as Record<string, unknown>;
    return typeof entry.examDate === "string" && typeof entry.checkedAt === "string";
}

/** True for the shape the scraper publishes: German dates plus a history list. */
export function isEvaluationData(value: unknown): value is EvaluationData {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const data = value as Record<string, unknown>;
    return (
        typeof data.examDate === "string" &&
        GERMAN_DATE.test(data.examDate.trim()) &&
        typeof data.lastSyncAt === "string" &&
        GERMAN_DATE.test(data.lastSyncAt.trim()) &&
        Array.isArray(data.history) &&
        data.history.every(isEntry)
    );
}

/** The shared cache behind every export below. */
export const evaluationStore = createRemoteStore<EvaluationData>({ key: EVALUATION_KEY, isValid: isEvaluationData });

export const EMPTY_EVALUATION_CACHE: EvaluationCache = evaluationStore.empty;

/** Current cache. Returns the same object while the stored text is unchanged, as `useSyncExternalStore` requires. */
export const readEvaluationCache = evaluationStore.read;

export const writeEvaluationCache = evaluationStore.write;

export const subscribeEvaluationCache = evaluationStore.subscribe;

/** Records a successful download. */
export function storeEvaluation(data: EvaluationData, now: Date = new Date()): EvaluationCache {
    return evaluationStore.storeData(data, { now });
}

/** Records a failed download so the next try waits. */
export function storeEvaluationAttempt(now: Date = new Date()): EvaluationCache {
    return evaluationStore.storeAttempt(now);
}

/** True when the cache is missing or a day old and no attempt failed within the last hour. */
export function shouldRefreshEvaluation(cache: EvaluationCache, now: Date = new Date()): boolean {
    return shouldRefreshCache(cache, now, EVALUATION_MAX_AGE_MS, EVALUATION_RETRY_MS);
}

function syncTime(data: EvaluationData): number {
    const datePart = data.lastSyncAt.trim().split(" ")[0];
    const time = parseGermanDate(datePart).getTime();
    return Number.isNaN(time) ? 0 : time;
}

/** The more recent of the bundled file and the cached download, so a stale cache never hides a newer app bundle. */
export function newestEvaluation(bundled: EvaluationData, cached: EvaluationData | null): EvaluationData {
    if (!cached) {
        return bundled;
    }
    return syncTime(cached) >= syncTime(bundled) ? cached : bundled;
}
