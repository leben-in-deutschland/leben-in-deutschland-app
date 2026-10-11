import { noticeStore, sanitizeNoticeFile, type NoticeFile } from "@/utils/notice-store";
import { refreshRemoteFile } from "./remote-file";

/**
 * Owner notices and switches (ADR-006): one small JSON file, hand-edited on
 * the `content` branch of the public app repository so that editing it never
 * triggers a build or a release. Downloaded at most once a day on Android
 * through `services/remote-file.ts`; a missing file means "nothing to say"
 * and is checked again the next day.
 */
export const NOTICES_URL = "https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-app/content/notices.json";

/** Downloads the notice file when the cache is missing or a day old. */
export function refreshNotices(now: Date = new Date(), url: string = NOTICES_URL): Promise<NoticeFile | null> {
    return refreshRemoteFile(noticeStore, url, { now, label: "notices refresh", notFound: "empty", keep: sanitizeNoticeFile });
}
