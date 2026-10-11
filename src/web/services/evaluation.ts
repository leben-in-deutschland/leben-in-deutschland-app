import type { EvaluationData } from "@/types/evaluation";
import { evaluationStore } from "@/utils/evaluation-store";
import { nativeHttpSupported, refreshRemoteFile } from "./remote-file";

/**
 * BAMF evaluation status refresh (ADR-005).
 *
 * The app ships `data/current-evaluation.json` and the daily workflow keeps
 * that copy fresh for every build. On Android the installed version would
 * otherwise show the date from its build day, so the app downloads the same
 * public file at most once a day through Capacitor's native HTTP client and
 * keeps it under its own storage key (see `services/remote-file.ts`).
 */

/**
 * The scraper repository's published file - the same URL the daily sync
 * workflow downloads. The project's own domain sits behind Vercel's security
 * challenge, which blocks non-browser clients; switch here if that changes.
 */
export const EVALUATION_URL =
    "https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-scrapper/refs/heads/main/data/current-evaluation.json";

/** True on Android where the native HTTP client exists. */
export const evaluationRefreshSupported = nativeHttpSupported;

/**
 * Downloads a newer status when the cache is missing or a day old.
 * Resolves with the new data, or null when nothing was fetched.
 */
export function refreshEvaluation(now: Date = new Date(), url: string = EVALUATION_URL): Promise<EvaluationData | null> {
    return refreshRemoteFile(evaluationStore, url, { now, label: "evaluation refresh" });
}
