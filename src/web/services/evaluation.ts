import type { EvaluationData } from "@/types/evaluation";
import { evaluationStore } from "@/utils/evaluation-store";
import { nativeHttpSupported, refreshRemoteFile } from "./remote-file";

/**
 * BAMF evaluation status refresh (ADR-005).
 *
 * The app ships `data/current-evaluation.json` and the daily PULSE watch
 * (`.pulse/automations/evaluation-sync.yaml`) keeps that copy fresh for every
 * build. On Android the installed version would
 * otherwise show the date from its build day, so the app downloads the same
 * public file at most once a day through Capacitor's native HTTP client and
 * keeps it under its own storage key (see `services/remote-file.ts`).
 */

/**
 * The bundled file as it is on this repository's `main`: the daily sync job
 * (`scripts/bamf-data-sync.mjs`, read from bamf.de) commits it there, like
 * `questions-core.json` for the catalogue. The project's own domain sits
 * behind Vercel's security challenge, which blocks non-browser clients;
 * switch here if that changes.
 */
export const EVALUATION_URL =
    "https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-app/main/src/web/data/current-evaluation.json";

/** True on Android where the native HTTP client exists. */
export const evaluationRefreshSupported = nativeHttpSupported;

/**
 * Downloads a newer status when the cache is missing or a day old.
 * Resolves with the new data, or null when nothing was fetched.
 */
export function refreshEvaluation(now: Date = new Date(), url: string = EVALUATION_URL): Promise<EvaluationData | null> {
    return refreshRemoteFile(evaluationStore, url, { now, label: "evaluation refresh" });
}
