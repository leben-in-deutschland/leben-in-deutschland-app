import type { TermineData } from "@/types/termine";
import { sanitizeTermine, termineStore } from "@/utils/termine-store";
import { nativeHttpSupported, refreshRemoteFile, refreshSiteFile } from "./remote-file";

/**
 * Exam dates refresh (ADR-050).
 *
 * `src/termine/sync.mjs` reads the exam centres' own course pages a few
 * times a day and `src/termine/publish.mjs`, a Hive automation, publishes
 * the result as `termine.json` on the `data` branch of this repository. The
 * file changes too often to be bundled, so nothing ships with the app: the
 * apps download it from GitHub like the evaluation status
 * (`services/evaluation.ts`), and the website asks its own origin, where
 * Vercel passes the request on to the same file (`vercel.json`) - the
 * browser never talks to a third party.
 */

/** The published file, for the apps. */
export const TERMINE_RAW_URL = "https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-app/data/termine.json";

/** The same file on this website's own origin, for the browser. */
export const TERMINE_SITE_PATH = "/live/termine.json";

/**
 * Downloads the exam dates when the cache is missing or an hour old, or at
 * once with `force` (the learner tapped "try again"). Resolves with the new
 * data, or null when nothing was fetched.
 */
export function refreshTermine(options: { now?: Date; force?: boolean } = {}): Promise<TermineData | null> {
    const request = { now: options.now ?? new Date(), force: options.force, label: "exam dates refresh", keep: sanitizeTermine };
    return nativeHttpSupported() ? refreshRemoteFile(termineStore, TERMINE_RAW_URL, request) : refreshSiteFile(termineStore, TERMINE_SITE_PATH, request);
}
