import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

const read = (rel: string): string => fs.readFileSync(path.join(webRoot, rel), "utf8");

describe("legal pages (TASK-043)", () => {
    it("serves an Impressum page with the operator, address, contact and VSBG sentence", () => {
        const page = read("app/impressum/page.tsx");
        expect(page).toContain("Manish Tiwari");
        expect(page).toContain("Am Potekamp 22");
        expect(page).toContain("40885 Ratingen");
        expect(page).toContain("hello@lamplitlabs.com");
        expect(page).toContain("§ 5");
        expect(page).toContain("DDG");
        expect(page).toContain("§ 18 Abs. 2 MStV");
        expect(page).toContain("§ 36 VSBG");
        // short English summary is part of the page
        expect(page).toContain("English summary");
    });

    it("does not link the discontinued EU ODR platform anywhere on the legal pages", () => {
        const pages = ["app/impressum/page.tsx", "app/privacy-policy/page.tsx"];
        for (const rel of pages) {
            const page = read(rel);
            expect(page).not.toMatch(/ec\.europa\.eu\/consumers\/odr/);
            expect(page).not.toMatch(/Online-Streitbeilegung|OS-Plattform/i);
        }
    });

    it("names the GDPR controller with address on the privacy policy", () => {
        const page = read("app/privacy-policy/page.tsx");
        expect(page).toContain('const CONTROLLER = "Manish Tiwari"');
        expect(page).toContain("Am Potekamp 22, 40885 Ratingen, Germany");
    });

    it("mentions the GDPR rights (Art. 15-21) and a supervisory authority", () => {
        const page = read("app/privacy-policy/page.tsx");
        expect(page).toContain("Art. 15–21");
        expect(page).toMatch(/supervisory authority/);
        expect(page).toContain("Landesbeauftragte für Datenschutz und");
        expect(page).toContain("Nordrhein-Westfalen");
    });

    it("refreshes the privacy policy last-updated date", () => {
        const page = read("app/privacy-policy/page.tsx");
        expect(page).toContain('const LAST_UPDATED = "October 30, 2026"');
    });

    it("serves the German aliases /datenschutz and /datenschutzrichtlinie as the privacy policy", () => {
        // static export cannot use next.config redirects, so the aliases are
        // app routes that re-export the privacy policy page and its metadata
        // (canonical stays /privacy-policy).
        for (const rel of ["app/datenschutz/page.tsx", "app/datenschutzrichtlinie/page.tsx"]) {
            const alias = read(rel);
            expect(alias).toContain('from "../privacy-policy/page"');
            expect(alias).toContain("export { default }");
        }
    });

    it("links the Impressum from the website footer legal column", () => {
        const footer = read("components/footer.tsx");
        expect(footer).toContain('t.footer_link_impressum, href: "/impressum"');
    });

    it("links the Impressum from the app settings About section", () => {
        const about = read("components/preferences/about-section.tsx");
        expect(about).toContain('t.settings_impressum} href="/impressum"');
    });

    it("has Impressum labels in the common and settings translation areas (en + de)", () => {
        const commonEn = JSON.parse(read("data/translations/en.json"));
        const commonDe = JSON.parse(read("data/translations/de.json"));
        const settingsEn = JSON.parse(read("data/translations/areas/settings.en.json"));
        const settingsDe = JSON.parse(read("data/translations/areas/settings.de.json"));
        expect(commonEn.footer_link_impressum).toBeTruthy();
        expect(commonDe.footer_link_impressum).toBe("Impressum");
        expect(settingsEn.settings_impressum).toBeTruthy();
        expect(settingsDe.settings_impressum).toBe("Impressum");
    });
});
