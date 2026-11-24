import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Metadata } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const read = (rel: string): string => fs.readFileSync(path.join(webRoot, rel), "utf8");

/** Screens that show only the learner's on-device state. */
const LEARNER_SCREENS = ["prepare", "mock", "practice", "progress", "dashboard", "settings"] as const;

const layouts: Record<(typeof LEARNER_SCREENS)[number], () => Promise<{ metadata: Metadata }>> = {
    prepare: () => import("@/app/prepare/layout"),
    mock: () => import("@/app/mock/layout"),
    practice: () => import("@/app/practice/layout"),
    progress: () => import("@/app/progress/layout"),
    dashboard: () => import("@/app/dashboard/layout"),
    settings: () => import("@/app/settings/layout"),
};

describe("learner screens stay out of search indexes", () => {
    for (const screen of LEARNER_SCREENS) {
        it(`/${screen} exports robots noindex, follow`, async () => {
            const { metadata } = await layouts[screen]();
            const robots = metadata.robots;
            expect(robots).toBeTypeOf("object");
            if (!robots || typeof robots === "string") throw new Error("robots missing");
            expect(robots.index).toBe(false);
            expect(robots.follow).toBe(true);
            const googleBot = robots.googleBot;
            if (!googleBot || typeof googleBot === "string") throw new Error("googleBot missing");
            expect(googleBot.index).toBe(false);
        });
    }

    it("covers every /settings/<section> page through the settings layout", () => {
        // the section pages sit below app/settings and have no layout of their own
        expect(fs.existsSync(path.join(webRoot, "app/settings/[section]/layout.tsx"))).toBe(false);
        expect(read("app/settings/[section]/page.tsx")).not.toMatch(/robots/);
    });

    it("keeps the root layout indexable for the public pages", () => {
        const root = read("app/layout.tsx");
        expect(root).toMatch(/robots:\s*{\s*index: true/);
        for (const page of ["app/page.tsx", "app/question-catalogue/[[...state]]/page.tsx", "app/impressum/page.tsx"]) {
            expect(read(page)).not.toContain("noindex");
            expect(read(page)).not.toContain("learnerScreenMetadata");
        }
    });

    it("does not list learner screens in the sitemap", () => {
        const sitemap = read("app/sitemap.xml");
        for (const screen of LEARNER_SCREENS) {
            expect(sitemap).not.toContain(`<loc>https://lebenindeutschland.org/${screen}</loc>`);
            expect(sitemap).not.toContain(`lebenindeutschland.org/${screen}/`);
        }
        // the public pages stay
        for (const p of ["", "/question-catalogue", "/termine", "/pruefstellen/BE", "/impressum"]) {
            expect(sitemap).toContain(`<loc>https://lebenindeutschland.org${p}</loc>`);
        }
    });
});
