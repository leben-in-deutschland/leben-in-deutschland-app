import { createRemoteStore, type RemoteCache } from "@/utils/remote-cache";

/**
 * Owner notices and switches (ADR-006). A small hand-edited JSON file the
 * Android app downloads once a day:
 *
 * {
 *   "notices": [{ "id": "2026-10-results", "title": { "de": "...", "en": "..." },
 *                 "body": { "de": "...", "en": "..." }, "url": "https://...",
 *                 "from": "2026-10-10", "until": "2026-10-31",
 *                 "platform": "android", "maxVersion": "2.0.150", "tone": "info" }],
 *   "flags": { "tipJar": true }
 * }
 *
 * Only `id` and `title` are required. Invalid entries are dropped one by one,
 * so a typo never hides the other notices. Nothing here touches the learner
 * record.
 */

export const NOTICES_KEY = "lid:notices";
export const DISMISSED_KEY = "lid:notices-dismissed";

/** How many dismissed ids to remember. */
const DISMISSED_LIMIT = 50;

export type LocalizedText = Record<string, string>;
export type NoticeTone = "info" | "success" | "warning";
export type NoticePlatform = "android" | "web" | "all";

export type Notice = {
    id: string;
    title: LocalizedText;
    body?: LocalizedText;
    url?: string;
    linkLabel?: LocalizedText;
    tone?: NoticeTone;
    /** First day shown, "YYYY-MM-DD", inclusive. */
    from?: string;
    /** Last day shown, "YYYY-MM-DD", inclusive. */
    until?: string;
    platform?: NoticePlatform;
    /** Lowest app version that sees the notice, e.g. "2.0.100". */
    minVersion?: string;
    /** Highest app version that sees the notice, e.g. "2.0.150" for an update notice. */
    maxVersion?: string;
};

export type NoticeFlags = {
    /** False hides the tip jar; anything else keeps it. */
    tipJar: boolean;
};

export type NoticeFile = {
    notices: Notice[];
    flags?: Partial<Record<keyof NoticeFlags, unknown>>;
};

export type NoticeContext = {
    /** "YYYY-MM-DD" of today. */
    today: string;
    platform: Exclude<NoticePlatform, "all">;
    version: string;
    dismissed: readonly string[];
};

/** A notice resolved for one learner: texts in their language, nothing optional left undefined except the link. */
export type ActiveNotice = {
    id: string;
    title: string;
    body: string;
    tone: NoticeTone;
    url: string | null;
    linkLabel: string | null;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^\d+(\.\d+)*$/;
const TONES: readonly NoticeTone[] = ["info", "success", "warning"];
const PLATFORMS: readonly NoticePlatform[] = ["android", "web", "all"];

function isLocalizedText(value: unknown): value is LocalizedText {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const entries = Object.values(value as Record<string, unknown>);
    return entries.length > 0 && entries.every((text) => typeof text === "string");
}

function optional<T>(value: unknown, check: (candidate: unknown) => candidate is T): value is T | undefined {
    return value === undefined || check(value);
}

const isDay = (value: unknown): value is string => typeof value === "string" && DAY.test(value);
const isVersion = (value: unknown): value is string => typeof value === "string" && VERSION.test(value);
const isHttpUrl = (value: unknown): value is string => typeof value === "string" && /^https?:\/\//.test(value);
const isTone = (value: unknown): value is NoticeTone => TONES.includes(value as NoticeTone);
const isPlatform = (value: unknown): value is NoticePlatform => PLATFORMS.includes(value as NoticePlatform);

/** True for one well-formed notice entry. */
export function isNotice(value: unknown): value is Notice {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.id === "string" &&
        entry.id.trim().length > 0 &&
        isLocalizedText(entry.title) &&
        optional(entry.body, isLocalizedText) &&
        optional(entry.linkLabel, isLocalizedText) &&
        optional(entry.url, isHttpUrl) &&
        optional(entry.tone, isTone) &&
        optional(entry.from, isDay) &&
        optional(entry.until, isDay) &&
        optional(entry.platform, isPlatform) &&
        optional(entry.minVersion, isVersion) &&
        optional(entry.maxVersion, isVersion)
    );
}

/** True for the file's top-level shape; entries are checked by `sanitizeNoticeFile`. */
export function isNoticeFile(value: unknown): value is NoticeFile {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const file = value as Record<string, unknown>;
    return Array.isArray(file.notices) && optional(file.flags, (flags): flags is Record<string, unknown> => typeof flags === "object" && flags !== null);
}

