/*
 * The one-time thank-you popup for the tip jar with the tip-jar service, the
 * owner switch and navigation mocked: opens after a passed mock exam or a
 * 7-day streak, stays away from every other learner, yields to an open
 * dialog, and every way of closing it counts as "not now" while the learner
 * record stays untouched.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/data/data";
import type { MockTestProgress, User } from "@/types/user";
import { ASK_KEY, SUPPORT_KEY } from "@/utils/support-store";
import { createNewUser } from "@/utils/user-defaults";

const mocks = vi.hoisted(() => ({
    supported: true,
    flag: true,
    tipJarSupported: vi.fn(),
    loadTipProducts: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock("@/services/tip-jar", () => ({
    TIP_PRODUCT_IDS: ["tip_small", "tip_medium", "tip_large"],
    tipJarSupported: mocks.tipJarSupported,
    loadTipProducts: mocks.loadTipProducts,
}));
vi.mock("@/components/home/use-notices", () => ({
    useNoticeFlags: () => ({ tipJar: mocks.flag }),
}));
vi.mock("@/components/ui/app-link", () => ({
    useAppNavigate: () => mocks.navigate,
}));

const PRODUCTS = [{ id: "tip_small", name: "Kaffee", price: "1,99 €" }];
const USER_RAW = '{"schemaVersion":2,"questionProgress":[{"id":"1"}]}';
const t = getTranslations("de") as unknown as Record<string, string>;

function mock(passed: boolean): MockTestProgress {
    return { datetime: "2026-10-10T10:00:00.000Z", timeTake: "00:10:00", passed, cancelled: false, questions: [] };
}

function learner(tests: MockTestProgress[] = []): User {
    const base = createNewUser({ state: { code: "BE", name: "Berlin" } as never, language: "de" }, new Date("2026-10-01T08:00:00Z"));
    return { ...base, testProgress: tests };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function dialog(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="dialog"]');
}

function dialogText(): string {
    return dialog()?.textContent ?? "";
}

async function flush(ms = 0) {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
    });
}

function click(label: string) {
    const button = Array.from(document.querySelectorAll("button")).find((el) => el.textContent?.trim() === label);
    if (!button) throw new Error(`button "${label}" not found`);
    act(() => {
        button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        button.click();
    });
}

async function mount(user: User, streakCurrent: number) {
    const { ThanksDialog } = await import("@/components/support/thanks-dialog");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<ThanksDialog user={user} streakCurrent={streakCurrent} t={t} delayMs={0} />);
    });
    await flush();
    await flush(5);
}

function storedAsk(): { asks: number; lastAskAt: unknown } | null {
    return JSON.parse(window.localStorage.getItem(ASK_KEY) ?? "null");
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", USER_RAW);
    mocks.supported = true;
    mocks.flag = true;
    mocks.tipJarSupported.mockReset().mockImplementation(() => mocks.supported);
    mocks.loadTipProducts.mockReset().mockResolvedValue(PRODUCTS);
    mocks.navigate.mockReset();
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

describe("thanks dialog", () => {
    it("congratulates after a passed mock exam and leads to the tip jar", async () => {
        await mount(learner([mock(false), mock(true)]), 0);
        expect(dialogText()).toContain(t.home_thanks_title_mock);
        expect(dialogText()).toContain(t.home_thanks_body);
        expect(mocks.loadTipProducts).toHaveBeenCalledTimes(1);
        click(t.home_thanks_tip);
        await flush();
        expect(mocks.navigate).toHaveBeenCalledWith("/settings#support");
        expect(storedAsk()?.asks).toBe(1);
    });

    it("congratulates on a seven-day streak", async () => {
        await mount(learner(), 7);
        expect(dialogText()).toContain(t.home_thanks_title_streak);
        expect(dialogText()).not.toContain(t.home_thanks_title_mock);
    });

    it("stays away from learners without a success moment", async () => {
        await mount(learner([mock(false)]), 6);
        expect(dialog()).toBeNull();
        expect(mocks.loadTipProducts).not.toHaveBeenCalled();
    });

    it("closes on 'not now', remembers the answer, and leaves the record alone", async () => {
        await mount(learner([mock(true)]), 0);
        expect(dialog()).not.toBeNull();
        click(t.home_thanks_later);
        await flush(5);
        expect(container!.innerHTML).toBe("");
        const ask = storedAsk();
        expect(ask?.asks).toBe(1);
        expect(typeof ask?.lastAskAt).toBe("string");
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(window.localStorage.getItem("user")).toBe(USER_RAW);
    });

    it("does not return for thirty days after 'not now'", async () => {
        window.localStorage.setItem(ASK_KEY, JSON.stringify({ asks: 1, lastAskAt: new Date().toISOString() }));
        await mount(learner([mock(true)]), 0);
        expect(dialog()).toBeNull();
        expect(mocks.loadTipProducts).not.toHaveBeenCalled();
    });

    it("never returns after a tip", async () => {
        window.localStorage.setItem(SUPPORT_KEY, JSON.stringify({ tips: 1, lastTipAt: "2026-10-10T10:00:00.000Z" }));
        await mount(learner([mock(true)]), 9);
        expect(dialog()).toBeNull();
        expect(mocks.loadTipProducts).not.toHaveBeenCalled();
    });

    it("respects the owner switch", async () => {
        mocks.flag = false;
        await mount(learner([mock(true)]), 0);
        expect(dialog()).toBeNull();
        expect(mocks.loadTipProducts).not.toHaveBeenCalled();
    });

    it("renders nothing where the tip jar is not supported", async () => {
        mocks.supported = false;
        await mount(learner([mock(true)]), 0);
        expect(dialog()).toBeNull();
        expect(mocks.loadTipProducts).not.toHaveBeenCalled();
    });

    it("waits for Google Play to know the products", async () => {
        mocks.loadTipProducts.mockResolvedValue([]);
        await mount(learner([mock(true)]), 0);
        expect(dialog()).toBeNull();
        expect(mocks.loadTipProducts).toHaveBeenCalledTimes(1);
    });

    it("yields to a dialog that is already open and does not count an ask", async () => {
        const other = document.createElement("div");
        other.setAttribute("role", "dialog");
        other.textContent = "another prompt";
        document.body.appendChild(other);
        await mount(learner([mock(true)]), 0);
        expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
        expect(dialogText()).toBe("another prompt");
        expect(storedAsk()).toBeNull();
    });
});
