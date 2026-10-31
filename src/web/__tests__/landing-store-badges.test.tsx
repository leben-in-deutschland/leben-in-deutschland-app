/*
 * Store badges on the landing page (ADR-047): the App Store badge is a muted
 * "coming soon" marker while `siteConfig.links.appStore` is empty and becomes
 * a real link, next to Google Play, once the URL is set.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/data/data";

const mocks = vi.hoisted(() => ({ appStore: "" }));

vi.mock("@/config/site", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/config/site")>();
    return {
        ...original,
        appStoreUrl: () => mocks.appStore || undefined,
    };
});

import { ClosingCta, DownloadSection } from "@/components/landing/landing-download";
import { LandingHero } from "@/components/landing/landing-hero";

const APP_STORE = "https://apps.apple.com/de/app/id0000000000";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=org.lebenindeutschland.app";
const t = getTranslations("en");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount(node: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(node);
    });
}

function links(href: string): HTMLAnchorElement[] {
    return Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href="${href}"]`));
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.appStore = "";
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

describe("landing store badges before the iOS launch", () => {
    it("shows Google Play as a link and the App Store as a coming-soon marker", async () => {
        await mount(<DownloadSection t={t} />);
        expect(links(PLAY_STORE)).toHaveLength(1);
        expect(document.querySelectorAll('a[href^="https://apps.apple.com"]')).toHaveLength(0);
        const marker = Array.from(document.querySelectorAll("span")).find((el) => el.textContent === "App Store")?.closest("span.pointer-events-none");
        expect(marker).toBeTruthy();
        expect(marker!.textContent).toContain(t.landing_app_store_soon_eyebrow);
        expect(document.body.textContent).toContain(t.landing_download_app_desc_soon);
    });

    it("keeps the hero and the closing call to action on Google Play only", async () => {
        await mount(
            <>
                <LandingHero t={t} hasRecord={false} stateName="Berlin" />
                <ClosingCta t={t} hasRecord={false} />
            </>,
        );
        expect(links(PLAY_STORE)).toHaveLength(2);
        expect(document.querySelectorAll('a[href^="https://apps.apple.com"]')).toHaveLength(0);
    });
});

describe("landing store badges once the App Store URL is set", () => {
    beforeEach(() => {
        mocks.appStore = APP_STORE;
    });

    it("links the App Store badge next to Google Play in the download card", async () => {
        await mount(<DownloadSection t={t} />);
        expect(links(PLAY_STORE)).toHaveLength(1);
        const appStore = links(APP_STORE);
        expect(appStore).toHaveLength(1);
        expect(appStore[0].textContent).toContain(t.landing_app_store_cta);
        expect(appStore[0].getAttribute("rel")).toBe("noopener noreferrer");
        expect(document.querySelector("span.pointer-events-none")).toBeNull();
        expect(document.body.textContent).toContain(t.landing_download_app_desc);
    });

    it("adds the App Store badge to the hero and the closing call to action", async () => {
        await mount(
            <>
                <LandingHero t={t} hasRecord={false} stateName="Berlin" />
                <ClosingCta t={t} hasRecord={false} />
            </>,
        );
        expect(links(PLAY_STORE)).toHaveLength(2);
        expect(links(APP_STORE)).toHaveLength(2);
    });
});
