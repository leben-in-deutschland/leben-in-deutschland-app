/*
 * The shell picks the design for learner routes: the classic 2.0 app for a
 * learner who upgraded (with the one-time question), the modern shell for
 * everyone who chose it or is new, and nothing of either until the stored
 * choice is known. Public routes never change.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACK_EVENT } from "@/components/shell/use-back-button";
import type { User } from "@/types/user";
import { UI_MODE_KEY } from "@/utils/ui-mode";
import { createNewUser } from "@/utils/user-defaults";

const mocks = vi.hoisted(() => ({
    pathname: "/dashboard",
    push: vi.fn(),
    useAppEffects: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: mocks.push, replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => mocks.pathname,
}));
vi.mock("@/classic/classic-app", () => ({
    ClassicApp: ({ pathname }: { pathname: string }) => <div data-testid="classic-app">{pathname}</div>,
}));
// The app-wide effects (migration, engagement, Capacitor plugins) are covered elsewhere.
vi.mock("@/components/shell/use-app-effects", () => ({ useAppEffects: mocks.useAppEffects }));
vi.mock("@/components/shell/native-prompts", () => ({ NativePrompts: () => <div data-testid="native-prompts" /> }));

import { AppShell } from "@/components/shell/app-shell";

const BERLIN = { name: "Berlin", code: "BE", eng: "Berlin", capital: "Berlin" };

const PROMPT_TITLE = "Neues Design verfügbar";
const KEEP = "Beim klassischen Design bleiben";
const TRY = "Neues Design ausprobieren";

function finishedRecord(): User {
    return createNewUser({ state: BERLIN, language: "de" });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function bodyText(): string {
    return document.body.textContent ?? "";
}

function classic(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-testid="classic-app"]');
}

function page(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-testid="page"]');
}

function tabBar(): HTMLElement | null {
    return document.querySelector<HTMLElement>('nav[aria-label="Bereiche der App"]');
}

function spinner(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[aria-label="Wird geladen …"]');
}

function dialog(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="dialog"]');
}

function button(label: string): HTMLButtonElement {
    const el = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label);
    if (!el) throw new Error(`button not found: ${label}`);
    return el;
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function click(el: Element) {
    act(() => {
        el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        (el as HTMLElement).click();
    });
}

function tree() {
    return (
        <AppShell>
            <div data-testid="page">page</div>
        </AppShell>
    );
}

async function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(tree());
    });
    await flush();
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() } as any));
    (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} };
    Element.prototype.scrollIntoView = vi.fn();
    // Onboarding starts in the device language.
    Object.defineProperty(window.navigator, "language", { value: "de-DE", configurable: true });
    mocks.pathname = "/dashboard";
    mocks.push.mockReset();
    mocks.useAppEffects.mockReset();
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

describe("app shell for a learner who upgraded from 2.0", () => {
    beforeEach(() => {
        window.localStorage.setItem("user", JSON.stringify(finishedRecord()));
    });

    it("shows the classic app and asks once; keeping classic stores the answer", async () => {
        await mount();
        expect(classic()?.textContent).toBe("/dashboard");
        expect(page()).toBeNull();
        expect(tabBar()).toBeNull();
        expect(bodyText()).toContain(PROMPT_TITLE);
        expect(mocks.useAppEffects).toHaveBeenCalled();
        // The Android update and review prompts stay available in the classic design.
        expect(document.querySelector('[data-testid="native-prompts"]')).not.toBeNull();

        click(button(KEEP));
        await flush();
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("classic");
        expect(bodyText()).not.toContain(PROMPT_TITLE);
        expect(dialog()).toBeNull();
        expect(classic()).not.toBeNull();
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it("switches to the modern shell and opens Home when the learner tries the new design", async () => {
        mocks.pathname = "/settings";
        await mount();
        expect(classic()?.textContent).toBe("/settings");

        click(button(TRY));
        await flush();
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("modern");
        expect(classic()).toBeNull();
        expect(bodyText()).not.toContain(PROMPT_TITLE);
        expect(page()).not.toBeNull();
        expect(tabBar()).not.toBeNull();
        expect(mocks.push).toHaveBeenCalledWith("/dashboard");
    });

    it("counts Escape, which the Android back button sends into an open dialog, as keeping classic", async () => {
        await mount();
        const open = dialog();
        expect(open).not.toBeNull();
        act(() => {
            open!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
        });
        await flush();
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("classic");
        expect(dialog()).toBeNull();
        expect(classic()).not.toBeNull();
    });

    it("counts a claimed back press as keeping classic", async () => {
        await mount();
        let unclaimed = true;
        act(() => {
            unclaimed = window.dispatchEvent(new Event(BACK_EVENT, { cancelable: true }));
        });
        await flush();
        expect(unclaimed).toBe(false);
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("classic");
        expect(dialog()).toBeNull();
    });

    it("renders the modern shell without a prompt once the new design was chosen", async () => {
        window.localStorage.setItem(UI_MODE_KEY, "modern");
        await mount();
        expect(classic()).toBeNull();
        expect(page()).not.toBeNull();
        expect(tabBar()).not.toBeNull();
        expect(dialog()).toBeNull();
        expect(bodyText()).not.toContain(PROMPT_TITLE);
    });

    it("renders the classic app without a prompt once the classic design was chosen", async () => {
        window.localStorage.setItem(UI_MODE_KEY, "classic");
        mocks.pathname = "/practice.html";
        await mount();
        expect(classic()?.textContent).toBe("/practice.html");
        expect(page()).toBeNull();
        expect(dialog()).toBeNull();
        expect(bodyText()).not.toContain(PROMPT_TITLE);
        expect(mocks.useAppEffects).toHaveBeenCalled();
    });
});

describe("app shell for everyone else", () => {
    it("starts a new learner in the modern onboarding", async () => {
        await mount();
        expect(classic()).toBeNull();
        expect(dialog()).toBeNull();
        expect(bodyText()).toContain("Schritt 1 von 2");
        expect(page()).toBeNull();
    });

    it("shows a modern learner the page and the tab bar", async () => {
        window.localStorage.setItem("user", JSON.stringify(finishedRecord()));
        window.localStorage.setItem(UI_MODE_KEY, "modern");
        await mount();
        expect(page()).not.toBeNull();
        expect(tabBar()).not.toBeNull();
        expect(classic()).toBeNull();
    });

    it("leaves public routes alone", async () => {
        window.localStorage.setItem("user", JSON.stringify(finishedRecord()));
        mocks.pathname = "/";
        await mount();
        expect(classic()).toBeNull();
        expect(dialog()).toBeNull();
        expect(spinner()).toBeNull();
        expect(page()).not.toBeNull();
        expect(tabBar()).toBeNull();
        expect(document.querySelector("footer")).not.toBeNull();
    });

    it("prerenders learner routes as a bare spinner and public routes in full", () => {
        mocks.pathname = "/dashboard";
        const learner = renderToString(tree());
        expect(learner).toContain("Wird geladen");
        expect(learner).not.toContain('data-testid="classic-app"');
        expect(learner).not.toContain('data-testid="page"');
        expect(learner).not.toContain("<nav");
        expect(learner).not.toContain("<header");
        expect(learner).toContain("Zum Inhalt springen");

        mocks.pathname = "/";
        const home = renderToString(tree());
        expect(home).toContain('data-testid="page"');
        expect(home).toContain("<header");
        expect(home).not.toContain("Wird geladen");
    });
});
