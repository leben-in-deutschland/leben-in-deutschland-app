import { describe, expect, it } from "vitest";
import { activeTab, isAppRoute, isSettingsSubpage, normalizePath } from "@/utils/routes";

describe("routes", () => {
    it("recognises the settings sub-pages as app routes under the settings tab", () => {
        for (const path of ["/settings/profile", "/settings/notifications.html", "/settings/about/"]) {
            expect(isSettingsSubpage(path)).toBe(true);
            expect(isAppRoute(path)).toBe(true);
            expect(activeTab(path)).toBe("/settings");
        }
    });

    it("keeps everything else as it was", () => {
        expect(isSettingsSubpage("/settings")).toBe(false);
        expect(isSettingsSubpage("/settings/")).toBe(false);
        expect(isSettingsSubpage("/settings/profile/extra")).toBe(false);
        expect(isAppRoute("/settings")).toBe(true);
        expect(activeTab("/settings")).toBe("/settings");
        expect(activeTab("/prepare")).toBe("/practice");
        expect(isAppRoute("/privacy-policy")).toBe(false);
        expect(normalizePath("/settings/profile.html")).toBe("/settings/profile");
    });
});
