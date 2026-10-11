/*
 * Walks through the first-run flow in jsdom: two steps on the web, three in
 * the Android app (Capacitor reports a native platform, so the reminders step
 * appears), and checks the record that gets written.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACK_EVENT } from "@/components/shell/use-back-button";
import type { User } from "@/types/user";
import { UI_MODE_KEY } from "@/utils/ui-mode";
import { DEFAULT_PREFERENCES, prefsOf } from "@/utils/user-defaults";

const mocks = vi.hoisted(() => ({
    native: false,
    requestNotificationPermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/dashboard",
}));
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => mocks.native, getPlatform: () => (mocks.native ? "android" : "web") },
    registerPlugin: () => ({ addListener: vi.fn(async () => ({ remove: vi.fn() })), minimizeApp: vi.fn() }),
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })), minimizeApp: vi.fn() } }));
vi.mock("@/services/notifications", () => ({
    requestNotificationPermission: mocks.requestNotificationPermission,
    getNotificationPermission: vi.fn(async () => "prompt"),
    sendTestNotification: vi.fn(),
    syncNativeNotifications: vi.fn(async () => 0),
    addNotificationTapListener: () => () => undefined,
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function text(): string {
    return container?.textContent ?? "";
}

function stored(): User | null {
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
    return Array.from(container!.querySelectorAll(selector)).find((el) => (el.textContent ?? "").trim() === needle);
}

function button(label: string): HTMLButtonElement {
    const el = byText("button", label);
    if (!el) throw new Error(`button not found: ${label}`);
    return el as HTMLButtonElement;
}

function switchFor(label: string): HTMLInputElement {
    const input = Array.from(container!.querySelectorAll('input[type="checkbox"][role="switch"]')).find((el) =>
        (el.closest("label")?.textContent ?? "").includes(label),
    ) as HTMLInputElement | undefined;
    if (!input) throw new Error(`switch not found: ${label}`);
    return input;
}

function setValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

function setDeviceLanguage(tag: string) {
    Object.defineProperty(window.navigator, "language", { value: tag, configurable: true });
}

function pressBack() {
    act(() => {
        window.dispatchEvent(new Event(BACK_EVENT, { cancelable: true }));
    });
}

/** A record written by version 2.0: progress, but no state and no onboarding flag. */
function legacyRecord(extra: Record<string, unknown> = {}) {
    return {
        state: { stateCode: "", stateName: "" },
        dailyProgress: [{ date: "Thu Oct 08 2026", correct: 3, incorrect: 1, attempted: 4, skipped: 0, flagged: 0 }],
        questionProgress: [{ num: "12", answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false }],
        id: "",
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: "Thu Oct 01 2026",
        lastReviewPromptDateTime: null,
        reviewNoCount: 1,
        userReviewed: false,
        ...extra,
    };
}

async function mount() {
    const { OnboardingFlow } = await import("@/components/onboarding/onboarding-flow");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<OnboardingFlow />);
    });
    await flush();
}

async function unmount() {
    if (root) {
        await act(async () => root!.unmount());
    }
    container?.remove();
    root = null;
    container = null;
}

/** Chooses the first state matching `query` and moves on to the goal step. */
async function chooseState(query: string, continueLabel: string) {
    const search = container!.querySelector('input[placeholder]') as HTMLInputElement;
    setValue(search, query);
    await flush();
    click(container!.querySelector('[role="option"] button'));
    await flush();
    click(button(continueLabel));
    await flush();
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() } as any));
    (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} };
    Element.prototype.scrollIntoView = vi.fn();
    mocks.native = false;
    mocks.requestNotificationPermission.mockReset().mockResolvedValue("granted");
    setDeviceLanguage("de-DE");
});

afterEach(async () => {
    await unmount();
    document.body.innerHTML = "";
});

