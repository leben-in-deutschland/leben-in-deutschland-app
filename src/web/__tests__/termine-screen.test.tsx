/*
 * The exam-dates page (/termine, ADR-050) and the alerts behind it: the list
 * per state, the search, the watch list that stays on the device, the honest
 * failure state, and what happens when a watched centre has news.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TerminCentre, TerminSlot, TerminStatus, TermineData } from "@/types/termine";

const mocks = vi.hoisted(() => ({
    native: false,
    refresh: vi.fn(async (): Promise<TermineData | null> => null),
    notify: vi.fn(async () => 1),
    toast: vi.fn(),
    push: vi.fn(),
}));

vi.mock("@/services/termine", () => ({ refreshTermine: mocks.refresh }));
vi.mock("@/services/notifications", () => ({ notifyTermine: mocks.notify }));
vi.mock("react-toastify", () => ({ toast: mocks.toast }));
vi.mock("next/navigation", async (importOriginal) => ({
    ...(await importOriginal<typeof import("next/navigation")>()),
    useRouter: () => ({ push: mocks.push, replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@capacitor/core", async (importOriginal) => {
    const original = await importOriginal<typeof import("@capacitor/core")>();
    return {
        ...original,
        Capacitor: { ...original.Capacitor, isNativePlatform: () => mocks.native, getPlatform: () => (mocks.native ? "android" : "web") },
    };
});

import { TermineScreen } from "@/components/termine/termine-screen";
import { useTermineAlerts } from "@/components/shell/use-termine-alerts";
import { getTranslations, statesData } from "@/data/data";
import { dayKey, addDays } from "@/utils/date-utils";
import { termineStore } from "@/utils/termine-store";
import { EMPTY_WATCH, readWatch, TERMINE_WATCH_KEY, watchCentre, writeWatch } from "@/utils/termine-watch";
import { UI_MODE_KEY } from "@/utils/ui-mode";
import { createNewUser } from "@/utils/user-defaults";
import { readUser } from "@/utils/user-store";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const de = getTranslations("de") as unknown as Record<string, string>;
const STATES = statesData();
const TODAY = dayKey();
const SOON = addDays(TODAY, 10);
const LATER = addDays(TODAY, 40);

function slot(id: string, date: string, status: TerminStatus, extra: Partial<TerminSlot> = {}): TerminSlot {
    return { id, date, status, title: "Einbürgerungstest", url: `https://vhs.example/kurs/${id}`, ...extra };
}

function centre(id: string, state: string, city: string, slots: TerminSlot[], extra: Partial<TerminCentre> = {}): TerminCentre {
    return { id, state, city, name: `VHS ${city}`, url: `https://vhs.example/${id}`, checkedAt: new Date().toISOString(), ok: true, slots, ...extra };
}

const FUERTH = centre("by-fuerth", "BY", "Fürth", [slot("f1", SOON, "full"), slot("f2", LATER, "unknown")]);
const KISSINGEN = centre("by-kiss", "BY", "Bad Kissingen", [slot("k1", SOON, "free", { time: "14:30", booking: "inperson", place: "Rathaus" })]);
const KOELN = centre("nw-koeln", "NW", "Köln", [slot("c1", SOON, "few")]);
const DATA: TermineData = { version: 1, generatedAt: new Date().toISOString(), centres: [FUERTH, KISSINGEN, KOELN] };

let root: Root | null = null;
let container: HTMLDivElement;

async function mount(node: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(node);
    });
}

function cards(): string[] {
    return Array.from(container.querySelectorAll("[data-testid^='termine-centre-']")).map((card) => card.getAttribute("data-testid")!.replace("termine-centre-", ""));
}

function button(label: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll("button")).find((entry) => entry.textContent?.trim() === label || entry.getAttribute("aria-label") === label);
    if (!found) throw new Error(`no button "${label}"`);
    return found;
}

async function press(element: HTMLElement) {
    await act(async () => {
        element.click();
    });
}

async function type(value: string) {
    const input = container.querySelector("input[type='search']") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

beforeEach(() => {
    localStorage.clear();
    writeWatch(EMPTY_WATCH);
    termineStore.write(termineStore.empty);
    mocks.native = false;
    mocks.refresh.mockReset().mockResolvedValue(null);
    mocks.notify.mockReset().mockResolvedValue(1);
    mocks.toast.mockReset();
    mocks.push.mockReset();
});

afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
});

describe("exam dates page", () => {
    it("lists the centres of the state, bookable first, with what the centre says and a link to its page", async () => {
        termineStore.storeData(DATA);
        await mount(<TermineScreen initialState="BY" states={STATES} />);

        expect(container.querySelector("h1")?.textContent).toBe("Prüfungstermine in Bayern");
        expect(cards()).toEqual(["by-kiss", "by-fuerth"]);
        const first = container.querySelector("[data-testid='termine-centre-by-kiss']")!;
        expect(first.textContent).toContain("Plätze frei");
        expect(first.textContent).toContain("14:30 Uhr");
        expect(first.textContent).toContain("Rathaus · vor Ort anmelden");
        const links = Array.from(first.querySelectorAll("a")).map((link) => [link.getAttribute("href"), link.getAttribute("target"), link.getAttribute("rel")]);
        expect(links).toEqual([
            ["https://vhs.example/kurs/k1", "_blank", "noopener noreferrer"],
            ["https://vhs.example/by-kiss", "_blank", "noopener noreferrer"],
        ]);
        // A full date and an unclear one: the centre is "unclear", never "free".
        expect(container.querySelector("[data-testid='termine-centre-by-fuerth']")!.textContent).toContain("Plätze unklar");
        expect(container.querySelector("[role='status']")?.textContent).toContain("2 Prüfstellen · 1 mit freien Plätzen");
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it("says of a centre it could not read that it could not read it - not that its page lists no date", async () => {
        const read = centre("by-leer", "BY", "Aach", []);
        const lost = centre("by-still", "BY", "Zell", [], { ok: false, checkedAt: new Date(Date.now() - 5 * 86_400_000).toISOString() });
        const never = centre("by-nie", "BY", "Ulm", [], { ok: false, checkedAt: null });
        termineStore.storeData({ ...DATA, centres: [read, lost, never] });
        await mount(<TermineScreen initialState="BY" states={STATES} />);

        const text = (id: string) => container.querySelector(`[data-testid='termine-centre-${id}']`)!.textContent ?? "";
        expect(text("by-leer")).toContain(de.termine_status_none);
        expect(text("by-leer")).toContain(de.termine_no_dates);
        for (const [id, said] of [
            ["by-still", de.termine_unreadable],
            ["by-nie", de.termine_never_read],
        ]) {
            expect(text(id)).toContain(said);
            expect(text(id)).not.toContain(de.termine_status_none);
            expect(text(id)).not.toContain(de.termine_no_dates);
        }
        expect(text("by-still")).toContain("Zuletzt nicht erreichbar");
    });

    it("links every state to its own page on the website and says so when a state has no centre yet", async () => {
        termineStore.storeData(DATA);
        await mount(<TermineScreen initialState="BE" states={STATES} />);
        const row = container.querySelector(`nav[aria-label="${de.termine_state_picker_label}"]`)!;
        expect(row.querySelector("a[aria-current='page']")?.getAttribute("href")).toBe("/termine/BE");
        expect(row.querySelector("a[title='Bayern']")?.getAttribute("href")).toBe("/termine/BY");
        expect(row.querySelector("a")?.getAttribute("href")).toBe("/termine");
        expect(cards()).toEqual([]);
        expect(container.textContent).toContain(de.termine_empty_title);
        const hrefs = Array.from(container.querySelectorAll("a")).map((link) => [link.textContent?.trim(), link.getAttribute("href")]);
        expect(hrefs).toContainEqual(["Alle Prüfstellen in Berlin", "/pruefstellen/BE"]);
        expect(hrefs).toContainEqual([de.termine_show_all_states, "/termine"]);
    });

    it("searches by town and narrows to centres with a free place", async () => {
        termineStore.storeData(DATA);
        await mount(<TermineScreen initialState="" states={STATES} />);
        expect(cards()).toEqual(["by-kiss", "nw-koeln", "by-fuerth"]);

        await type("fuerth");
        expect(cards()).toEqual(["by-fuerth"]);
        await type("");
        await press(button(de.termine_filter_bookable));
        expect(cards()).toEqual(["by-kiss", "nw-koeln"]);
    });

    it("keeps the watch list on the device and shows the watched centres on top", async () => {
        termineStore.storeData(DATA);
        await mount(<TermineScreen initialState="BY" states={STATES} />);
        expect(container.textContent).not.toContain(de.termine_watch_title);

        await press(button("VHS Fürth beobachten"));
        expect(JSON.parse(localStorage.getItem(TERMINE_WATCH_KEY)!).centres).toEqual(["by-fuerth"]);
        expect(container.textContent).toContain(de.termine_watch_title);
        expect(cards()).toEqual(["by-fuerth", "by-kiss", "by-fuerth"]);
        expect(button("VHS Fürth nicht mehr beobachten").getAttribute("aria-pressed")).toBe("true");

        await press(button("VHS Fürth nicht mehr beobachten"));
        expect(localStorage.getItem(TERMINE_WATCH_KEY)).toBeNull();
        expect(cards()).toEqual(["by-kiss", "by-fuerth"]);
    });

    it("says so when the dates cannot be loaded, points to the list of exam centres, and asks again on request", async () => {
        await mount(<TermineScreen initialState="NW" states={STATES} />);
        expect(container.textContent).toContain(de.termine_failed_title);
        expect(cards()).toEqual([]);
        expect(Array.from(container.querySelectorAll("a")).some((link) => link.getAttribute("href") === "/pruefstellen/NW")).toBe(true);

        mocks.refresh.mockImplementationOnce(async () => {
            termineStore.storeData(DATA);
            return DATA;
        });
        await press(button(de.termine_retry));
        expect(mocks.refresh).toHaveBeenLastCalledWith({ force: true });
        expect(cards()).toEqual(["nw-koeln"]);
    });

    it("starts with the learner's state inside the app and switches states in place", async () => {
        mocks.native = true;
        localStorage.setItem("user", JSON.stringify(createNewUser({ state: { name: "Nordrhein-Westfalen", code: "NW", eng: "", capital: "" }, language: "de" })));
        termineStore.storeData(DATA);
        await mount(<TermineScreen initialState="" states={STATES} />);

        expect(cards()).toEqual(["nw-koeln"]);
        const row = container.querySelector(`nav[aria-label="${de.termine_state_picker_label}"]`)!;
        expect(row.querySelectorAll("a")).toHaveLength(0);
        await press(row.querySelector("button[title='Bayern']") as HTMLButtonElement);
        expect(cards()).toEqual(["by-kiss", "by-fuerth"]);
        expect(row.querySelector("button[title='Bayern']")?.getAttribute("aria-pressed")).toBe("true");

        // A state without a centre offers the other states, without leaving the page.
        await press(row.querySelector("button[title='Berlin']") as HTMLButtonElement);
        expect(cards()).toEqual([]);
        await press(button(de.termine_show_all_states));
        expect(cards()).toEqual(["by-kiss", "nw-koeln", "by-fuerth"]);
    });
});

function Alerts() {
    useTermineAlerts(de);
    return null;
}

/** A learner on the current design; the classic design keeps its notes in the inbox and shows no toast. */
function seedLearner(preferences: Record<string, unknown> = {}) {
    const user = createNewUser({ state: { name: "Bayern", code: "BY", eng: "", capital: "" }, language: "de" });
    localStorage.setItem("user", JSON.stringify({ ...user, preferences: { ...user.preferences, ...preferences } }));
    localStorage.setItem(UI_MODE_KEY, "modern");
}

