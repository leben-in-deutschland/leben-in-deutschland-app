import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Tip jar: a thin wrapper around the local native plugin `TipJar`. On Android
 * (`src/android/.../TipJarPlugin.java`) it talks to Google Play Billing, on
 * iOS (`src/ios/App/App/TipJarPlugin.swift`) to StoreKit 2; both answer with
 * the same shapes.
 *
 * Every function does nothing on the web and never throws: plugin failures
 * are logged with `console.warn` and show up in the return value instead.
 * Tips never touch the learner record; `utils/support-store.ts` keeps the
 * count under its own storage key.
 */

/** Platforms with a native TipJar implementation. */
const TIP_JAR_PLATFORMS = ["android", "ios"] as const;

/** Product ids as created in the Play Console and App Store Connect (consumables). Order is the display order. */
export const TIP_PRODUCT_IDS = ["tip_small", "tip_medium", "tip_large"] as const;

export interface TipProduct {
    id: string;
    /** Product name from the Play Console, in the store language. */
    name: string;
    /** Formatted price with currency, e.g. "1,99 €". */
    price: string;
}

/**
 * How a purchase ended.
 * - purchased: paid and consumed (Android) or finished (iOS); count it.
 * - pending: payment not confirmed yet (cash at a kiosk, Ask to Buy); recoverTips() counts it later.
 * - cancelled: the learner closed the store sheet.
 * - unavailable: no store billing, or the product does not exist in the store.
 * - failed: anything else.
 */
export type TipOutcome = "purchased" | "pending" | "cancelled" | "unavailable" | "failed";

const OUTCOMES: readonly TipOutcome[] = ["purchased", "pending", "cancelled", "unavailable", "failed"];

interface TipJarPlugin {
    getProducts(options: { ids: string[] }): Promise<{ available: boolean; products: TipProduct[] }>;
    purchase(options: { id: string }): Promise<{ state: TipOutcome; message?: string }>;
    recoverPurchases(): Promise<{ consumed: number }>;
}

let plugin: TipJarPlugin | null = null;

function warn(action: string, error: unknown): void {
    console.warn(`[tip-jar] ${action} failed`, error);
}

/** True inside the Android or iOS app when the native TipJar plugin is registered. */
export function tipJarSupported(): boolean {
    try {
        const platform = Capacitor.getPlatform() as (typeof TIP_JAR_PLATFORMS)[number];
        return TIP_JAR_PLATFORMS.includes(platform) && Capacitor.isPluginAvailable("TipJar");
    } catch {
        return false;
    }
}

/** The plugin proxy, registered once; null where the tip jar is not supported. */
function getPlugin(): TipJarPlugin | null {
    if (!tipJarSupported()) {
        return null;
    }
    if (!plugin) {
        try {
            plugin = registerPlugin<TipJarPlugin>("TipJar");
        } catch (error) {
            warn("registerPlugin", error);
            return null;
        }
    }
    return plugin;
}

function isProduct(value: unknown): value is TipProduct {
    if (!value || typeof value !== "object") {
        return false;
    }
    const { id, name, price } = value as Record<string, unknown>;
    return typeof id === "string" && id !== "" && typeof name === "string" && typeof price === "string" && price !== "";
}

/**
 * The tip products the store knows, in `TIP_PRODUCT_IDS` order. Empty on the
 * web, without store billing, before the owner created the products in the
 * Play Console or App Store Connect, or when the query fails.
 */
export async function loadTipProducts(): Promise<TipProduct[]> {
    const tipJar = getPlugin();
    if (!tipJar) {
        return [];
    }
    try {
        const result = await tipJar.getProducts({ ids: [...TIP_PRODUCT_IDS] });
        if (!result?.available || !Array.isArray(result.products)) {
            return [];
        }
        return result.products.filter(isProduct).map(({ id, name, price }) => ({ id, name, price }));
    } catch (error) {
        warn("getProducts", error);
        return [];
    }
}

/** Opens the store's purchase sheet for one tip and reports how it ended. */
export async function sendTip(id: string): Promise<TipOutcome> {
    const tipJar = getPlugin();
    if (!tipJar) {
        return "unavailable";
    }
    try {
        const result = await tipJar.purchase({ id });
        const state = result?.state;
        if (OUTCOMES.includes(state)) {
            if (result.message && state !== "purchased" && state !== "cancelled") {
                console.warn(`[tip-jar] purchase ${state}: ${result.message}`);
            }
            return state;
        }
        return "failed";
    } catch (error) {
        warn("purchase", error);
        return "failed";
    }
}

/**
 * Finishes tips that were paid but never counted (a pending payment that
 * went through, or a crash between payment and confirmation) and returns how
 * many there were. 0 on the web or on failure.
 */
export async function recoverTips(): Promise<number> {
    const tipJar = getPlugin();
    if (!tipJar) {
        return 0;
    }
    try {
        const result = await tipJar.recoverPurchases();
        const consumed = result?.consumed;
        return Number.isInteger(consumed) && consumed > 0 ? consumed : 0;
    } catch (error) {
        warn("recoverPurchases", error);
        return 0;
    }
}