describe("onboarding flow on the web", () => {
    it("creates a complete record for a new learner in two steps", async () => {
        await mount();
        expect(stored()).toBeNull();
        expect(text()).toContain("Schritt 1 von 2");
        expect(text()).toContain("Willkommen bei Leben in Deutschland");
        expect(text()).toContain("Wo wohnst du?");

        // The language switch sits on the first step and re-renders the whole flow at once.
        click(byText('[role="radio"]', "English"));
        await flush();
        expect(text()).toContain("Step 1 of 2");
        expect(text()).toContain("Welcome to Leben in Deutschland");
        expect(text()).toContain("Where do you live?");

        expect(button("Continue").disabled).toBe(true);
        expect(container!.querySelectorAll('[role="option"]').length).toBe(16);
        const search = container!.querySelector('input[placeholder="Search states"]') as HTMLInputElement;
        setValue(search, "bay");
        await flush();
        expect(container!.querySelectorAll('[role="option"]').length).toBe(1);
        click(container!.querySelector('[role="option"] button'));
        await flush();
        expect(text()).toContain("Step 1 of 2");
        expect(container!.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain("Bayern");
        expect(button("Continue").disabled).toBe(false);
        click(button("Continue"));
        await flush();

        expect(text()).toContain("Step 2 of 2");
        expect(text()).toContain("Recommended");
        expect(byText("button", "Continue")).toBeUndefined();
        click(byText('[role="radiogroup"] button span span span', "Serious")?.closest("button"));
        expect(stored()).toBeNull();
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBeNull();
        click(button("Start learning"));
        await flush();

        const user = stored();
        expect(user).not.toBeNull();
        expect(user!.state).toEqual({ stateCode: "BY", stateName: "Bayern" });
        expect(user!.appLanguage).toBe("en");
        expect(user!.onboardingCompleted).toBe(true);
        expect(user!.examDate).toBeNull();
        expect(prefsOf(user!).dailyGoal).toBe(20);
        expect(prefsOf(user!).notificationsEnabled).toBe(DEFAULT_PREFERENCES.notificationsEnabled);
        expect(user!.questionProgress).toEqual([]);
        // A new learner uses the new design; no "try the new design" question later.
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("modern");
    });

    it("goes back to the state step, keeps the choice, and never asks for an exam date", async () => {
        await mount();
        await chooseState("berlin", "Weiter");
        expect(text()).toContain("Schritt 2 von 2");
        expect(byText("button", "Weiter")).toBeUndefined();

        pressBack();
        await flush();
        expect(text()).toContain("Schritt 1 von 2");
        expect(container!.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain("Berlin");
        expect(button("Weiter").disabled).toBe(false);
        click(button("Weiter"));
        await flush();

        click(button("Zurück"));
        await flush();
        expect(text()).toContain("Schritt 1 von 2");
        click(button("Weiter"));
        await flush();

        expect(text()).not.toContain("Wann ist deine Prüfung?");
        expect(container!.querySelector('input[type="date"]')).toBeNull();
        click(button("Mit dem Lernen beginnen"));
        await flush();
        const user = stored()!;
        expect(user.state.stateCode).toBe("BE");
        expect(user.examDate).toBeNull();
        expect(user.appLanguage).toBe("de");
        expect(prefsOf(user).dailyGoal).toBe(10);
        expect(user.onboardingCompleted).toBe(true);
    });

    it("keeps the progress and the exam date of an existing record that has no state", async () => {
        window.localStorage.setItem("user", JSON.stringify(legacyRecord({ examDate: "2026-12-01" })));
        await mount();
        expect(text()).toContain("Schritt 1 von 2");
        await chooseState("hamburg", "Weiter");
        click(button("Mit dem Lernen beginnen"));
        await flush();
        const user = stored()!;
        expect(user.state).toEqual({ stateCode: "HH", stateName: "Hamburg" });
        expect(user.onboardingCompleted).toBe(true);
        expect(user.examDate).toBe("2026-12-01");
        expect(user.questionProgress).toHaveLength(1);
        expect(user.dailyProgress).toHaveLength(1);
        expect(user.appFirstTimeOpenDateTime).toBe("Thu Oct 01 2026");
        expect(user.reviewNoCount).toBe(1);
        // A 2.0 record without a state finishes onboarding in the new design.
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("modern");
    });
});

describe("onboarding language", () => {
    it("starts in German on a German device", async () => {
        setDeviceLanguage("de-AT");
        await mount();
        expect(text()).toContain("Schritt 1 von 2");
        expect(container!.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe("Deutsch");
    });

    it("starts in English on any other device and saves that language", async () => {
        setDeviceLanguage("tr-TR");
        await mount();
        expect(text()).toContain("Step 1 of 2");
        expect(container!.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe("English");
        await chooseState("bremen", "Continue");
        click(button("Start learning"));
        await flush();
        expect(stored()!.appLanguage).toBe("en");
    });

    it("lets a stored record's language win over the device", async () => {
        setDeviceLanguage("de-DE");
        window.localStorage.setItem("user", JSON.stringify(legacyRecord({ appLanguage: "en" })));
        await mount();
        expect(text()).toContain("Step 1 of 2");
        await unmount();

        setDeviceLanguage("tr-TR");
        window.localStorage.setItem("user", JSON.stringify(legacyRecord({ appLanguage: "de" })));
        await mount();
        expect(text()).toContain("Schritt 1 von 2");
    });

    it("lets a language chosen before onboarding win over the device", async () => {
        setDeviceLanguage("tr-TR");
        window.localStorage.setItem("app-language", "de");
        await mount();
        expect(text()).toContain("Schritt 1 von 2");
    });
});

describe("onboarding flow in the Android app", () => {
    beforeEach(() => {
        mocks.native = true;
    });

    /** State and goal, then the reminders step. */
    async function reachReminders() {
        await mount();
        expect(text()).toContain("Schritt 1 von 3");
        await chooseState("dresden", "Weiter");
        expect(text()).toContain("Schritt 2 von 3");
        expect(byText("button", "Mit dem Lernen beginnen")).toBeUndefined();
        click(button("Weiter"));
        await flush();
        expect(text()).toContain("Schritt 3 von 3");
        expect(text()).toContain("Möchtest du eine tägliche Erinnerung?");
    }

    it("shows three steps and finishes from the reminders step once the permission is granted", async () => {
        await reachReminders();
        expect(button("Mit dem Lernen beginnen").disabled).toBe(true);
        expect(switchFor("Erinnere mich jeden Tag").checked).toBe(false);

        click(switchFor("Erinnere mich jeden Tag"));
        await flush();
        expect(mocks.requestNotificationPermission).toHaveBeenCalledTimes(1);
        expect(switchFor("Erinnere mich jeden Tag").checked).toBe(true);
        expect(button("Mit dem Lernen beginnen").disabled).toBe(false);
        setValue(container!.querySelector('input[type="time"]') as HTMLInputElement, "07:15");
        await flush();

        expect(stored()).toBeNull();
        click(button("Mit dem Lernen beginnen"));
        await flush();
        const user = stored()!;
        expect(user.onboardingCompleted).toBe(true);
        expect(user.state.stateCode).toBe("SN");
        expect(user.examDate).toBeNull();
        const prefs = prefsOf(user);
        expect(prefs.notificationsEnabled).toBe(true);
        expect(prefs.reminders.daily).toBe(true);
        expect(prefs.reminders.dailyTime).toBe("07:15");
    });

    it("finishes with reminders off on \"Not now\"", async () => {
        await reachReminders();
        click(button("Jetzt nicht"));
        await flush();
        expect(mocks.requestNotificationPermission).not.toHaveBeenCalled();
        const user = stored()!;
        expect(user.onboardingCompleted).toBe(true);
        expect(prefsOf(user).notificationsEnabled).toBe(false);
        expect(prefsOf(user).reminders.daily).toBe(DEFAULT_PREFERENCES.reminders.daily);
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("modern");
    });

    it("keeps the finish button disabled while Android denies the permission", async () => {
        mocks.requestNotificationPermission.mockResolvedValue("denied");
        await reachReminders();
        click(switchFor("Erinnere mich jeden Tag"));
        await flush();
        expect(switchFor("Erinnere mich jeden Tag").checked).toBe(false);
        expect(text()).toContain("Benachrichtigungen sind blockiert");
        expect(button("Mit dem Lernen beginnen").disabled).toBe(true);
        expect(stored()).toBeNull();
    });
});