describe("exam-date alerts", () => {
    it("fetches nothing for a learner who watches nothing", async () => {
        termineStore.storeData(DATA);
        await mount(<Alerts />);
        expect(mocks.refresh).not.toHaveBeenCalled();
        expect(mocks.notify).not.toHaveBeenCalled();
    });

    it("tells a learner once when a watched centre opens a place: inbox, toast and system notification", async () => {
        seedLearner();
        writeWatch(watchCentre(EMPTY_WATCH, FUERTH, TODAY));
        termineStore.storeData(DATA);
        await mount(<Alerts />);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
        expect(mocks.notify).not.toHaveBeenCalled();

        const opened: TermineData = { ...DATA, centres: [centre("by-fuerth", "BY", "Fürth", [slot("f1", SOON, "free", { time: "09:00" }), slot("f2", LATER, "unknown")]), KISSINGEN, KOELN] };
        await act(async () => {
            termineStore.storeData(opened);
        });

        const [day, month, year] = [SOON.slice(8), SOON.slice(5, 7), SOON.slice(0, 4)];
        const title = "Freier Platz in Fürth";
        const body = `VHS Fürth: ${day}.${month}.${year}, 09:00. Anmelden kannst du dich bei der Prüfstelle.`;
        expect(mocks.notify).toHaveBeenCalledTimes(1);
        expect(mocks.notify).toHaveBeenCalledWith([{ key: "by-fuerth/f1", route: "/termine", title, body }], de);
        expect(mocks.toast).toHaveBeenCalledWith(`${title} — ${body}`, expect.objectContaining({ toastId: "termine-by-fuerth/f1" }));
        // The inbox keeps the note for this learner, so the toast leaves by itself.
        expect(mocks.toast.mock.calls[0][1]).not.toHaveProperty("autoClose");
        const note = readUser()?.inbox?.find((item) => item.type === "termine");
        expect(note).toMatchObject({ id: `termine-open-by-fuerth/f1-${TODAY}`, route: "/termine", read: false });
        expect(readWatch().known["by-fuerth/f1"]).toEqual({ status: "free", date: SOON });

        // The same file again, and a re-render, change nothing.
        await act(async () => {
            termineStore.storeData({ ...opened, generatedAt: new Date().toISOString() });
        });
        expect(mocks.notify).toHaveBeenCalledTimes(1);
        expect(readUser()?.inbox?.filter((item) => item.type === "termine")).toHaveLength(1);
    });

    it("stays quiet, and stops, when the device cannot store what it announced", async () => {
        seedLearner();
        writeWatch(watchCentre(EMPTY_WATCH, FUERTH, TODAY));
        const setItem = Storage.prototype.setItem;
        const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
            if (key === TERMINE_WATCH_KEY) {
                throw new DOMException("full", "QuotaExceededError");
            }
            setItem.call(this, key, value);
        });
        try {
            await mount(<Alerts />);
            // News that cannot be remembered would be news again on every pass - for ever.
            await act(async () => {
                termineStore.storeData({ ...DATA, centres: [centre("by-fuerth", "BY", "Fürth", [slot("f1", SOON, "free")]), KISSINGEN, KOELN] });
            });
            expect(writes.mock.calls.filter(([key]) => key === TERMINE_WATCH_KEY)).toHaveLength(1);
        } finally {
            writes.mockRestore();
        }
        expect(mocks.notify).not.toHaveBeenCalled();
        expect(mocks.toast).not.toHaveBeenCalled();
        expect(readWatch().known["by-fuerth/f1"]).toEqual({ status: "full", date: SOON });
    });

    it("keeps the message until it is closed for a website visitor without a learner record, and opens the dates on a tap", async () => {
        writeWatch(watchCentre(EMPTY_WATCH, FUERTH, TODAY));
        termineStore.storeData(DATA);
        await mount(<Alerts />);
        await act(async () => {
            termineStore.storeData({ ...DATA, centres: [centre("by-fuerth", "BY", "Fürth", [slot("f1", SOON, "free")]), KISSINGEN, KOELN] });
        });
        // No learner record means no inbox: the toast is the only place this news appears.
        expect(readUser()).toBeNull();
        expect(mocks.toast).toHaveBeenCalledTimes(1);
        const [text, options] = mocks.toast.mock.calls[0];
        expect(text).toContain("Freier Platz in Fürth");
        expect(options).toMatchObject({ toastId: "termine-by-fuerth/f1", autoClose: false });
        options.onClick();
        expect(mocks.push).toHaveBeenCalledWith("/termine");
    });

    it("leaves the system notification out when the learner switched notifications off", async () => {
        seedLearner({ notificationsEnabled: false });
        writeWatch(watchCentre(EMPTY_WATCH, FUERTH, TODAY));
        await mount(<Alerts />);
        await act(async () => {
            termineStore.storeData({ ...DATA, centres: [centre("by-fuerth", "BY", "Fürth", [slot("f3", LATER, "free")])] });
        });
        expect(mocks.notify).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledTimes(1);
        expect(readUser()?.inbox?.some((item) => item.type === "termine")).toBe(true);
    });
});
