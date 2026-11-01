/*
 * The web's brand mark must be the same artwork as the app icon on the stores
 * and the favicons, so a learner recognises the site as the app.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLockup, BrandMark } from "@/components/shell/brand";

const root = path.resolve(__dirname, "..");

describe("brand mark", () => {
    it("renders the app icon artwork, not a separate illustration", () => {
        const html = renderToStaticMarkup(<BrandMark size={24} />);
        expect(html).toContain('src="/android-chrome-192x192.png"');
        expect(html).toContain('aria-hidden="true"');
        expect(html).not.toContain("<svg");
        expect(existsSync(path.join(root, "public/android-chrome-192x192.png"))).toBe(true);
    });

    it("keeps the name next to the mark", () => {
        expect(renderToStaticMarkup(<BrandLockup />)).toContain("Leben in Deutschland");
    });

    it("ships the apple-touch-icon the layout points to", () => {
        const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
        expect(layout).toContain('apple: "/apple-touch-icon.png"');
        const icon = path.join(root, "public/apple-touch-icon.png");
        expect(existsSync(icon)).toBe(true);
        // 180 x 180 PNG (IHDR width/height), the size iOS asks for
        const header = readFileSync(icon).subarray(16, 24);
        expect([header.readUInt32BE(0), header.readUInt32BE(4)]).toEqual([180, 180]);
    });
});