/** Keeps only valid entries so one typo never hides the rest. */
export function sanitizeNoticeFile(file: NoticeFile): NoticeFile {
    const notices = file.notices.filter(isNotice);
    return file.flags ? { notices, flags: file.flags } : { notices };
}

export const noticeStore = createRemoteStore<NoticeFile>({ key: NOTICES_KEY, isValid: isNoticeFile });

export type NoticeCache = RemoteCache<NoticeFile>;

/** Numeric comparison of dotted versions; missing segments count as zero. */
export function compareVersions(a: string, b: string): number {
    const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        const difference = (left[index] ?? 0) - (right[index] ?? 0);
        if (difference !== 0) {
            return difference < 0 ? -1 : 1;
        }
    }
    return 0;
}

/** The text in the learner's language, else English, else German, else whatever is there. */
export function pickText(text: LocalizedText | undefined, language: string): string {
    if (!text) {
        return "";
    }
    return text[language] ?? text.en ?? text.de ?? Object.values(text)[0] ?? "";
}

/** True when a notice applies today, on this platform, to this app version, and was not dismissed. */
export function noticeApplies(notice: Notice, context: NoticeContext): boolean {
    if (context.dismissed.includes(notice.id)) {
        return false;
    }
    if (notice.from && context.today < notice.from) {
        return false;
    }
    if (notice.until && context.today > notice.until) {
        return false;
    }
    if (notice.platform && notice.platform !== "all" && notice.platform !== context.platform) {
        return false;
    }
    if (notice.minVersion && compareVersions(context.version, notice.minVersion) < 0) {
        return false;
    }
    if (notice.maxVersion && compareVersions(context.version, notice.maxVersion) > 0) {
        return false;
    }
    return true;
}

/** The notices to show, resolved for the learner's language, in file order. */
export function activeNotices(file: NoticeFile | null, context: NoticeContext, language: string): ActiveNotice[] {
    if (!file) {
        return [];
    }
    return file.notices
        .filter((notice) => isNotice(notice) && noticeApplies(notice, context))
        .map((notice) => ({
            id: notice.id,
            title: pickText(notice.title, language),
            body: pickText(notice.body, language),
            tone: notice.tone ?? "info",
            url: notice.url ?? null,
            linkLabel: notice.url ? pickText(notice.linkLabel, language) || null : null,
        }))
        .filter((notice) => notice.title.length > 0);
}

/** Switches with their defaults applied; an absent or malformed file changes nothing. */
export function resolveFlags(file: NoticeFile | null): NoticeFlags {
    return { tipJar: file?.flags?.tipJar !== false };
}

/* ---------------------------- dismissed ids ---------------------------- */

const dismissedListeners = new Set<() => void>();
let lastDismissedRaw: string | null | undefined;
let lastDismissed: readonly string[] = Object.freeze([]) as readonly string[];

function parseDismissed(raw: string | null): readonly string[] {
    if (!raw) {
        return Object.freeze([]) as readonly string[];
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? Object.freeze(parsed.filter((id): id is string => typeof id === "string")) : Object.freeze([]);
    } catch {
        return Object.freeze([]) as readonly string[];
    }
}

/** Ids the learner has dismissed. Same array while the stored text is unchanged. */
export function readDismissed(): readonly string[] {
    if (typeof window === "undefined") {
        return lastDismissed;
    }
    let raw: string | null;
    try {
        raw = window.localStorage.getItem(DISMISSED_KEY);
    } catch {
        raw = null;
    }
    if (raw !== lastDismissedRaw) {
        lastDismissedRaw = raw;
        lastDismissed = parseDismissed(raw);
    }
    return lastDismissed;
}

export function subscribeDismissed(listener: () => void): () => void {
    dismissedListeners.add(listener);
    return () => {
        dismissedListeners.delete(listener);
    };
}

/** Hides a notice for good on this device. */
export function dismissNotice(id: string): void {
    const next = [...readDismissed().filter((known) => known !== id), id].slice(-DISMISSED_LIMIT);
    try {
        window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
        /* storage full or disabled: the notice simply shows again next time */
    }
    lastDismissedRaw = undefined;
    dismissedListeners.forEach((listener) => listener());
}
