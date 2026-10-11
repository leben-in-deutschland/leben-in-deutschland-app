/*
 * The "Design" section of the modern settings: it names the design in use
 * and switches back to the classic (2.0) design with a toast and a trip Home.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UI_MODE_KEY } from "@/utils/ui-mode";

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: mocks.push, replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/settings",
}));
vi.mock("react-toastify", () => ({ toast: mocks.toast }));

const USER_RECORD = JSON.stringify({
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
    onboardingCompleted: true,
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function text(): string {
    return container?.textContent ?? "";
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function click(el: Element | null | undefined) {
    if (!el) throw new Error("element not found");
    act(() => {
        (el as HTMLElement).click();
    });
}

function button(label: string): HTMLButtonElement {
    const el = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label);
    if (!el) throw new Error(`button not found: ${label}`);
    return el;
}

async function mount() {
    const { UiModeSection } = await import("@/components/preferences/ui-mode-section");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<UiModeSection />);
    });
    await flush();
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", USER_RECORD);
    window.localStorage.setItem(UI_MODE_KEY, "modern");
    mocks.push.mockReset();
    mocks.toast.success.mockReset();
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

describe("design section", () => {
    it("names the current design and offers the classic one", async () => {
        await mount();
        expect(document.getElementById("design")).not.toBeNull();
        expect(text()).toContain("Design");
        expect(text()).toContain("Wähle zwischen dem neuen und dem klassischen Aussehen");
        expect(text()).toContain("Neues Design");
        expect(button("Zum klassischen Design wechseln")).toBeDefined();
    });

    it("switches to the classic design, says so, and goes Home", async () => {
        await mount();
        click(button("Zum klassischen Design wechseln"));
        await flush();
        expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("classic");
        expect(mocks.toast.success).toHaveBeenCalledWith("Klassisches Design aktiviert");
        expect(mocks.push).toHaveBeenCalledWith("/dashboard");
        // The record itself is not touched by the switch.
        expect(window.localStorage.getItem("user")).toBe(USER_RECORD);
    });
});
