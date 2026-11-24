/*
 * What the pages per state - the exam centres and the question catalogue -
 * tell a search engine about their address. The layout names the start page
 * as the default original, so a page that says nothing declares itself a
 * copy of the start page.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateMetadata as centresMetadata } from "@/app/pruefstellen/[state]/page";
import { generateMetadata as catalogueMetadata } from "@/app/question-catalogue/[[...state]]/page";
import { statesData } from "@/data/data";

const CODES = statesData().map((state) => state.code.toUpperCase());

async function centresAddress(state: string) {
    return (await centresMetadata({ params: Promise.resolve({ state }) })).alternates?.canonical;
}

async function catalogueAddress(state?: string) {
    return (await catalogueMetadata({ params: Promise.resolve(state ? { state: [state] } : {}) })).alternates?.canonical;
}

/** The addresses the sitemap lists at or below `prefix`, without the host. */
function listed(prefix: string): string[] {
    const sitemap = new DOMParser().parseFromString(readFileSync(path.join(process.cwd(), "app/sitemap.xml"), "utf8"), "application/xml");
    return Array.from(sitemap.querySelectorAll("loc"))
        .map((loc) => new URL(loc.textContent ?? "").pathname)
        .filter((address) => address === prefix || address.startsWith(`${prefix}/`))
        .sort();
}

describe("pages per state for search engines", () => {
    it("names the exam centres of a state under their own address, however the state is written", async () => {
        expect(await centresAddress("BY")).toBe("/pruefstellen/BY");
        expect(await centresAddress("by")).toBe("/pruefstellen/BY");
    });

    it("names the general catalogue and each state's questions under their own address", async () => {
        expect(await catalogueAddress()).toBe("/question-catalogue");
        expect(await catalogueAddress("BY")).toBe("/question-catalogue/BY");
        expect(await catalogueAddress("by")).toBe("/question-catalogue/BY");
    });

    it("uses exactly the addresses the sitemap lists for these pages", async () => {
        const centres = await Promise.all(CODES.map((code) => centresAddress(code)));
        const catalogue = [await catalogueAddress(), ...(await Promise.all(CODES.map((code) => catalogueAddress(code))))];
        expect(listed("/pruefstellen")).toEqual([...centres].sort());
        expect(listed("/question-catalogue")).toEqual([...catalogue].sort());
    });
});
