/*
 * Renders /settings as the Android app sees it: Capacitor reports a native
 * platform and the notification service is mocked, so the permission flow of
 * the reminders switch can be checked.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReminderPreferences, User } from "@/types/user";
import { DEFAULT_PREFERENCES } from "@/utils/user-defaults";

const mocks = vi.hoisted(() => ({
    getNotificationPermission: vi.fn(),
    requestNotificationPermission: vi.fn(),
    sendTestNotification: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/settings",
}));
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: () => "android", isPluginAvailable: () => false },
}));
vi.mock("@/services/notifications", () => ({
    getNotificationPermission: mocks.getNotificationPermission,
    requestNotificationPermission: mocks.requestNotificationPermission,
    sendTestNotification: mocks.sendTestNotification,
}));
vi.mock("@/services/file", () => ({
    exportData: vi.fn(async () => true),
    importData: vi.fn(async () => "cancelled"),
}));

function record(notificationsEnabled: boolean, reminders: Partial<ReminderPreferences> = {}) {
    return {
        state: { stateCode: "BE", stateName: "Berlin" },
        dailyProgress: [],
        questionProgress: [],
        id: "",
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: "Thu Oct 01 2026",
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        preferences: { ...DEFAULT_PREFERENCES, notificationsEnabled, reminders: { ...DEFAULT_PREFERENCES.reminders, ...reminders } },
    };
}

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

function switchFor(label: string): HTMLInputElement {
    const input = Array.from(document.querySelectorAll('input[type="checkbox"][role="switch"]')).find((el) =>
        (el.closest("label")?.textContent ?? "").includes(label),
    ) as HTMLInputElement | undefined;
    if (!input) throw new Error(`switch not found: ${label}`);
    return input;
}

function byText(selector: string, needle: string): Element | undefined {
    return Array.from(document.querySelectorAll(selector)).find((el) => (el.textContent ?? "").trim() === needle);
}

/** The fold-out toggle of a settings section, or null while the section has none. */
function foldOut(sectionId: string): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>(`#${sectionId} button[aria-expanded]`);
}

/** The opened fold-out panel of a settings section. */
function foldOutRegion(sectionId: string): Element | null {
    return document.querySelector(`#${sectionId} [role="region"]`);
}

function setValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

async function mount() {
    window.history.replaceState({}, "", "/settings");
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
    window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() } as any));
    (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} };
    Element.prototype.scrollIntoView = vi.fn();
    mocks.getNotificationPermission.mockReset().mockResolvedValue("prompt");
    mocks.requestNotificationPermission.mockReset().mockResolvedValue("granted");
    mocks.sendTestNotification.mockReset().mockResolvedValue(true);
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

