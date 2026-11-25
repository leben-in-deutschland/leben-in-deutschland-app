/*
 * The row of states above the exam dates, the question catalogue and the
 * list of exam centres: every state with its flag and its full name - a
 * learner need not know that "MV" is Mecklenburg-Vorpommern - and the
 * current state in view on a phone, where the row moves sideways.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatePicker } from "@/components/landing/state-picker";
import { statesData } from "@/data/data";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STATES = statesData();

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.restoreAllMocks();
});

async function mount(current: string) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<StatePicker label="Bundesland" states={STATES} current={current} hrefFor={(code) => (code ? `/termine/${code}` : "/termine")} allLabel="Alle" />);
    });
    return container.querySelector("nav")!;
}

describe("row of states", () => {
    it("shows every state with its flag and its full name, the current one marked", async () => {
        const row = await mount("BY");
        const entries = Array.from(row.querySelectorAll("li a"));
        expect(entries).toHaveLength(STATES.length + 1);

        const [all, ...states] = entries;
        expect(all.textContent).toBe("Alle");
        expect(all.getAttribute("href")).toBe("/termine");
        // Every state together: Germany's colours, drawn, no picture file.
        expect(all.querySelector("[data-flag='de']")).not.toBeNull();
        expect(all.querySelector("img")).toBeNull();

        expect(states.map((entry) => entry.textContent)).toEqual(STATES.map((state) => state.name));
        expect(states.map((entry) => entry.getAttribute("href"))).toEqual(STATES.map((state) => `/termine/${state.code.toUpperCase()}`));
        // The name is written out beside the flag, so the picture itself is silent for a screen reader.
        expect(states.map((entry) => [entry.querySelector("img")?.getAttribute("src"), entry.querySelector("img")?.getAttribute("alt")])).toEqual(
            STATES.map((state) => [`/states/flag/${state.name}.svg`, ""]),
        );
        expect(row.querySelectorAll("[aria-current='page']")).toHaveLength(1);
        expect(row.querySelector("[aria-current='page']")?.textContent).toBe("Bayern");
    });

    it("has a flag for every state, under the state's name exactly as the page asks for it", () => {
        const files = readdirSync(path.join(process.cwd(), "public/states/flag"));
        expect(STATES.filter((state) => !files.includes(`${state.name}.svg`)).map((state) => state.name)).toEqual([]);
    });

    it("gives every state a flag of its own", () => {
        // Saarland once carried the file of Mecklenburg-Vorpommern.
        const picture = (name: string) => createHash("sha256").update(readFileSync(path.join(process.cwd(), "public/states/flag", `${name}.svg`))).digest("hex");
        const owners = new Map<string, string[]>();
        for (const state of STATES) {
            const key = picture(state.name);
            owners.set(key, [...(owners.get(key) ?? []), state.name]);
        }
        expect([...owners.values()].filter((names) => names.length > 1)).toEqual([]);
    });

    it("brings the current state into view when the row is wider than the screen, without moving the page", async () => {
        // A phone: the row shows 300px of 2000px, and the current state sits at 900px.
        vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
            return this.tagName === "NAV" ? 2000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
            return this.tagName === "NAV" ? 300 : 0;
        });
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            const [left, width] = this.tagName === "NAV" ? [0, 300] : this.getAttribute("aria-current") === "page" ? [900, 200] : [0, 0];
            return { left, right: left + width, width, top: 0, bottom: 44, height: 44, x: left, y: 0, toJSON: () => ({}) };
        });
        const scrollIntoView = vi.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoView;

        const row = await mount("TH");
        // Centred: 900 - (300 - 200) / 2.
        expect(row.scrollLeft).toBe(850);
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it("leaves the row alone when the current state is already in view", async () => {
        vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
            return this.tagName === "NAV" ? 2000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
            return this.tagName === "NAV" ? 300 : 0;
        });
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            const [left, width] = this.tagName === "NAV" ? [0, 300] : this.getAttribute("aria-current") === "page" ? [60, 200] : [0, 0];
            return { left, right: left + width, width, top: 0, bottom: 44, height: 44, x: left, y: 0, toJSON: () => ({}) };
        });

        const row = await mount("BW");
        expect(row.scrollLeft).toBe(0);
    });
});
