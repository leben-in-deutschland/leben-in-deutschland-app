/*
 * Store wording and rating link per platform (ADR-047): the iOS app must
 * never name Google Play (App Review Guideline 2.3.10), and its rating row
 * appears only once the App Store URL is known.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ platform: "web", appStore: "" }));

vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => mocks.platform } }));
vi.mock("@/config/site", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/config/site")>();
    return { ...original, appStoreUrl: () => mocks.appStore || undefined };
});

import { storeName, storeRatingUrl } from "@/utils/app-store";

beforeEach(() => {
    mocks.platform = "web";
    mocks.appStore = "";
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("store wording and rating link", () => {
    it("names Google Play on Android and on the web", () => {
        mocks.platform = "android";
        expect(storeName()).toBe("Google Play");
        expect(storeRatingUrl()).toBe("https://play.google.com/store/apps/details?id=org.lebenindeutschland.app");
        mocks.platform = "web";
        expect(storeName()).toBe("Google Play");
    });

    it("names the App Store on iOS and hides the rating link until the URL is set", () => {
        mocks.platform = "ios";
        expect(storeName()).toBe("App Store");
        expect(storeRatingUrl()).toBeUndefined();
        mocks.appStore = "https://apps.apple.com/de/app/id6829151281";
        expect(storeRatingUrl()).toBe("https://apps.apple.com/de/app/id6829151281?action=write-review");
    });
});
