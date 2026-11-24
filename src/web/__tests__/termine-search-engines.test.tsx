/*
 * What a search engine and a link preview learn about the exam-dates pages
 * (ADR-050) before any script runs: each page under its own address and
 * title, the way to it as breadcrumbs, and a sitemap that names the pages on
 * the host the pages themselves call canonical.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/termine/[[...state]]/page";
import { TermineJsonLd } from "@/components/termine/termine-json-ld";
import { siteConfig } from "@/config/site";
import { statesData } from "@/data/data";
import { termineRegistry } from "@/data/termine-registry";

const SITE = siteConfig.links.website;

function parse(markup: string, type: DOMParserSupportedType): Document {
    return new DOMParser().parseFromString(markup, type);
}

describe("exam-dates pages for search engines", () => {
    it("gives every state's page its own title, address and link preview - however the state is written", async () => {
        const page = await generateMetadata({ params: Promise.resolve({ state: ["by"] }) });
        // Absolute: the layout's template would append the site name, which starts with "Einbürgerungstest" again.
        expect(page.title).toEqual({ absolute: "Einbürgerungstest Termine in Bayern: freie Plätze | Leben in Deutschland" });
        expect(page.alternates?.canonical).toBe("/termine/BY");
        expect(page.openGraph).toMatchObject({ url: "/termine/BY", title: "Einbürgerungstest Termine in Bayern: freie Plätze", description: page.description, locale: "de_DE" });
        expect(page.twitter).toMatchObject({ title: "Einbürgerungstest Termine in Bayern: freie Plätze", description: page.description });

        const overview = await generateMetadata({ params: Promise.resolve({}) });
        expect(overview.alternates?.canonical).toBe("/termine");
        expect(overview.openGraph).toMatchObject({ url: "/termine" });
    });

    it("describes the way to a state's page as breadcrumbs", () => {
        const bayern = statesData().find((state) => state.code.toUpperCase() === "BY")!;
        const script = parse(renderToStaticMarkup(<TermineJsonLd state={bayern} />), "text/html").querySelector("script[type='application/ld+json']")!;
        const trail = JSON.parse(script.textContent!);
        expect(trail["@type"]).toBe("BreadcrumbList");
        expect(trail.itemListElement.map((entry: { position: number; name: string; item: string }) => [entry.position, entry.name, entry.item])).toEqual([
            [1, "Startseite", SITE],
            [2, "Prüfungstermine", `${SITE}/termine`],
            [3, "Bayern", `${SITE}/termine/BY`],
        ]);
    });

    it("has a state's page for every centre of the registry", () => {
        const registry = termineRegistry();
        expect(registry.length).toBeGreaterThan(0);
        const codes = new Set(statesData().map((state) => state.code.toUpperCase()));
        expect(registry.filter((centre) => !codes.has(centre.state))).toEqual([]);
    });

    it("names every page of the sitemap on the canonical host, the overview and each state's page among them", () => {
        const sitemap = parse(readFileSync(path.join(process.cwd(), "app/sitemap.xml"), "utf8"), "application/xml");
        const addresses = Array.from(sitemap.querySelectorAll("loc")).map((loc) => loc.textContent ?? "");
        expect(addresses.length).toBeGreaterThan(0);
        expect(addresses.filter((address) => address !== SITE && !address.startsWith(`${SITE}/`))).toEqual([]);
        const expected = [`${SITE}/termine`, ...statesData().map((state) => `${SITE}/termine/${state.code.toUpperCase()}`)];
        expect(addresses.filter((address) => address.startsWith(`${SITE}/termine`)).sort()).toEqual(expected.sort());
    });
});
