import { appStoreUrl, siteConfig } from "@/config/site";

/**
 * "Get the app" nudge for learners who use the website in a browser.
 *
 * The platform decides the message: an Android phone is sent to Google Play,
 * an iPhone or iPad to the App Store, a desktop browser sees both and why the
 * app is the better place to learn (reminders, offline, the streak on the
 * phone). Inside the native apps the nudge never renders (see the banner).
 * Dismissing it hides it for `APP_NUDGE_SNOOZE_DAYS`, so a new store launch
 * or a forgotten decision surfaces again without nagging.
 */

export type NudgePlatform = "android" | "ios" | "desktop";

export const APP_NUDGE_KEY = "lid:app-nudge-dismissed-at";
export const APP_NUDGE_SNOOZE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** iPadOS reports a Mac user agent; the touch points give it away. */
export function detectNudgePlatform(userAgent: string, maxTouchPoints = 0): NudgePlatform {
    if (/android/i.test(userAgent)) {
        return "android";
    }
    if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) {
        return "ios";
    }
    return "desktop";
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Epoch ms of the last dismissal, or null when never dismissed or unreadable. */
export function nudgeDismissedAt(storage: StorageLike | null | undefined): number | null {
    try {
        const raw = storage?.getItem(APP_NUDGE_KEY);
        const value = raw ? Number(raw) : NaN;
        return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
        return null;
    }
}

export function shouldShowAppNudge(storage: StorageLike | null | undefined, now = Date.now()): boolean {
    const dismissedAt = nudgeDismissedAt(storage);
    return dismissedAt === null || now - dismissedAt >= APP_NUDGE_SNOOZE_DAYS * DAY_MS;
}

export function dismissAppNudge(storage: StorageLike | null | undefined, now = Date.now()): void {
    try {
        storage?.setItem(APP_NUDGE_KEY, String(now));
    } catch {
        // Private mode or a full store: the banner simply returns next time.
    }
}

export type NudgeLinks = { play?: string; appStore?: string };

/** The store links a platform's nudge offers; an empty object means there is nothing to offer, so no banner. */
export function nudgeLinks(platform: NudgePlatform): NudgeLinks {
    const play = siteConfig.links.playStore || undefined;
    const appStore = appStoreUrl();
    if (platform === "android") {
        return play ? { play } : {};
    }
    if (platform === "ios") {
        return appStore ? { appStore } : {};
    }
    return { ...(play ? { play } : {}), ...(appStore ? { appStore } : {}) };
}
