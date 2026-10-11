/*
 * The heart button in the learner header (PLAN-012): it leads to the tip jar
 * and appears only in the Android app, only while the owner switch is on and
 * Google Play knows the products, placed before the streak chip and the bell.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNewUser } from "@/utils/user-defaults";

const mocks = vi.hoisted(() => ({
    native: true,
    supported: true,
    flag: true,
    tipJarSupported: vi.fn(),
    loadTipProducts: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(""),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/dashboard",
}));
vi.mock("@capacitor/core", async (importOriginal) => {
    const original = await importOriginal<typeof import("@capacitor/core")>();
    return {
        ...original,
        Capacitor: {
            ...original.Capacitor,
            isNativePlatform: () => mocks.native,
            getPlatform: () => (mocks.native ? "android" : "web"),
            isPluginAvailable: () => false,
        },
    };
});
vi.mock("@/services/tip-jar", () => ({
    TIP_PRODUCT_IDS: ["tip_small", "tip_medium", "tip_large"],
    tipJarSupported: mocks.tipJarSupported,
    loadTipProducts: mocks.loadTipProducts,
}));
vi.mock("@/components/home/use-notices", () => ({
    useNoticeFlags: () => ({ tipJar: mocks.flag }),
}));

import { AppHeader } from "@/components/shell/app-header";

const PRODUCTS = [{ id: "tip_small", name: "Kaffee", price: "1,99 €" }];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<AppHeader variant="app" />);
    });
    await flush();
}

function tipLink(): HTMLAnchorElement | null {
    return document.querySelector<HTMLAnchorElement>('a[aria-label="Trinkgeld geben"]');
}

function headerLabels(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>("header a[aria-label], header button[aria-label]"))
        .map((el) => el.getAttribute("aria-label") ?? "")
        .filter((label) => /Trinkgeld|Serie|Benachrichtigungen/.test(label))
        .map((label) => label.split(/[:\s]/)[0]);
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    const user = createNewUser({ state: { code: "BE", name: "Berlin" } as never, language: "de" }, new Date("2026-10-01T08:00:00Z"));
    window.localStorage.setItem("user", JSON.stringify(user));
    mocks.native = true;
    mocks.supported = true;
    mocks.flag = true;
    mocks.tipJarSupported.mockReset().mockImplementation(() => mocks.supported);
    mocks.loadTipProducts.mockReset().mockResolvedValue(PRODUCTS);
});

afterEach(async () => {
    if (root) {
        await act(async () => root!.unmount());
    }
    container?.remove();
    root = null;
    container = null;
    document.body.innerHTML = "";
});

describe("header tip button", () => {
    it("leads to the support section and sits before the streak and the bell", async () => {
        await mount();
        const link = tipLink();
        expect(link).not.toBeNull();
        expect(link!.getAttribute("href")).toBe("/settings.html#support");
        expect(headerLabels()).toEqual(["Trinkgeld", "Serie", "Benachrichtigungen"]);
        const title = Array.from(document.querySelectorAll("header span span")).find((el) => el.textContent === "Leben in Deutschland");
        expect(title?.className).toContain("max-[383px]:sr-only");
    });

    it("is absent on the web", async () => {
        mocks.native = false;
        mocks.supported = false;
        await mount();
        expect(tipLink()).toBeNull();
        expect(mocks.loadTipProducts).not.toHaveBeenCalled();
    });

    it("respects the owner switch", async () => {
        mocks.flag = false;
        await mount();
        expect(tipLink()).toBeNull();
        expect(mocks.loadTipProducts).not.toHaveBeenCalled();
    });

    it("waits for Google Play to know the products", async () => {
        mocks.loadTipProducts.mockResolvedValue([]);
        await mount();
        expect(tipLink()).toBeNull();
        expect(mocks.loadTipProducts).toHaveBeenCalledTimes(1);
    });
});