describe("settings page in the Android app", () => {
    it("shows Android-only rows", async () => {
        window.localStorage.setItem("user", JSON.stringify(record(true)));
        await mount();
        expect(text()).toContain("Vibration");
        expect(text()).toContain("App bewerten");
        expect(text()).toContain("Noch nicht gefragt");
        expect(text()).toContain("Erinnerungen");
        expect(text()).toContain("Testbenachrichtigung senden");
        expect(text()).not.toContain("nur in der Android-App");
        const playStore = container!.querySelector('a[href^="https://play.google.com/"]');
        expect(playStore?.getAttribute("target")).toBe("_blank");
    });

    it("keeps both fold-outs closed until asked", async () => {
        window.localStorage.setItem("user", JSON.stringify(record(true)));
        await mount();
        for (const section of ["notifications", "streak"]) {
            expect(foldOut(section)?.getAttribute("aria-expanded")).toBe("false");
            expect(foldOutRegion(section)).toBeNull();
        }
        expect(text()).toContain("Feinabstimmung");
        expect(text()).toContain("6 von 6 aktiv");
        expect(text()).not.toContain("Tägliche Erinnerung");
        expect(text()).not.toContain("Serie in Gefahr");
        expect(document.querySelectorAll('input[type="time"]')).toHaveLength(0);
        expect(text()).toContain("Serienregeln");
        expect(document.querySelector('[role="group"][aria-label="Ruhetage"]')).toBeNull();

        click(foldOut("notifications"));
        expect(foldOut("notifications")?.getAttribute("aria-expanded")).toBe("true");
        expect(foldOutRegion("notifications")).not.toBeNull();
        expect(text()).toContain("Tägliche Erinnerung");
        expect(text()).toContain("Serie in Gefahr");
        expect(text()).toContain("Prüfungs-Countdown");
        expect(text()).toContain("Wochenrückblick");
        expect(text()).toContain("Probeprüfungs-Tipp");
        expect(text()).toContain("Komm-zurück-Erinnerungen");
        expect(document.querySelectorAll('input[type="time"]')).toHaveLength(2);
        // The streak fold-out keeps its own state.
        expect(foldOutRegion("streak")).toBeNull();

        click(foldOut("notifications"));
        expect(foldOutRegion("notifications")).toBeNull();
        expect(text()).not.toContain("Tägliche Erinnerung");
    });

    it("counts the switched-on reminders in the fold-out summary", async () => {
        window.localStorage.setItem(
            "user",
            JSON.stringify(record(true, { streak: false, weekly: false, examCountdown: false, mockNudge: false, comeback: false })),
        );
        await mount();
        expect(text()).toContain("1 von 6 aktiv");

        click(foldOut("notifications"));
        expect(switchFor("Tägliche Erinnerung").checked).toBe(true);
        expect(switchFor("Wochenrückblick").checked).toBe(false);

        click(switchFor("Wochenrückblick"));
        await flush();
        expect(stored().preferences?.reminders.weekly).toBe(true);
        expect(text()).toContain("2 von 6 aktiv");

        click(switchFor("Prüfungs-Countdown"));
        await flush();
        expect(stored().preferences?.reminders.examCountdown).toBe(true);
        expect(stored().preferences?.reminders.daily).toBe(true);
        expect(text()).toContain("3 von 6 aktiv");
        // Opening the panel changed nothing else on the record.
        expect(stored().preferences?.notificationsEnabled).toBe(true);
        expect(stored().preferences?.reminders.dailyTime).toBe("07:00");
    });

    it("keeps reminders off when Android denies the permission", async () => {
        window.localStorage.setItem("user", JSON.stringify(record(false)));
        mocks.requestNotificationPermission.mockResolvedValue("denied");
        await mount();
        expect(switchFor("Erinnerungen").checked).toBe(false);
        expect(foldOut("notifications")).toBeNull();

        click(switchFor("Erinnerungen"));
        await flush();
        expect(mocks.requestNotificationPermission).toHaveBeenCalledTimes(1);
        expect(stored().preferences?.notificationsEnabled).toBe(false);
        expect(switchFor("Erinnerungen").checked).toBe(false);
        expect(text()).toContain("Blockiert");
        expect(text()).toContain("Android-Einstellungen");
        expect(foldOut("notifications")).toBeNull();
        expect(text()).not.toContain("Feinabstimmung");
    });

    it("turns reminders on after the permission is granted and saves times", async () => {
        window.localStorage.setItem("user", JSON.stringify(record(false)));
        await mount();
        expect(foldOut("notifications")).toBeNull();
        click(switchFor("Erinnerungen"));
        await flush();
        expect(stored().preferences?.notificationsEnabled).toBe(true);
        expect(switchFor("Erinnerungen").checked).toBe(true);
        expect(foldOut("notifications")?.getAttribute("aria-expanded")).toBe("false");

        click(foldOut("notifications"));
        const time = Array.from(document.querySelectorAll('input[type="time"]'))[0] as HTMLInputElement;
        expect(time.value).toBe("07:00");
        setValue(time, "07:15");
        await flush();
        expect(stored().preferences?.reminders.dailyTime).toBe("07:15");

        click(switchFor("Wochenrückblick"));
        await flush();
        expect(stored().preferences?.reminders.weekly).toBe(false);
        expect(text()).toContain("5 von 6 aktiv");

        click(byText("button", "Testbenachrichtigung senden"));
        await flush();
        expect(mocks.sendTestNotification).toHaveBeenCalledTimes(1);
        // The test card is built for the current learner, so the plugin shows the real format.
        const [translations, learner] = mocks.sendTestNotification.mock.calls[0] as [Record<string, string>, User];
        expect(translations.settings_test_notification).toBe("Testbenachrichtigung senden");
        expect(learner).toMatchObject({ state: { stateCode: "BE" }, preferences: { notificationsEnabled: true } });
        expect(learner.preferences?.reminders.dailyTime).toBe("07:15");

        // Switching the master off takes the fold-out with it.
        click(switchFor("Erinnerungen"));
        await flush();
        expect(stored().preferences?.notificationsEnabled).toBe(false);
        expect(foldOut("notifications")).toBeNull();
        expect(stored().preferences?.reminders.weekly).toBe(false);
    });
});
