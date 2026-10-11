/*
 * The classic (2.0) settings dialog on the 2.1 data layer: its new "Design"
 * row switches to the modern interface, "start over" clears progress through
 * the shared reset (2.1 fields included) while keeping state and language,
 * and the state and language rows keep the record's progress.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HeroUIProvider } from "@heroui/system";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/types/user";
import { UI_MODE_KEY } from "@/utils/ui-mode";
import DEVICE_RECORD from "../fixtures/legacy-user-2.0-device.json";

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    exportData: vi.fn(async () => true),
    importData: vi.fn(async () => "cancelled"),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: mocks.push, replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/dashboard",
}));
vi.mock("@/services/file", () => ({
    exportData: mocks.exportData,
    importData: mocks.importData,
}));

import UserSetting from "@/classic/components/settings/user-setting";

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const onClose = vi.fn();

function bodyText(): string {
    return document.body.textContent ?? "";
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

function button(label: string): HTMLButtonElement {
    const el = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label);
    if (!el) throw new Error(`button not found: ${label}`);
    return el;
}

async function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(
            <HeroUIProvider>
                <UserSetting isOpen={true} handleUserSettingsClose={onClose} />
            </HeroUIProvider>,
        );
    });
    await flush();
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
    mocks.exportData.mockClear();
    mocks.importData.mockClear();
    onClose.mockReset();
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

describe("classic settings dialog", () => {
    it("shows the 2.0 rows and the new Design row", async () => {
        await mount();
        expect(bodyText()).toContain("Einstellungen");
        expect(bodyText()).toContain("Bundesland ändern");
        expect(bodyText()).toContain("App-Sprache");
        expect(bodyText()).toContain("Design");
        expect(bodyText()).toContain("Wähle zwischen dem neuen und dem klassischen Aussehen der App.");
        expect(button("Zum neuen Design wechseln")).toBeDefined();
        expect(button("Importieren")).toBeDefined();
        expect(button("Exportieren")).toBeDefined();
        expect(button("Von vorne beginnen")).toBeDefined();
    });

    it("switches to the modern design, closes, and goes to the dashboard", async () => {
        await mount();
        click(button("Zum neuen Design wechseln"));
        await flush();
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("modern");
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(mocks.push).toHaveBeenCalledWith("/dashboard");
        // The record itself is not touched by the switch.
        expect(stored()).toEqual(DEVICE_RECORD);
    });

    it("starts over through the shared reset and keeps state and language", async () => {
        await mount();
        click(button("Von vorne beginnen"));
        await flush();
        expect(bodyText()).toContain("Sind Sie sicher, dass Sie von vorne beginnen möchten?");
        click(button("Ja, von vorne beginnen"));
        await flush();

        const user = stored();
        expect(user.questionProgress).toEqual([]);
        expect(user.testProgress).toEqual([]);
        expect(user.dailyProgress).toEqual([]);
        expect(user.reviewSchedule).toEqual([]);
        expect(user.achievements).toEqual([]);
        expect(user.state).toEqual(DEVICE_RECORD.state);
        expect(user.appLanguage).toBe("de");
        expect(user.preferences).toBeDefined();
        // The design choice is a separate setting and survives a reset.
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("classic");
    });

    it("cancels start over without touching the record", async () => {
        await mount();
        click(button("Von vorne beginnen"));
        await flush();
        click(button("Nein, Abbrechen"));
        await flush();
        expect(stored()).toEqual(DEVICE_RECORD);
    });

    it("runs import and export through the shared file service", async () => {
        await mount();
        click(button("Exportieren"));
        click(button("Importieren"));
        await flush();
        expect(mocks.exportData).toHaveBeenCalledTimes(1);
        expect(mocks.importData).toHaveBeenCalledTimes(1);
    });
});
