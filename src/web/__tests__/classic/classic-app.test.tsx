/*
 * Renders the classic (2.0) learner app the way the shared shell mounts it:
 * inside the app providers, with a record written by version 2.0 and the
 * stored choice "classic". Checks that every learner route shows its 2.0
 * screen, that ".html" paths resolve, and that "/settings" opens the dialog.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UI_MODE_KEY } from "@/utils/ui-mode";
import DEVICE_RECORD from "../fixtures/legacy-user-2.0-device.json";

const mocks = vi.hoisted(() => ({
    pathname: "/dashboard",
    push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: mocks.push, replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => mocks.pathname,
}));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }));
// jsdom has no canvas; the charts are drawn by chart.js, which is not under test here.
vi.mock("react-chartjs-2", () => ({
    Line: () => <canvas data-testid="chart" />,
    Doughnut: () => <canvas data-testid="chart" />,
}));

import { Providers } from "@/app/provider";
import { ClassicApp, classicScreenFor } from "@/classic/classic-app";

const GREETINGS = ["Guten Morgen", "Guten Nachmittag", "Guten Abend"];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function text(): string {
    return container?.textContent ?? "";
}

function bodyText(): string {
    return document.body.textContent ?? "";
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function button(label: string): HTMLButtonElement | undefined {
    return Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label);
}

async function mount(pathname: string) {
    mocks.pathname = pathname;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(
            <Providers>
                <ClassicApp pathname={pathname} />
            </Providers>,
        );
    });
    await flush();
}

function expectDashboard() {
    expect(container!.querySelector("main#main")).not.toBeNull();
    expect(container!.querySelector("nav")).not.toBeNull();
    expect(GREETINGS.some((greeting) => text().includes(greeting))).toBe(true);
    expect(text()).toContain("Gesamtfortschritt");
    expect(text()).toContain("Beginnen Sie mit der Vorbereitung");
    expect(text()).toContain("Zur Probeklausur");
    // The fixture holds one finished mock exam, so the history card is shown.
    expect(text()).toContain("Probetest-Verlauf");
    // Not native, so the 2.0 footer is part of the page.
    expect(container!.querySelector("footer")).not.toBeNull();
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", JSON.stringify(DEVICE_RECORD));
    window.localStorage.setItem(UI_MODE_KEY, "classic");
    window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() } as any));
    (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} };
    Element.prototype.scrollIntoView = vi.fn();
    mocks.push.mockReset();
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

describe("classicScreenFor", () => {
    it("maps every learner route to a 2.0 screen", () => {
        expect(classicScreenFor("/dashboard")).toBe("dashboard");
        expect(classicScreenFor("/progress")).toBe("dashboard");
        expect(classicScreenFor("/settings")).toBe("dashboard");
        expect(classicScreenFor("/practice")).toBe("prepare");
        expect(classicScreenFor("/prepare")).toBe("prepare");
        expect(classicScreenFor("/mock")).toBe("mock");
    });

    it("accepts the Android .html paths and trailing slashes", () => {
        expect(classicScreenFor("/dashboard.html")).toBe("dashboard");
        expect(classicScreenFor("/practice.html")).toBe("prepare");
        expect(classicScreenFor("/mock.html")).toBe("mock");
        expect(classicScreenFor("/mock/")).toBe("mock");
    });

    it("falls back to the dashboard", () => {
        expect(classicScreenFor("/")).toBe("dashboard");
        expect(classicScreenFor("/something-else")).toBe("dashboard");
        expect(classicScreenFor(null)).toBe("dashboard");
        expect(classicScreenFor(undefined)).toBe("dashboard");
    });
});

describe("classic app with a 2.0 record", () => {
    it("shows the 2.0 dashboard for /dashboard", async () => {
        await mount("/dashboard");
        expectDashboard();
        // The classic chrome: navigation bar with the settings gear.
        expect(document.querySelector('button[aria-label="Einstellungen"]')).not.toBeNull();
        expect(text()).toContain("Dashboard");
        // The record is left as it was written by 2.0.
        expect(JSON.parse(window.localStorage.getItem("user")!)).toEqual(DEVICE_RECORD);
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("classic");
    });

    it("resolves /dashboard.html to the dashboard", async () => {
        await mount("/dashboard.html");
        expectDashboard();
    });

    it("shows the dashboard for /progress", async () => {
        await mount("/progress");
        expectDashboard();
    });

    it("shows the 2.0 prepare screen for /prepare and /practice", async () => {
        await mount("/prepare");
        expect(container!.querySelector("main#main")).not.toBeNull();
        expect(button("Überspringen")).toBeDefined();
        expect(text()).not.toContain("Gesamtfortschritt");

        await act(async () => root!.unmount());
        container!.remove();
        root = null;

        await mount("/practice");
        expect(button("Überspringen")).toBeDefined();
    });

    it("starts the 2.0 mock exam for /mock", async () => {
        await mount("/mock");
        expect(container!.querySelector("main#main")).not.toBeNull();
        // The exam starts right away: question 1 of 33 and the cancel button.
        expect(button("Abbrechen")).toBeDefined();
        expect(text()).toContain("33");
        expect(text()).not.toContain("Gesamtfortschritt");
    });

    it("opens the classic settings dialog for /settings", async () => {
        await mount("/settings");
        expectDashboard();
        expect(bodyText()).toContain("Einstellungen");
        expect(bodyText()).toContain("Bundesland ändern");
        expect(bodyText()).toContain("Design");
        expect(button("Zum neuen Design wechseln")).toBeDefined();
    });
});

describe("classic app without a record", () => {
    it("asks for the state instead of crashing", async () => {
        window.localStorage.removeItem("user");
        await mount("/dashboard");
        expect(container!.querySelector("main#main")).not.toBeNull();
        expect(text()).not.toContain("Gesamtfortschritt");
        // The 2.0 state picker lists the states.
        expect(text()).toContain("Berlin");
    });
});
