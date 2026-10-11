import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Tip jar: a thin wrapper around the local Android plugin `TipJar`
 * (`src/android/.../TipJarPlugin.java`), which talks to Google Play Billing.
 *
 * Every function does nothing on the web and never throws: plugin failures
 * are logged with `console.warn` and show up in the return value instead.
 * Tips never touch the learner record; `utils/support-store.ts` keeps the
 * count under its own storage key.
 */

/** Product ids as created in the Play Console (one-time, consumable). Order is the display order. */
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
 * - purchased: paid and consumed; count it.
 * - pending: payment not confirmed yet (e.g. cash at a kiosk); recoverTips() counts it later.
 * - cancelled: the learner closed the Google Play sheet.
 * - unavailable: no Play Billing, or the product does not exist in Play.
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

/** True inside the Android app when the native TipJar plugin is registered. */
export function tipJarSupported(): boolean {
    try {
        return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("TipJar");
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
 * The tip products Google Play knows, in `TIP_PRODUCT_IDS` order. Empty on
 * the web, without Play Billing, before the owner created the products in the
 * Play Console, or when the query fails.
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

/** Opens the Google Play purchase sheet for one tip and reports how it ended. */
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
