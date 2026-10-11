/*
 * Renders the real /settings page in jsdom with a record written by version
 * 2.0 (no preferences, no onboarding flag) and checks that every change goes
 * through the store without disturbing the legacy fields.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/types/user";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/settings",
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

async function mount(hash = "") {
    window.history.replaceState({}, "", `/settings${hash}`);
    const { default: SettingsPage } = await import("@/app/settings/page");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<SettingsPage />);
    });
    await flush();
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", JSON.stringify(LEGACY_USER));
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

describe("settings page smoke", () => {
    it("renders every section in German for a legacy record", async () => {
        await mount();
        for (const heading of ["Profil", "Üben", "Prüfung", "Serie", "Mitteilungen", "Deine Daten", "Über die App"]) {
            expect(text()).toContain(heading);
        }
        expect(text()).toContain("Berlin");
        expect(text()).toContain("10 Fragen pro Tag");
        for (const id of ["exam", "streak", "notifications"]) {
            expect(document.getElementById(id)).not.toBeNull();
        }
        // Reminders live in the Android app; the web shows a note and the weekly tips switch.
        expect(text()).toContain("nur in der Android-App");
        expect(text()).toContain("Wöchentliche Tipps");
        expect(text()).toContain("Version");
    });

    it("writes preference changes without touching legacy fields", async () => {
        await mount();
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
        await mount();
        const toggle = foldOut("streak");
        expect(toggle?.getAttribute("aria-expanded")).toBe("false");
        expect(document.querySelector('#streak [role="region"]')).toBeNull();
        expect(text()).toContain("Serienregeln");
        expect(text()).toContain("Jedes Üben · keine Ruhetage");
        expect(text()).toContain("Serie und Kalender ansehen");
        expect(document.querySelector('[role="radiogroup"][aria-label="Was als Serientag zählt"]')).toBeNull();
        expect(document.querySelector('[role="group"][aria-label="Ruhetage"]')).toBeNull();
        expect(text()).not.toContain("Serienschutz");
        // The web never shows the reminders fold-out; only the Android app has reminders.
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
        await mount();
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
        await mount();
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

    it("scrolls to the section named in the hash", async () => {
        await mount("#notifications");
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        });
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it("switches the app language from the profile section", async () => {
        await mount();
        click(byText('[role="radiogroup"][aria-label="App-Sprache"] button', "English"));
        await flush();
        expect(text()).toContain("Settings");
        expect(text()).toContain("Daily goal");
        expect(stored().appLanguage).toBe("en");
    });
});
