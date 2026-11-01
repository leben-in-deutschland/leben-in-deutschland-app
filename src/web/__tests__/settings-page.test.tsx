/*
 * Renders the real settings pages in jsdom - the hub at /settings and the
 * section pages at /settings/<id> - with a record written by version 2.0 (no
 * preferences, no onboarding flag) and checks that every change goes through
 * the store without disturbing the legacy fields.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/types/user";
import type { SettingsSectionId } from "@/components/preferences/settings-sections";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => router,
    usePathname: () => "/settings",
}));

// The tip jar is off unless a test switches it on; it then answers like Google Play, a moment later.
const tipJar = vi.hoisted(() => ({
    supported: false,
    products: [] as { id: string; name: string; price: string }[],
    releaseProducts: () => {},
}));
vi.mock("@/services/tip-jar", () => ({
    TIP_PRODUCT_IDS: ["tip_small", "tip_medium", "tip_large"],
    tipJarSupported: () => tipJar.supported,
    loadTipProducts: () => new Promise((resolve) => {
        tipJar.releaseProducts = () => resolve(tipJar.products);
    }),
    sendTip: vi.fn().mockResolvedValue("cancelled"),
    recoverTips: vi.fn().mockResolvedValue(0),
}));

const LEGACY_USER = {
    state: { stateCode: "BE", stateName: "Berlin" },
    dailyProgress: [{ date: "Thu Oct 08 2026", correct: 3, incorrect: 1, attempted: 4, skipped: 0, flagged: 0 }],
    questionProgress: [{ num: "12", answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false }],
    id: "",
    testProgress: [],
    appLanguage: "de",
    appFirstTimeOpenDateTime: "Thu Oct 01 2026",
    lastReviewPromptDateTime: null,
    reviewNoCount: 1,
    userReviewed: false,
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function text(): string {
    return container?.textContent ?? "";
}

function stored(): User {
    return JSON.parse(window.localStorage.getItem("user") ?? "null");
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function click(el: Element | null | undefined) {
    if (!el) throw new Error("element not found");
    act(() => {
        el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        (el as HTMLElement).click();
    });
}

function byText(selector: string, needle: string): Element | undefined {
    return Array.from(document.querySelectorAll(selector)).find((el) => (el.textContent ?? "").trim() === needle);
}

/** The fold-out toggle of a settings section, or null while the section has none. */
function foldOut(sectionId: string): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>(`#${sectionId} button[aria-expanded]`);
}

function setValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

async function render(node: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(node);
    });
    await flush();
}

/** The hub at /settings, optionally opened with a legacy hash. */
async function mountHub(hash = "") {
    window.history.replaceState({}, "", `/settings${hash}`);
    const { default: SettingsPage } = await import("@/app/settings/page");
    await render(<SettingsPage />);
}

/** One or more section pages (/settings/<id>), stacked so a test can cross sections. */
async function mount(...sections: SettingsSectionId[]) {
    window.history.replaceState({}, "", `/settings/${sections[0]}`);
    const { SettingsSectionScreen } = await import("@/components/preferences/settings-section-screen");
    await render(
        <>
            {sections.map((section) => (
                <SettingsSectionScreen key={section} section={section} />
            ))}
        </>,
    );
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", JSON.stringify(LEGACY_USER));
    tipJar.supported = false;
    tipJar.products = [];
    router.replace.mockReset();
    window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() } as any));
    (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} };
    (globalThis as any).IntersectionObserver = (globalThis as any).IntersectionObserver ?? class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    window.scrollTo = vi.fn() as any;
    Element.prototype.scrollIntoView = vi.fn();
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

describe("settings hub", () => {
    it("lists every section with its current value and links to its page", async () => {
        await mountHub();
        for (const heading of ["Profil", "Üben", "Prüfung", "Serie", "Benachrichtigungen", "Design", "Deine Daten", "Über die App"]) {
            expect(text()).toContain(heading);
        }
        expect(text()).toContain("Berlin · Deutsch");
        expect(text()).toContain("10 Fragen pro Tag");
        expect(text()).toContain("Nicht festgelegt");
        expect(text()).toContain("Jedes Üben · keine Ruhetage");
        expect(text()).toContain("In der Android- und iPhone-App");
        const hrefs = Array.from(container!.querySelectorAll("a[href^='/settings/']")).map((a) => a.getAttribute("href"));
        expect(hrefs).toEqual(["/settings/profile", "/settings/practice", "/settings/exam", "/settings/streak", "/settings/notifications", "/settings/design", "/settings/data", "/settings/about"]);
        // The tip jar is a store feature; the web has no row for it.
        expect(text()).not.toContain("Trinkgeld");
        // No section content on the hub itself.
        expect(document.querySelector('[role="radiogroup"][aria-label="Tagesziel"]')).toBeNull();
        expect(document.getElementById("settings-exam-date")).toBeNull();
    });

    it("forwards a legacy hash to the section page", async () => {
        await mountHub("#notifications");
        expect(router.replace).toHaveBeenCalledWith("/settings/notifications");
    });

    it("forwards the header heart (#support) to the support page", async () => {
        await mountHub("#support");
        expect(router.replace).toHaveBeenCalledWith("/settings/support");
    });

    it("ignores an unknown hash", async () => {
        await mountHub("#nowhere");
        expect(router.replace).not.toHaveBeenCalled();
    });
});

