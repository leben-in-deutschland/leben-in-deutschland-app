/*
 * The Home notice list: shows what the downloaded file says for this
 * learner, asks for one refresh per mount, hides a notice for good on
 * "Got it", and the tip-jar switch follows the file.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoticeFile } from "@/utils/notice-store";
import { noticeStore } from "@/utils/notice-store";

const mocks = vi.hoisted(() => ({
    refresh: vi.fn(async (): Promise<NoticeFile | null> => null),
    native: true,
}));

vi.mock("@/services/notices", () => ({
    refreshNotices: mocks.refresh,
    NOTICES_URL: "https://example.test/notices.json",
}));

vi.mock("@capacitor/core", async (importOriginal) => {
    const original = await importOriginal<typeof import("@capacitor/core")>();
    return {
        ...original,
        Capacitor: { ...original.Capacitor, isNativePlatform: () => mocks.native, getPlatform: () => (mocks.native ? "android" : "web") },
    };
});

import { getTranslations } from "@/data/data";
import { NoticeList } from "@/components/home/notice-card";
import { useNoticeFlags, useNotices } from "@/components/home/use-notices";
import { APP_VERSION } from "@/utils/remote-cache";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = getTranslations("en") as unknown as Record<string, string>;

function Board() {
    const { notices, dismiss } = useNotices();
    const flags = useNoticeFlags();
    return (
        <div>
            <NoticeList notices={notices} onDismiss={dismiss} t={t} />
            <span data-testid="tip-jar">{flags.tipJar ? "on" : "off"}</span>
        </div>
    );
}

const file: NoticeFile = {
    notices: [
        { id: "results", title: { en: "Results are out", de: "Ergebnisse sind da" }, body: { en: "Check the BAMF page." }, url: "https://www.bamf.de" },
        { id: "old-builds", title: { en: "Update available" }, maxVersion: "1.0.0" },
        { id: "later", title: { en: "Not yet" }, from: "2999-01-01" },
    ],
    flags: { tipJar: false },
};

describe("home notices", () => {
    let root: Root | null = null;
    let container: HTMLDivElement;

    beforeEach(() => {
        localStorage.clear();
        mocks.native = true;
        mocks.refresh.mockReset().mockResolvedValue(null);
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root?.unmount());
        container.remove();
    });

    async function render() {
        await act(async () => {
            root!.render(<Board />);
        });
    }

    it("renders nothing and asks for a refresh when nothing is cached", async () => {
        await render();
        expect(container.querySelector("section")).toBeNull();
        expect(container.querySelector("[data-testid=tip-jar]")?.textContent).toBe("on");
        // One per hook that reads the file; the service itself shares one download.
        expect(mocks.refresh).toHaveBeenCalled();
    });

    it("shows only the notices that apply to this build today, with link and switch", async () => {
        expect(APP_VERSION > "1.0.0").toBe(true);
        noticeStore.storeData(file);
        await render();
        const items = container.querySelectorAll("li");
        expect(items).toHaveLength(1);
        // The app language defaults to German; the body falls back to English.
        expect(items[0].textContent).toContain("Ergebnisse sind da");
        expect(items[0].textContent).toContain("Check the BAMF page.");
        const link = items[0].querySelector("a");
        expect(link?.getAttribute("href")).toBe("https://www.bamf.de");
        expect(link?.getAttribute("target")).toBe("_blank");
        expect(link?.textContent).toBe(t.home_notice_open);
        expect(container.querySelector("[data-testid=tip-jar]")?.textContent).toBe("off");
    });

    it("updates in place when the download lands and hides a notice for good on Got it", async () => {
        await render();
        await act(async () => {
            noticeStore.storeData(file);
        });
        expect(container.querySelectorAll("li")).toHaveLength(1);
        const buttons = Array.from(container.querySelectorAll("button"));
        const gotIt = buttons.find((button) => button.textContent === t.home_notice_dismiss);
        expect(gotIt).toBeDefined();
        await act(async () => {
            gotIt!.click();
        });
        expect(container.querySelector("section")).toBeNull();
        expect(JSON.parse(localStorage.getItem("lid:notices-dismissed") ?? "[]")).toEqual(["results"]);
        expect(localStorage.getItem("user")).toBeNull();
    });

    it("hides android-only notices on the web", async () => {
        mocks.native = false;
        noticeStore.storeData({ notices: [{ id: "a", title: { en: "Android only" }, platform: "android" }, { id: "w", title: { en: "Everyone" } }] });
        await render();
        const items = container.querySelectorAll("li");
        expect(items).toHaveLength(1);
        expect(items[0].textContent).toContain("Everyone");
    });
});
