/*
 * Exam dates in the app (ADR-050): what the downloaded file is allowed to
 * contain, how the centres are listed, and the watch list that decides when
 * a learner is told about a date. The rule behind all of it: the app never
 * shows a date as bookable unless the file says so, and never announces the
 * same news twice.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { TerminCentre, TerminSlot, TerminStatus, TermineData } from "@/types/termine";
import { alertDraft, alertText, whenText } from "@/utils/termine-alerts";
import { centreSummary, countCentres, isUnconfirmed, listCentres, matchesQuery, splitSlots } from "@/utils/termine-logic";
import { isTermineData, sanitizeTermine } from "@/utils/termine-store";
import { detectAlerts, EMPTY_WATCH, MAX_WATCHED, readWatch, TERMINE_WATCH_KEY, unwatchCentre, watchCentre, writeWatch } from "@/utils/termine-watch";

const TODAY = "2026-11-22";

function slot(id: string, date: string, status: TerminStatus, extra: Partial<TerminSlot> = {}): TerminSlot {
    return { id, date, status, title: "Einbürgerungstest", url: `https://vhs.example/kurs/${id}`, ...extra };
}

function centre(id: string, state: string, city: string, slots: TerminSlot[], extra: Partial<TerminCentre> = {}): TerminCentre {
    return { id, state, city, name: `VHS ${city}`, url: `https://vhs.example/${id}`, checkedAt: "2026-11-22T05:17:00.000Z", ok: true, slots, ...extra };
}

function file(centres: TerminCentre[]): TermineData {
    return { version: 1, generatedAt: "2026-11-22T05:17:00.000Z", centres };
}

describe("the downloaded file", () => {
    it("accepts this version only", () => {
        expect(isTermineData(file([]))).toBe(true);
        expect(isTermineData({ ...file([]), version: 2 })).toBe(false);
        expect(isTermineData({ version: 1, generatedAt: "gestern", centres: [] })).toBe(false);
        expect(isTermineData({ version: 1, generatedAt: "2026-11-22T05:17:00.000Z" })).toBe(false);
    });

    it("drops what it cannot show and never turns an unknown booking state into a bookable one", () => {
        const raw = {
            version: 1,
            generatedAt: "2026-11-22T05:17:00.000Z",
            centres: [
                {
                    id: "by-a",
                    state: "by",
                    city: "Aach",
                    name: "VHS Aach",
                    url: "https://vhs-aach.example/p",
                    checkedAt: "2026-11-22T05:17:00.000Z",
                    ok: true,
                    slots: [
                        { id: "1", date: "2026-12-03", time: "14:30", status: "sofort-buchbar", title: "Einbürgerungstest", url: "https://vhs-aach.example/1" },
                        { id: "2", date: "2026-12-04", status: "free", title: "Einbürgerungstest", url: "javascript:alert(1)" },
                        { id: "3", date: "04.12.2026", status: "free", title: "Einbürgerungstest", url: "https://vhs-aach.example/3" },
                        { id: "4", date: "2026-12-05", time: "25:99", status: "few", booking: "per-fax", title: "Einbürgerungstest", url: "https://vhs-aach.example/4" },
                    ],
                },
                { id: "by-b", state: "BY", city: "Bdorf", name: "VHS Bdorf", url: "ftp://vhs-bdorf.example", checkedAt: null, ok: true, slots: [] },
                "kein Zentrum",
            ],
        } as unknown as TermineData;
        const clean = sanitizeTermine(raw);
        expect(clean.centres.map((entry) => entry.id)).toEqual(["by-a"]);
        expect(clean.centres[0].state).toBe("BY");
        expect(clean.centres[0].slots).toEqual([
            { id: "1", date: "2026-12-03", time: "14:30", status: "unknown", title: "Einbürgerungstest", url: "https://vhs-aach.example/1" },
            { id: "4", date: "2026-12-05", status: "few", title: "Einbürgerungstest", url: "https://vhs-aach.example/4" },
        ]);
    });
});

describe("listing the centres", () => {
    const free = centre("by-free", "BY", "München", [slot("a", "2027-01-22", "free"), slot("b", "2026-12-01", "full")]);
    const unclear = centre("by-unclear", "BY", "Fürth", [slot("a", "2026-12-04", "unknown")]);
    const full = centre("by-full", "BY", "Erding", [slot("a", "2026-11-26", "full")]);
    const past = centre("by-past", "BY", "Aach", [slot("a", "2026-11-20", "free")]);
    const other = centre("nw-few", "NW", "Köln", [slot("a", "2026-12-10", "few", { place: "Porz, Bezirksrathaus" })], { towns: ["Köln", "Hürth"], plz: "50667" });
    const data = file([past, full, other, unclear, free]);

    it("sums a centre up by its best upcoming date; a date that has passed counts for nothing", () => {
        expect(centreSummary(free, TODAY)).toBe("free");
        expect(centreSummary(unclear, TODAY)).toBe("unknown");
        expect(centreSummary(full, TODAY)).toBe("full");
        expect(centreSummary(past, TODAY)).toBe("none");
    });

    it("lists one state, bookable centres first and centres without a date last", () => {
        const ids = (filter: Partial<Parameters<typeof listCentres>[1]>) => listCentres(data, { state: "", query: "", bookableOnly: false, ...filter }, TODAY).map((entry) => entry.id);
        expect(ids({ state: "BY" })).toEqual(["by-free", "by-unclear", "by-full", "by-past"]);
        expect(ids({ state: "by", bookableOnly: true })).toEqual(["by-free"]);
        expect(ids({})).toEqual(["by-free", "nw-few", "by-unclear", "by-full", "by-past"]);
        expect(ids({ state: "BE" })).toEqual([]);
        expect(listCentres(null, { state: "", query: "", bookableOnly: false }, TODAY)).toEqual([]);
    });

    it("finds a centre by town, a further town it serves, postcode, name or the place of a date - umlauts or not", () => {
        expect(matchesQuery(free, "muenchen")).toBe(true);
        expect(matchesQuery(free, "MÜNCHEN")).toBe(true);
        expect(matchesQuery(other, "hürth")).toBe(true);
        expect(matchesQuery(other, "50667")).toBe(true);
        expect(matchesQuery(other, "porz")).toBe(true);
        expect(matchesQuery(other, "vhs köln")).toBe(true);
        expect(matchesQuery(other, "bonn")).toBe(false);
        expect(matchesQuery(other, "   ")).toBe(true);
    });

    it("shows the earliest dates of a centre, and the first bookable one when none of those can be booked", () => {
        const ids = (slots: TerminSlot[]) => {
            const { shown, more } = splitSlots(slots, 3);
            return [shown.map((entry) => entry.id), more.map((entry) => entry.id)];
        };
        const days = ["2026-12-01", "2026-12-08", "2026-12-15", "2026-12-22", "2027-01-12"];
        const all = (states: TerminStatus[]) => states.map((status, index) => slot(String(index + 1), days[index], status));
        expect(ids(all(["unknown", "full", "full", "full", "free"]))).toEqual([["1", "2", "5"], ["3", "4"]]);
        expect(ids(all(["unknown", "free", "full", "full", "free"]))).toEqual([["1", "2", "3"], ["4", "5"]]);
        expect(ids(all(["unknown", "full", "full", "closed", "unknown"]))).toEqual([["1", "2", "3"], ["4", "5"]]);
        expect(ids(all(["full", "free"]))).toEqual([["1", "2"], []]);
    });

    it("counts centres, centres with a date and centres with a bookable place", () => {
        expect(countCentres(data.centres, TODAY)).toEqual({ centres: 5, withDates: 4, bookable: 2 });
    });

    it("marks a centre as not confirmed when its last read failed or is older than a day and a half", () => {
        const now = new Date("2026-11-22T09:00:00Z");
        expect(isUnconfirmed(free, now)).toBe(false);
        expect(isUnconfirmed({ ...free, ok: false }, now)).toBe(true);
        expect(isUnconfirmed({ ...free, checkedAt: "2026-11-20T05:17:00.000Z" }, now)).toBe(true);
        expect(isUnconfirmed({ ...free, checkedAt: null }, now)).toBe(true);
    });
});

describe("the watch list", () => {
    const watched = centre("by-a", "BY", "Aach", [slot("old-free", "2026-12-03", "free"), slot("old-full", "2026-12-10", "full"), slot("old-unclear", "2026-12-17", "unknown")]);
    const start = watchCentre(EMPTY_WATCH, watched, TODAY);

    it("says nothing about the dates that were there when the learner started watching", () => {
        expect(start.centres).toEqual(["by-a"]);
        expect(detectAlerts(start, file([watched]), TODAY)).toEqual({ alerts: [], watch: start });
    });

    it("announces a place that became bookable and a newly published bookable date, once", () => {
        const opened = centre("by-a", "BY", "Aach", [slot("old-free", "2026-12-03", "free"), slot("old-full", "2026-12-10", "few"), slot("old-unclear", "2026-12-17", "unknown"), slot("new", "2027-01-14", "free")]);
        const first = detectAlerts(start, file([opened]), TODAY);
        expect(first.alerts).toHaveLength(1);
        expect(first.alerts[0]).toMatchObject({ kind: "open", more: 1 });
        expect(first.alerts[0].slot.id).toBe("old-full");
        expect(detectAlerts(first.watch, file([opened]), TODAY)).toEqual({ alerts: [], watch: first.watch });
    });

    it("announces a new date whose places are unclear as a new date, and stays silent about a new full or closed one", () => {
        const published = centre("by-a", "BY", "Aach", [...watched.slots, slot("new-unclear", "2027-02-04", "unknown"), slot("new-full", "2027-02-11", "full"), slot("new-closed", "2027-02-18", "closed")]);
        const { alerts } = detectAlerts(start, file([published]), TODAY);
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toMatchObject({ kind: "new", more: 0 });
        expect(alerts[0].slot.id).toBe("new-unclear");
    });

    it("announces a place that opens again after it was full", () => {
        const full = centre("by-a", "BY", "Aach", [slot("old-free", "2026-12-03", "full")]);
        const afterFull = detectAlerts(start, file([full]), TODAY);
        expect(afterFull.alerts).toEqual([]);
        const again = detectAlerts(afterFull.watch, file([centre("by-a", "BY", "Aach", [slot("old-free", "2026-12-03", "free")])]), TODAY);
        expect(again.alerts.map((alert) => alert.kind)).toEqual(["open"]);
    });

    it("does not trust a centre whose last read failed, and does not announce a date twice when it flickers", () => {
        const stale = centre("by-a", "BY", "Aach", [slot("new", "2027-01-14", "free")], { ok: false });
        expect(detectAlerts(start, file([stale]), TODAY)).toEqual({ alerts: [], watch: start });

        const gone = detectAlerts(start, file([centre("by-a", "BY", "Aach", [])]), TODAY);
        expect(gone.alerts).toEqual([]);
        expect(detectAlerts(gone.watch, file([watched]), TODAY).alerts).toEqual([]);
    });

    it("forgets a centre that left the file and the dates that have passed", () => {
        expect(detectAlerts(start, file([]), TODAY).watch).toEqual({ centres: [], known: {} });
        const later = detectAlerts(start, file([watched]), "2026-12-11").watch;
        expect(Object.keys(later.known)).toEqual(["by-a/old-unclear"]);
    });

    it("holds a dozen centres at most, and removing one removes what was known about it", () => {
        let list = EMPTY_WATCH;
        for (let index = 0; index < MAX_WATCHED + 3; index++) {
            list = watchCentre(list, centre(`c${index}`, "BY", `Ort ${index}`, [slot("a", "2026-12-03", "free")]), TODAY);
        }
        expect(list.centres).toHaveLength(MAX_WATCHED);
        const without = unwatchCentre(list, "c1");
        expect(without.centres).not.toContain("c1");
        expect(Object.keys(without.known)).not.toContain("c1/a");
        expect(Object.keys(without.known)).toContain("c11/a");
        expect(unwatchCentre(without, "nicht-da")).toBe(without);
    });

    describe("on the device", () => {
        beforeEach(() => {
            localStorage.clear();
            writeWatch(EMPTY_WATCH);
        });

        it("stores the list under its own key and survives a damaged entry", () => {
            expect(writeWatch(start)).toBe(true);
            expect(readWatch()).toEqual(start);
            expect(readWatch()).toBe(readWatch());
            expect(JSON.parse(localStorage.getItem(TERMINE_WATCH_KEY) ?? "{}").centres).toEqual(["by-a"]);

            localStorage.setItem(TERMINE_WATCH_KEY, JSON.stringify({ centres: ["by-a", 7, ""], known: { "by-a/x": { status: "geheim", date: "2026-12-03" }, "by-a/y": { status: "free", date: "2026-12-03" } } }));
            writeWatch(readWatch());
            expect(readWatch()).toEqual({ centres: ["by-a"], known: { "by-a/y": { status: "free", date: "2026-12-03" } } });

            localStorage.setItem(TERMINE_WATCH_KEY, "{kaputt");
            expect(detectAlerts(parseStored(), file([watched]), TODAY).alerts).toEqual([]);
        });

        it("removes the key when nothing is watched", () => {
            writeWatch(start);
            writeWatch(unwatchCentre(start, "by-a"));
            expect(localStorage.getItem(TERMINE_WATCH_KEY)).toBeNull();
        });
    });
});

/** Reads the stored list after the storage text was changed behind the module's back. */
function parseStored() {
    const raw = localStorage.getItem(TERMINE_WATCH_KEY);
    localStorage.setItem(TERMINE_WATCH_KEY, `${raw} `);
    return readWatch();
}

describe("an alert in words", () => {
    const where = centre("by-a", "BY", "Aach", []);
    const alert = { kind: "open" as const, centre: where, slot: slot("27-1", "2026-12-03", "free", { time: "14:30" }), more: 2 };
    const t = {
        termine_inbox_open_title: "Freier Platz in {city}",
        termine_inbox_body_more: "{centre}: {when} und {more} weitere.",
    };

    it("names the town, the centre and the day, and opens the exam dates", () => {
        expect(whenText({ date: "2026-12-03", time: "14:30" })).toBe("03.12.2026, 14:30");
        expect(whenText({ date: "2026-12-03" })).toBe("03.12.2026");
        expect(alertDraft(alert, TODAY)).toEqual({
            id: "termine-open-by-a/27-1-2026-11-22",
            type: "termine",
            titleKey: "termine_inbox_open_title",
            bodyKey: "termine_inbox_body_more",
            params: { city: "Aach", centre: "VHS Aach", when: "03.12.2026, 14:30", more: 2 },
            route: "/termine",
        });
        expect(alertText(alert, t, TODAY)).toEqual({ title: "Freier Platz in Aach", body: "VHS Aach: 03.12.2026, 14:30 und 2 weitere." });
    });
});