describe("settings section pages", () => {
    it("renders a section with the page title and a way back", async () => {
        await mount("notifications");
        expect(document.querySelector("h1#notifications-heading")?.textContent).toBe("Benachrichtigungen");
        expect(container!.querySelector('a[href="/settings"]')?.textContent).toContain("Einstellungen");
        // One heading only: the section does not repeat it.
        expect(document.querySelectorAll("h1, h2").length).toBe(1);
        // Reminders live in the apps; the web shows a note and the weekly tips switch.
        expect(text()).toContain("nur in der Android- und iPhone-App");
        expect(text()).toContain("Wöchentliche Tipps");
    });

    it("shows the version on the about page", async () => {
        await mount("about");
        expect(text()).toContain("Version");
    });

    it("tells the web that the tip jar is a store feature", async () => {
        tipJar.supported = true;
        await mount("support");
        expect(text()).toContain("Dieser Bereich ist hier nicht verfügbar.");
        expect(document.getElementById("support")).toBeNull();
    });

    it("writes preference changes without touching legacy fields", async () => {
        await mount("practice", "profile", "streak");
        expect(stored().preferences).toBeUndefined();

        click(byText('[role="radiogroup"][aria-label="Tagesziel"] button', "20"));
        await flush();
        expect(stored().preferences?.dailyGoal).toBe(20);
        expect(text()).toContain("20 Fragen pro Tag");

        const largeText = Array.from(document.querySelectorAll('input[type="checkbox"][role="switch"]')).find((el) =>
            (el.closest("label")?.textContent ?? "").includes("Größere Schrift"),
        ) as HTMLInputElement | undefined;
        expect(largeText).toBeDefined();
        click(largeText);
        await flush();
        expect(stored().preferences?.largeText).toBe(true);

        // Rest days sit behind the streak fold-out.
        expect(text()).toContain("Jedes Üben · keine Ruhetage");
        click(foldOut("streak"));
        click(byText('[role="group"][aria-label="Ruhetage"] button', "So"));
        click(byText('[role="group"][aria-label="Ruhetage"] button', "Sa"));
        await flush();
        expect(stored().preferences?.restDays).toEqual([0, 6]);
        expect(text()).toContain("2 von 3");
        expect(text()).toContain("Jedes Üben · 2 Ruhetage");

        const after = stored();
        expect(after.questionProgress).toEqual(LEGACY_USER.questionProgress);
        expect(after.dailyProgress).toEqual(LEGACY_USER.dailyProgress);
        expect(after.appFirstTimeOpenDateTime).toBe("Thu Oct 01 2026");
        expect(after.reviewNoCount).toBe(1);
        expect(after.state).toEqual(LEGACY_USER.state);
    });

    it("keeps the streak rules folded until asked", async () => {
        await mount("streak", "notifications");
        const toggle = foldOut("streak");
        expect(toggle?.getAttribute("aria-expanded")).toBe("false");
        expect(document.querySelector('#streak [role="region"]')).toBeNull();
        expect(text()).toContain("Serienregeln");
        expect(text()).toContain("Jedes Üben · keine Ruhetage");
        expect(text()).toContain("Serie und Kalender ansehen");
        expect(document.querySelector('[role="radiogroup"][aria-label="Was als Serientag zählt"]')).toBeNull();
        expect(document.querySelector('[role="group"][aria-label="Ruhetage"]')).toBeNull();
        expect(text()).not.toContain("Serienschutz");
        // The web never shows the reminders fold-out; only the apps have reminders.
        expect(foldOut("notifications")).toBeNull();

        click(toggle);
        expect(toggle?.getAttribute("aria-expanded")).toBe("true");
        expect(document.querySelector('#streak [role="region"]')).not.toBeNull();
        expect(document.querySelector('[role="group"][aria-label="Ruhetage"]')).not.toBeNull();
        expect(text()).toContain("Serienschutz");
        expect(text()).toContain("Gespeichert: 0");

        const goalRule = Array.from(document.querySelectorAll('[role="radiogroup"][aria-label="Was als Serientag zählt"] button')).find((el) =>
            (el.textContent ?? "").includes("Tagesziel"),
        );
        click(goalRule);
        await flush();
        expect(stored().preferences?.streakRule).toBe("goal");
        expect(text()).toContain("Tagesziel · keine Ruhetage");

        click(toggle);
        expect(document.querySelector('#streak [role="region"]')).toBeNull();
        expect(text()).toContain("Tagesziel · keine Ruhetage");
    });

    it("stores the exam date as a day key on the record and clears it again", async () => {
        await mount("exam");
        const input = document.getElementById("settings-exam-date") as HTMLInputElement;
        expect(input).not.toBeNull();
        setValue(input, "2099-01-15");
        await flush();
        expect(stored().examDate).toBe("2099-01-15");
        expect(text()).toMatch(/In \d+ Tagen/);

        click(byText("button", "Datum löschen"));
        await flush();
        expect(stored().examDate).toBeNull();
        expect(text()).toContain("Nicht festgelegt");
    });

    it("start over keeps state and settings but clears progress", async () => {
        await mount("practice", "data");
        click(byText('[role="radiogroup"][aria-label="Tagesziel"] button', "33"));
        await flush();
        click(byText("button span", "Von vorne beginnen")?.closest("button"));
        await flush();
        expect(document.body.textContent).toContain("Von vorne beginnen?");
        click(byText("button", "Ja, von vorne beginnen"));
        await flush();
        const after = stored();
        expect(after.questionProgress).toEqual([]);
        expect(after.dailyProgress).toEqual([]);
        expect(after.state).toEqual(LEGACY_USER.state);
        expect(after.preferences?.dailyGoal).toBe(33);
    });

    it("switches the app language from the profile page", async () => {
        await mount("profile");
        click(byText('[role="radiogroup"][aria-label="App-Sprache"] button', "English"));
        await flush();
        expect(text()).toContain("Settings");
        expect(text()).toContain("App language");
        expect(stored().appLanguage).toBe("en");
    });
});
