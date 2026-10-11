import type { Question } from "@/types/question";
import { keepIfDifferent, questionStore } from "@/utils/question-store";
import { refreshRemoteFile } from "./remote-file";

/**
 * Question catalogue refresh (ADR-006). The sync workflow splits the
 * scraper's catalogue and commits `questions-core.json` to the public app
 * repository, so the installed app can download the very file a new build
 * would ship. Checked at most once a day through `services/remote-file.ts`;
 * an unchanged file costs one `304` and no storage.
 */
export const QUESTIONS_URL = "https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-app/main/src/web/data/questions-core.json";

/** Downloads a newer catalogue when the cache is missing or a day old. Takes effect at the next catalogue load. */
export function refreshQuestions(now: Date = new Date(), url: string = QUESTIONS_URL): Promise<Question[] | null> {
    return refreshRemoteFile(questionStore, url, { now, label: "questions refresh", keep: keepIfDifferent });
}
