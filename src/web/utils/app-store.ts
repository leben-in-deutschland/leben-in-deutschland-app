import { Capacitor } from "@capacitor/core";
import { appStoreUrl, siteConfig } from "@/config/site";

/** The store this app came from: the App Store on iOS, Google Play everywhere else. Apple rejects iOS apps that name other stores (Guideline 2.3.10). */
export function storeName(): string {
    return Capacitor.getPlatform() === "ios" ? "App Store" : "Google Play";
}

/** The store page where the learner can rate the app; undefined on iOS until the App Store URL is set (ADR-047). */
export function storeRatingUrl(): string | undefined {
    if (Capacitor.getPlatform() === "ios") {
        const url = appStoreUrl();
        return url ? `${url}${url.includes("?") ? "&" : "?"}action=write-review` : undefined;
    }
    return siteConfig.links.playStore;
}
