// @vitest-environment node
/*
 * src/store/lib/browser.mjs picks the browser the store scripts (capture,
 * render, video, product icons, review screenshot) drive over CDP. On the
 * owner's Mac it must never start Microsoft Edge (his own browser) and must
 * never pop the keychain dialog "Chrome Safe Storage" - so Playwright's
 * headless shell comes first and every launch carries --use-mock-keychain.
 * The file system is stubbed; nothing here launches a browser.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { browserArgs, browserCandidates, findBrowser, NO_BROWSER_MESSAGE } from "../../store/lib/browser.mjs";

const HOME = "/Users/tester";
const MAC_CACHE = path.join(HOME, "Library/Caches/ms-playwright");
const SHELL_MAC = "chrome-headless-shell-mac-arm64/chrome-headless-shell";
const CFT_MAC = "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const SYSTEM_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SYSTEM_CHROMIUM = "/Applications/Chromium.app/Contents/MacOS/Chromium";

function lister(tree: Record<string, string[]>) {
    return (dir: string) => {
        const entries = tree[dir];
        if (!entries) {
            throw Object.assign(new Error(`ENOENT: ${dir}`), { code: "ENOENT" });
        }
        return entries;
    };
}

const macCache = lister({
    [MAC_CACHE]: ["chromium-1200", "chromium-1252", "chromium_headless_shell-1252", "chromium_headless_shell-1200", "ffmpeg-1013", "chromium_headless_shell-x"],
});

describe("store browser candidates", () => {
    it("tries LID_BROWSER, BROWSER_PATH, Playwright's headless shell (newest first), its Chrome for Testing, then Chrome and Chromium", () => {
        const candidates = browserCandidates({
            env: { LID_BROWSER: "/opt/lid/chrome", BROWSER_PATH: "/opt/shell/chrome-headless-shell" },
            home: HOME,
            platform: "darwin",
            arch: "arm64",
            list: macCache,
        });
        const shell1252 = path.join(MAC_CACHE, "chromium_headless_shell-1252", SHELL_MAC);
        const shell1200 = path.join(MAC_CACHE, "chromium_headless_shell-1200", SHELL_MAC);
        const cft1252 = path.join(MAC_CACHE, "chromium-1252", CFT_MAC);
        const cft1200 = path.join(MAC_CACHE, "chromium-1200", CFT_MAC);
        const order = [
            "/opt/lid/chrome",
            "/opt/shell/chrome-headless-shell",
            shell1252,
            shell1200,
            cft1252,
            cft1200,
            SYSTEM_CHROME,
            SYSTEM_CHROMIUM,
        ].map((item) => candidates.indexOf(item));
        expect(order.every((index) => index >= 0)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(candidates[0]).toBe("/opt/lid/chrome");
        expect(candidates.at(-1)).toBe(SYSTEM_CHROMIUM);
    });

    it("never names Microsoft Edge", () => {
        const candidates = browserCandidates({ env: {}, home: HOME, platform: "darwin", arch: "arm64", list: macCache });
        expect(candidates.some((candidate) => /edge/i.test(candidate))).toBe(false);
    });

    it("picks the newest headless shell on a Mac with no override, even when Chrome for Testing and Google Chrome exist", () => {
        const present = new Set([
            path.join(MAC_CACHE, "chromium_headless_shell-1200", SHELL_MAC),
            path.join(MAC_CACHE, "chromium_headless_shell-1252", SHELL_MAC),
            path.join(MAC_CACHE, "chromium-1252", CFT_MAC),
            SYSTEM_CHROME,
        ]);
        const found = findBrowser({
            env: {},
            home: HOME,
            platform: "darwin",
            arch: "arm64",
            list: macCache,
            exists: (candidate: string) => present.has(candidate),
        });
        expect(found).toBe(path.join(MAC_CACHE, "chromium_headless_shell-1252", SHELL_MAC));
    });

    it("looks in PLAYWRIGHT_BROWSERS_PATH before the default cache", () => {
        const custom = "/srv/pw-browsers";
        const candidates = browserCandidates({
            env: { PLAYWRIGHT_BROWSERS_PATH: custom },
            home: HOME,
            platform: "darwin",
            arch: "arm64",
            list: lister({ [custom]: ["chromium_headless_shell-1100"], [MAC_CACHE]: ["chromium_headless_shell-1252"] }),
        });
        const customShell = candidates.indexOf(path.join(custom, "chromium_headless_shell-1100", SHELL_MAC));
        const cacheShell = candidates.indexOf(path.join(MAC_CACHE, "chromium_headless_shell-1252", SHELL_MAC));
        expect(customShell).toBe(0);
        expect(cacheShell).toBeGreaterThan(customShell);
    });

    it("uses ~/.cache/ms-playwright and the Linux layout on Linux", () => {
        const cache = path.join(HOME, ".cache/ms-playwright");
        const candidates = browserCandidates({
            env: {},
            home: HOME,
            platform: "linux",
            arch: "x64",
            list: lister({ [cache]: ["chromium-1252", "chromium_headless_shell-1252"] }),
        });
        expect(candidates.slice(0, 1)).toEqual([path.join(cache, "chromium_headless_shell-1252", "chrome-headless-shell-linux64/chrome-headless-shell")]);
        expect(candidates).toContain(path.join(cache, "chromium-1252", "chrome-linux64/chrome"));
    });

    it("explains how to get a browser when none exists", () => {
        expect(() =>
            findBrowser({ env: {}, home: HOME, platform: "darwin", arch: "arm64", list: macCache, exists: () => false }),
        ).toThrow(NO_BROWSER_MESSAGE);
        expect(NO_BROWSER_MESSAGE).toContain("LID_BROWSER");
        expect(NO_BROWSER_MESSAGE).not.toMatch(/edge/i);
    });
});

describe("store browser launch flags", () => {
    it("always pass --use-mock-keychain, headless or not", () => {
        for (const headless of [true, false]) {
            const args = browserArgs({ profile: "/tmp/profile", headless });
            expect(args).toContain("--use-mock-keychain");
            expect(args).toContain("--user-data-dir=/tmp/profile");
            expect(args.some((arg) => /msEdge/.test(arg))).toBe(false);
        }
    });
});
