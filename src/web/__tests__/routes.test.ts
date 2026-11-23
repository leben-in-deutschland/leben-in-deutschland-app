import { describe, expect, it } from "vitest";
import { toNativeHref } from "@/utils/navigation";
import { activeTab, isAppRoute, isSettingsSubpage, isSharedRoute, normalizePath } from "@/utils/routes";

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

    it("treats the exam dates as a shared page: public on the website, no learner record needed", () => {
        for (const path of ["/termine", "/termine/", "/termine.html", "/termine/NW", "/termine/nw.html"]) {
            expect(isSharedRoute(path)).toBe(true);
            expect(isAppRoute(path)).toBe(false);
            expect(activeTab(path)).toBeNull();
        }
        expect(isSharedRoute("/termineplan")).toBe(false);
        expect(isSharedRoute("/dashboard")).toBe(false);
    });

    it("sends a link to one state's exam dates to the single page the apps ship", () => {
        expect(toNativeHref("/termine")).toBe("/termine.html");
        expect(toNativeHref("/termine/NW")).toBe("/termine.html");
        expect(toNativeHref("/termine/by#watch")).toBe("/termine.html#watch");
        // The exam-centre list stays on the website.
        expect(toNativeHref("/pruefstellen/NW")).toBe("https://www.lebenindeutschland.org/pruefstellen/NW");
    });
});
