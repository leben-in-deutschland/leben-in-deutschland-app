import { describe, expect, it } from "vitest";
import { APP_NUDGE_KEY, APP_NUDGE_SNOOZE_DAYS, detectNudgePlatform, dismissAppNudge, nudgeLinks, shouldShowAppNudge } from "@/utils/app-nudge";

const UA = {
    androidChrome: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
    iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0",
};

function memoryStorage(initial: Record<string, string> = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => void map.set(key, value),
        map,
    };
}

describe("app nudge platform", () => {
    it("sends Android phones to Google Play", () => {
        expect(detectNudgePlatform(UA.androidChrome)).toBe("android");
    });

    it("recognises iPhones and iPads, including an iPad that pretends to be a Mac", () => {
        expect(detectNudgePlatform(UA.iphoneSafari)).toBe("ios");
        expect(detectNudgePlatform(UA.ipadDesktopMode, 5)).toBe("ios");
    });

    it("treats a Mac without touch and Windows as desktop", () => {
        expect(detectNudgePlatform(UA.macChrome, 0)).toBe("desktop");
        expect(detectNudgePlatform(UA.windowsEdge)).toBe("desktop");
    });
});

describe("app nudge snooze", () => {
    const now = Date.parse("2026-11-01T10:00:00Z");
    const day = 24 * 60 * 60 * 1000;

    it("shows until dismissed, then hides for the snooze window", () => {
        const storage = memoryStorage();
        expect(shouldShowAppNudge(storage, now)).toBe(true);
        dismissAppNudge(storage, now);
        expect(storage.map.get(APP_NUDGE_KEY)).toBe(String(now));
        expect(shouldShowAppNudge(storage, now + day)).toBe(false);
        expect(shouldShowAppNudge(storage, now + (APP_NUDGE_SNOOZE_DAYS - 1) * day)).toBe(false);
        expect(shouldShowAppNudge(storage, now + APP_NUDGE_SNOOZE_DAYS * day)).toBe(true);
    });

    it("ignores garbage in storage and a missing storage", () => {
        expect(shouldShowAppNudge(memoryStorage({ [APP_NUDGE_KEY]: "soon" }), now)).toBe(true);
        expect(shouldShowAppNudge(null, now)).toBe(true);
        expect(() => dismissAppNudge(null, now)).not.toThrow();
    });
});

describe("app nudge links", () => {
    it("offers the matching store per platform and both on a desktop", () => {
        expect(Object.keys(nudgeLinks("android"))).toEqual(["play"]);
        expect(Object.keys(nudgeLinks("ios"))).toEqual(["appStore"]);
        expect(Object.keys(nudgeLinks("desktop")).sort()).toEqual(["appStore", "play"]);
        expect(nudgeLinks("android").play).toContain("play.google.com");
        expect(nudgeLinks("ios").appStore).toContain("apps.apple.com");
    });
});
