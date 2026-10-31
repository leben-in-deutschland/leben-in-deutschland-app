/*
 * The landing FAQ answer "What is this platform?" (faq_a12) names every
 * device the app ships on, like the download card does (ADR-047). The FAQ
 * renders only on the web landing page - the native apps skip the landing
 * page - so naming both platforms here does not reach the iOS app
 * (App Review Guideline 2.3.10).
 */
import { describe, expect, it } from "vitest";
import { getTranslations } from "@/data/data";

describe("landing FAQ names the apps for every platform", () => {
    it.each([
        ["en", "apps for Android, iPhone and iPad"],
        ["de", "Apps für Android, iPhone und iPad"],
    ] as const)("%s faq_a12 names Android, iPhone and iPad", (lang, phrase) => {
        const t = getTranslations(lang);
        expect(t.faq_a12).toContain(phrase);
        expect(t.faq_a12).not.toMatch(/an Android app|eine Android-App/);
    });

    it.each(["en", "de"] as const)("%s faq_a12 matches the download card's platforms", (lang) => {
        const t = getTranslations(lang);
        for (const device of ["Android", "iPhone", "iPad"]) {
            expect(t.landing_download_app_desc).toContain(device);
            expect(t.faq_a12).toContain(device);
        }
    });
});
