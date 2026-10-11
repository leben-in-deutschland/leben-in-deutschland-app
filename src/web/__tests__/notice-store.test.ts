/*
 * Owner notices: the hand-edited file is checked entry by entry, shown only
 * when it applies (dates, platform, app version, not dismissed), in the
 * learner's language, and the tip-jar switch defaults to on.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
    activeNotices,
    compareVersions,
    DISMISSED_KEY,
    dismissNotice,
    isNotice,
    isNoticeFile,
    noticeApplies,
    pickText,
    readDismissed,
    resolveFlags,
    sanitizeNoticeFile,
    subscribeDismissed,
    type Notice,
    type NoticeContext,
} from "@/utils/notice-store";

const base: Notice = { id: "n1", title: { de: "Hallo", en: "Hello" } };
const context: NoticeContext = { today: "2026-10-10", platform: "android", version: "2.0.145", dismissed: [] };

beforeEach(() => {
    localStorage.clear();
});

describe("isNotice / isNoticeFile / sanitizeNoticeFile", () => {
    it("needs an id and a localized title", () => {
        expect(isNotice(base)).toBe(true);
        expect(isNotice({ id: "", title: { en: "x" } })).toBe(false);
        expect(isNotice({ id: "n", title: "plain" })).toBe(false);
        expect(isNotice({ id: "n", title: {} })).toBe(false);
        expect(isNotice(null)).toBe(false);
    });

    it("checks every optional field's type", () => {
        expect(isNotice({ ...base, body: { en: "b" }, url: "https://x.test", tone: "warning", from: "2026-10-01", until: "2026-10-31", platform: "android", minVersion: "2.0.1", maxVersion: "2.0.150" })).toBe(true);
        expect(isNotice({ ...base, url: "javascript:alert(1)" })).toBe(false);
        expect(isNotice({ ...base, tone: "danger" })).toBe(false);
        expect(isNotice({ ...base, from: "10.10.2026" })).toBe(false);
        expect(isNotice({ ...base, platform: "ios" })).toBe(false);
        expect(isNotice({ ...base, maxVersion: "v2" })).toBe(false);
        expect(isNotice({ ...base, body: { en: 3 } })).toBe(false);
    });

    it("accepts the top-level shape and drops bad entries one by one", () => {
        expect(isNoticeFile({ notices: [] })).toBe(true);
        expect(isNoticeFile({ notices: [], flags: { tipJar: false } })).toBe(true);
        expect(isNoticeFile({ notices: "none" })).toBe(false);
        expect(isNoticeFile([])).toBe(false);
        expect(isNoticeFile({ notices: [], flags: "off" })).toBe(false);
        const cleaned = sanitizeNoticeFile({ notices: [base, { id: "bad" } as unknown as Notice, { ...base, id: "n2" }], flags: { tipJar: true } });
        expect(cleaned.notices.map((notice) => notice.id)).toEqual(["n1", "n2"]);
        expect(cleaned.flags).toEqual({ tipJar: true });
    });
});

describe("compareVersions", () => {
    it("compares numerically segment by segment", () => {
        expect(compareVersions("2.0.145", "2.0.150")).toBe(-1);
        expect(compareVersions("2.0.150", "2.0.150")).toBe(0);
        expect(compareVersions("2.1", "2.0.999")).toBe(1);
        expect(compareVersions("2.0", "2.0.0")).toBe(0);
        expect(compareVersions("10.0.0", "9.9.9")).toBe(1);
    });
});

describe("pickText", () => {
    it("prefers the learner's language, then English, then German, then anything", () => {
        expect(pickText({ de: "Hallo", en: "Hello" }, "de")).toBe("Hallo");
        expect(pickText({ de: "Hallo", en: "Hello" }, "tr")).toBe("Hello");
        expect(pickText({ de: "Hallo" }, "en")).toBe("Hallo");
        expect(pickText({ fr: "Salut" }, "en")).toBe("Salut");
        expect(pickText(undefined, "en")).toBe("");
    });
});

describe("noticeApplies", () => {
    it("is true for an unconstrained notice", () => {
        expect(noticeApplies(base, context)).toBe(true);
    });

    it("respects the date window inclusively", () => {
        expect(noticeApplies({ ...base, from: "2026-10-10", until: "2026-10-10" }, context)).toBe(true);
        expect(noticeApplies({ ...base, from: "2026-10-11" }, context)).toBe(false);
        expect(noticeApplies({ ...base, until: "2026-10-09" }, context)).toBe(false);
    });

    it("respects platform", () => {
        expect(noticeApplies({ ...base, platform: "android" }, context)).toBe(true);
        expect(noticeApplies({ ...base, platform: "web" }, context)).toBe(false);
        expect(noticeApplies({ ...base, platform: "all" }, { ...context, platform: "web" })).toBe(true);
    });

    it("targets app versions so an update notice reaches only older builds", () => {
        expect(noticeApplies({ ...base, maxVersion: "2.0.150" }, context)).toBe(true);
        expect(noticeApplies({ ...base, maxVersion: "2.0.144" }, context)).toBe(false);
        expect(noticeApplies({ ...base, minVersion: "2.0.145" }, context)).toBe(true);
        expect(noticeApplies({ ...base, minVersion: "2.0.146" }, context)).toBe(false);
    });

    it("hides dismissed notices", () => {
        expect(noticeApplies(base, { ...context, dismissed: ["n1"] })).toBe(false);
    });
});

describe("activeNotices", () => {
    it("resolves texts and defaults, keeps file order, and drops empty titles", () => {
        const file = {
            notices: [
                { ...base, id: "a", body: { de: "Text" }, url: "https://play.google.com/x", linkLabel: { en: "Open Play" }, tone: "success" as const },
                { ...base, id: "b", until: "2020-01-01" },
                { ...base, id: "c", title: { tr: "" } },
                { ...base, id: "d" },
            ],
        };
        expect(activeNotices(file, context, "de")).toEqual([
            { id: "a", title: "Hallo", body: "Text", tone: "success", url: "https://play.google.com/x", linkLabel: "Open Play" },
            { id: "d", title: "Hallo", body: "", tone: "info", url: null, linkLabel: null },
        ]);
        expect(activeNotices(null, context, "de")).toEqual([]);
    });
});

describe("resolveFlags", () => {
    it("keeps the tip jar unless explicitly switched off", () => {
        expect(resolveFlags(null)).toEqual({ tipJar: true });
        expect(resolveFlags({ notices: [] })).toEqual({ tipJar: true });
        expect(resolveFlags({ notices: [], flags: { tipJar: "no" } })).toEqual({ tipJar: true });
        expect(resolveFlags({ notices: [], flags: { tipJar: false } })).toEqual({ tipJar: false });
    });
});

describe("dismissed ids", () => {
    it("remembers dismissed ids under their own key and notifies", () => {
        let calls = 0;
        const stop = subscribeDismissed(() => {
            calls += 1;
        });
        expect(readDismissed()).toEqual([]);
        dismissNotice("n1");
        dismissNotice("n2");
        dismissNotice("n1");
        expect(readDismissed()).toEqual(["n2", "n1"]);
        expect(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")).toEqual(["n2", "n1"]);
        expect(localStorage.getItem("user")).toBeNull();
        expect(calls).toBe(3);
        stop();
    });

    it("keeps only the last fifty and survives garbage", () => {
        for (let index = 0; index < 60; index += 1) {
            dismissNotice(`n${index}`);
        }
        expect(readDismissed()).toHaveLength(50);
        expect(readDismissed()[0]).toBe("n10");
        localStorage.setItem(DISMISSED_KEY, "{broken");
        expect(readDismissed()).toEqual([]);
    });
});
