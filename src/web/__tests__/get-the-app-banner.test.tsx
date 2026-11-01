/*
 * The "get the app" banner in a browser: the platform picks the store, a
 * desktop sees both, a dismissal keeps it away for a month, and the native
 * apps never show it.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_NUDGE_KEY } from "@/utils/app-nudge";

const native = vi.hoisted(() => ({ value: false }));
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => native.value, getPlatform: () => (native.value ? "android" : "web"), isPluginAvailable: () => false },
}));

const USER = { state: { stateCode: "BE", stateName: "Berlin" }, dailyProgress: [], questionProgress: [], id: "", testProgress: [], appLanguage: "de", onboardingCompleted: true };

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function setUserAgent(value: string, touchPoints = 0) {
    Object.defineProperty(window.navigator, "userAgent", { value, configurable: true });
    Object.defineProperty(window.navigator, "maxTouchPoints", { value: touchPoints, configurable: true });
}

async function mount() {
    const { GetTheAppBanner } = await import("@/components/shell/get-the-app-banner");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<GetTheAppBanner />);
    });
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

const banner = () => container?.querySelector("section[data-platform]") ?? null;
const links = () => Array.from(container?.querySelectorAll("a[href]") ?? []).map((a) => a.getAttribute("href") ?? "");

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", JSON.stringify(USER));
    native.value = false;
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36");
});

afterEach(async () => {
    if (root) {
        await act(async () => root!.unmount());
    }
    container?.remove();
    root = null;
    container = null;
});

describe("get the app banner", () => {
    it("sends an Android browser to Google Play, in German", async () => {
        setUserAgent("Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36");
        await mount();
        expect(banner()?.getAttribute("data-platform")).toBe("android");
        expect(container!.textContent).toContain("Es gibt eine Android-App");
        expect(container!.textContent).toContain("Bei Google Play laden");
        expect(links()).toEqual([expect.stringContaining("play.google.com")]);
        expect(container!.textContent).not.toContain("App Store");
    });

    it("sends an iPhone browser to the App Store", async () => {
        setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1");
        await mount();
        expect(banner()?.getAttribute("data-platform")).toBe("ios");
        expect(container!.textContent).toContain("Es gibt eine App für iPhone und iPad");
        expect(links()).toEqual([expect.stringContaining("apps.apple.com")]);
        expect(container!.textContent).not.toContain("Google Play");
    });

    it("tells a desktop browser the app is the better place and offers both stores", async () => {
        await mount();
        expect(banner()?.getAttribute("data-platform")).toBe("desktop");
        expect(container!.textContent).toContain("Besser lernen mit der App");
        expect(links()).toEqual([expect.stringContaining("play.google.com"), expect.stringContaining("apps.apple.com")]);
        for (const a of container!.querySelectorAll("a[href]")) {
            expect(a.getAttribute("target")).toBe("_blank");
            expect(a.getAttribute("rel")).toContain("noopener");
        }
    });

    it("hides for a month after dismissing and remembers it across mounts", async () => {
        await mount();
        const dismiss = container!.querySelector('button[aria-label="Hinweis einen Monat ausblenden"]') as HTMLButtonElement;
        expect(dismiss).not.toBeNull();
        await act(async () => {
            dismiss.click();
        });
        expect(banner()).toBeNull();
        expect(Number(window.localStorage.getItem(APP_NUDGE_KEY))).toBeGreaterThan(0);

        await act(async () => root!.unmount());
        root = null;
        container?.remove();
        await mount();
        expect(banner()).toBeNull();

        window.localStorage.setItem(APP_NUDGE_KEY, String(Date.now() - 31 * 24 * 60 * 60 * 1000));
        await act(async () => root!.unmount());
        root = null;
        container?.remove();
        await mount();
        expect(banner()).not.toBeNull();
    });

    it("never renders inside the native apps", async () => {
        native.value = true;
        setUserAgent("Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36");
        await mount();
        expect(banner()).toBeNull();
    });

    it("speaks English when the learner does", async () => {
        window.localStorage.setItem("user", JSON.stringify({ ...USER, appLanguage: "en" }));
        setUserAgent("Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36");
        await mount();
        expect(container!.textContent).toContain("There is an Android app");
        expect(container!.textContent).toContain("Get it on Google Play");
    });
});
