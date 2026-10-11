/*
 * The tip-jar service against a mocked Capacitor bridge: the plugin is only
 * registered where it exists, every failure becomes a quiet return value, and
 * odd native answers are never trusted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    platform: "android",
    pluginAvailable: true,
    plugin: {
        getProducts: vi.fn(),
        purchase: vi.fn(),
        recoverPurchases: vi.fn(),
    },
    registerPlugin: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
    Capacitor: {
        getPlatform: () => mocks.platform,
        isPluginAvailable: (name: string) => name === "TipJar" && mocks.pluginAvailable,
    },
    registerPlugin: mocks.registerPlugin,
}));

async function load() {
    vi.resetModules();
    return import("@/services/tip-jar");
}

beforeEach(() => {
    mocks.platform = "android";
    mocks.pluginAvailable = true;
    mocks.plugin.getProducts.mockReset();
    mocks.plugin.purchase.mockReset();
    mocks.plugin.recoverPurchases.mockReset();
    mocks.registerPlugin.mockReset().mockReturnValue(mocks.plugin);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("tip jar service", () => {
    it("is unsupported on the web and never registers the plugin there", async () => {
        mocks.platform = "web";
        const tipJar = await load();
        expect(tipJar.tipJarSupported()).toBe(false);
        expect(await tipJar.loadTipProducts()).toEqual([]);
        expect(await tipJar.sendTip("tip_small")).toBe("unavailable");
        expect(await tipJar.recoverTips()).toBe(0);
        expect(mocks.registerPlugin).not.toHaveBeenCalled();
    });

    it("is unsupported on Android builds without the native plugin", async () => {
        mocks.pluginAvailable = false;
        const tipJar = await load();
        expect(tipJar.tipJarSupported()).toBe(false);
        expect(await tipJar.loadTipProducts()).toEqual([]);
        expect(mocks.registerPlugin).not.toHaveBeenCalled();
    });

    it("registers the plugin once and asks for the three tips in order", async () => {
        mocks.plugin.getProducts.mockResolvedValue({
            available: true,
            products: [
                { id: "tip_small", name: "Kaffee", price: "1,99 €", currency: "EUR" },
                { id: "tip_large", name: "Abendessen", price: "9,99 €", currency: "EUR" },
            ],
        });
        const tipJar = await load();
        expect(tipJar.tipJarSupported()).toBe(true);
        const products = await tipJar.loadTipProducts();
        await tipJar.loadTipProducts();
        expect(mocks.registerPlugin).toHaveBeenCalledTimes(1);
        expect(mocks.registerPlugin).toHaveBeenCalledWith("TipJar");
        expect(mocks.plugin.getProducts).toHaveBeenCalledWith({ ids: ["tip_small", "tip_medium", "tip_large"] });
        expect(products).toEqual([
            { id: "tip_small", name: "Kaffee", price: "1,99 €" },
            { id: "tip_large", name: "Abendessen", price: "9,99 €" },
        ]);
    });

    it("returns no products while Google Play is unavailable or answers oddly", async () => {
        const tipJar = await load();
        mocks.plugin.getProducts.mockResolvedValueOnce({ available: false, products: [] });
        expect(await tipJar.loadTipProducts()).toEqual([]);
        mocks.plugin.getProducts.mockResolvedValueOnce({ available: true, products: [{ id: "tip_small" }, null, { id: "", name: "x", price: "1 €" }] });
        expect(await tipJar.loadTipProducts()).toEqual([]);
        mocks.plugin.getProducts.mockResolvedValueOnce(undefined);
        expect(await tipJar.loadTipProducts()).toEqual([]);
        mocks.plugin.getProducts.mockRejectedValueOnce(new Error("bridge down"));
        expect(await tipJar.loadTipProducts()).toEqual([]);
    });

    it("passes purchase outcomes through and treats anything else as failed", async () => {
        const tipJar = await load();
        for (const state of ["purchased", "pending", "cancelled", "unavailable", "failed"]) {
            mocks.plugin.purchase.mockResolvedValueOnce({ state, message: "detail" });
            expect(await tipJar.sendTip("tip_medium")).toBe(state);
        }
        expect(mocks.plugin.purchase).toHaveBeenLastCalledWith({ id: "tip_medium" });
        mocks.plugin.purchase.mockResolvedValueOnce({ state: "weird" });
        expect(await tipJar.sendTip("tip_medium")).toBe("failed");
        mocks.plugin.purchase.mockResolvedValueOnce(null);
        expect(await tipJar.sendTip("tip_medium")).toBe("failed");
        mocks.plugin.purchase.mockRejectedValueOnce(new Error("boom"));
        expect(await tipJar.sendTip("tip_medium")).toBe("failed");
    });

    it("recovers only positive whole counts", async () => {
        const tipJar = await load();
        mocks.plugin.recoverPurchases.mockResolvedValueOnce({ consumed: 2 });
        expect(await tipJar.recoverTips()).toBe(2);
        mocks.plugin.recoverPurchases.mockResolvedValueOnce({ consumed: 0 });
        expect(await tipJar.recoverTips()).toBe(0);
        mocks.plugin.recoverPurchases.mockResolvedValueOnce({ consumed: -1 });
        expect(await tipJar.recoverTips()).toBe(0);
        mocks.plugin.recoverPurchases.mockResolvedValueOnce({ consumed: 1.5 });
        expect(await tipJar.recoverTips()).toBe(0);
        mocks.plugin.recoverPurchases.mockResolvedValueOnce({});
        expect(await tipJar.recoverTips()).toBe(0);
        mocks.plugin.recoverPurchases.mockRejectedValueOnce(new Error("boom"));
        expect(await tipJar.recoverTips()).toBe(0);
    });

    it("survives a registerPlugin failure and tries again on the next call", async () => {
        const tipJar = await load();
        mocks.registerPlugin.mockImplementationOnce(() => {
            throw new Error("already registered");
        });
        expect(await tipJar.recoverTips()).toBe(0);
        // The next call tries again instead of staying broken.
        mocks.plugin.recoverPurchases.mockResolvedValueOnce({ consumed: 1 });
        expect(await tipJar.recoverTips()).toBe(1);
    });
});
