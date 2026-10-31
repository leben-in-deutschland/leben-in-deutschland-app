/*
 * The support (tip jar) section of the settings page with the tip-jar service
 * mocked: hidden without products, three buttons with the products, a counted
 * thanks after a confirmed tip, and the learner record untouched throughout.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_KEY } from "@/utils/support-store";

const mocks = vi.hoisted(() => ({
    supported: true,
    tipJarSupported: vi.fn(),
    loadTipProducts: vi.fn(),
    sendTip: vi.fn(),
    recoverTips: vi.fn(),
    toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: () => "android", isPluginAvailable: () => false },
}));
vi.mock("@/services/tip-jar", () => ({
    TIP_PRODUCT_IDS: ["tip_small", "tip_medium", "tip_large"],
    tipJarSupported: mocks.tipJarSupported,
    loadTipProducts: mocks.loadTipProducts,
    sendTip: mocks.sendTip,
    recoverTips: mocks.recoverTips,
}));
vi.mock("react-toastify", () => ({ toast: mocks.toast }));

const PRODUCTS = [
    { id: "tip_small", name: "Kaffee", price: "1,99 €" },
    { id: "tip_medium", name: "Kuchen", price: "4,99 €" },
    { id: "tip_large", name: "Abendessen", price: "9,99 €" },
];

const USER_RECORD = JSON.stringify({
    state: { stateCode: "BE", stateName: "Berlin" },
    dailyProgress: [],
    questionProgress: [{ id: "7", answeredCorrectly: 2 }],
    id: "",
    testProgress: [],
    appLanguage: "de",
    appFirstTimeOpenDateTime: "Thu Oct 01 2026",
    lastReviewPromptDateTime: null,
    reviewNoCount: 0,
    userReviewed: false,
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
        el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        (el as HTMLElement).click();
    });
}

function tipButtons(): HTMLButtonElement[] {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('#support [role="group"] button'));
}

async function mount() {
    const { SupportSection } = await import("@/components/preferences/support-section");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<SupportSection />);
    });
    await flush();
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", USER_RECORD);
    mocks.tipJarSupported.mockReset().mockImplementation(() => mocks.supported);
    mocks.supported = true;
    mocks.loadTipProducts.mockReset().mockResolvedValue(PRODUCTS);
    mocks.sendTip.mockReset().mockResolvedValue("purchased");
    mocks.recoverTips.mockReset().mockResolvedValue(0);
    mocks.toast.success.mockReset();
    mocks.toast.info.mockReset();
    mocks.toast.error.mockReset();
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

describe("support section", () => {
    it("renders nothing where the tip jar is not supported", async () => {
        mocks.supported = false;
        await mount();
        expect(container!.innerHTML).toBe("");
        expect(mocks.loadTipProducts).not.toHaveBeenCalled();
        expect(mocks.recoverTips).not.toHaveBeenCalled();
    });

    it("stays hidden until Google Play returns products", async () => {
        mocks.loadTipProducts.mockResolvedValue([]);
        await mount();
        expect(container!.innerHTML).toBe("");
        expect(mocks.recoverTips).toHaveBeenCalledTimes(1);
        expect(mocks.loadTipProducts).toHaveBeenCalledTimes(1);
    });

    it("shows one button per product with name and price", async () => {
        await mount();
        expect(document.getElementById("support")).not.toBeNull();
        expect(text()).toContain("Unterstützen");
        expect(text()).toContain("kleinen Trinkgeld");
        expect(text()).toContain("abgewickelt (Google Play)");
        const buttons = tipButtons();
        expect(buttons.map((b) => b.textContent)).toEqual(["Kaffee1,99 €", "Kuchen4,99 €", "Abendessen9,99 €"]);
        expect(buttons[1].getAttribute("aria-label")).toBe("Kuchen: 4,99 € Trinkgeld geben");
        expect(text()).not.toContain("Danke!");
    });

    it("counts a confirmed tip, thanks the learner, and leaves the record alone", async () => {
        await mount();
        click(tipButtons()[1]);
        await flush();
        expect(mocks.sendTip).toHaveBeenCalledWith("tip_medium");
        expect(mocks.toast.success).toHaveBeenCalledTimes(1);
        expect(text()).toContain("Du hast 1-mal Trinkgeld gegeben. Danke!");
        const stored = JSON.parse(window.localStorage.getItem(SUPPORT_KEY) ?? "null");
        expect(stored.tips).toBe(1);
        expect(typeof stored.lastTipAt).toBe("string");

        click(tipButtons()[0]);
        await flush();
        expect(text()).toContain("Du hast 2-mal Trinkgeld gegeben. Danke!");
        expect(window.localStorage.getItem("user")).toBe(USER_RECORD);
    });

    it("explains pending and failed outcomes without counting them", async () => {
        await mount();
        mocks.sendTip.mockResolvedValueOnce("pending");
        click(tipButtons()[0]);
        await flush();
        expect(mocks.toast.info).toHaveBeenCalledTimes(1);

        mocks.sendTip.mockResolvedValueOnce("cancelled");
        click(tipButtons()[0]);
        await flush();

        mocks.sendTip.mockResolvedValueOnce("failed");
        click(tipButtons()[0]);
        await flush();
        expect(mocks.toast.error).toHaveBeenCalledTimes(1);

        expect(mocks.toast.success).not.toHaveBeenCalled();
        expect(window.localStorage.getItem(SUPPORT_KEY)).toBeNull();
        expect(text()).not.toContain("Danke!");
    });

    it("counts tips recovered at start and shows the stored total", async () => {
        window.localStorage.setItem(SUPPORT_KEY, JSON.stringify({ tips: 3, lastTipAt: "2026-01-01T00:00:00.000Z" }));
        mocks.recoverTips.mockResolvedValue(2);
        await mount();
        expect(text()).toContain("Du hast 5-mal Trinkgeld gegeben. Danke!");
        expect(JSON.parse(window.localStorage.getItem(SUPPORT_KEY) ?? "null").tips).toBe(5);
    });

    it("disables the other tips while one purchase is open", async () => {
        let finish: (outcome: string) => void = () => undefined;
        mocks.sendTip.mockImplementationOnce(() => new Promise<string>((resolve) => (finish = resolve)));
        await mount();
        click(tipButtons()[2]);
        await flush();
        const [small, medium] = tipButtons();
        expect(small.disabled || small.getAttribute("aria-disabled") === "true" || small.dataset.disabled === "true").toBe(true);
        expect(medium.disabled || medium.getAttribute("aria-disabled") === "true" || medium.dataset.disabled === "true").toBe(true);
        await act(async () => finish("cancelled"));
        await flush();
        expect(tipButtons().every((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true")).toBe(true);
    });
});
