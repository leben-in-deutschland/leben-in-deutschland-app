/*
 * Exam centres (/pruefstellen/<state>): BAMF's "E-Mail" column sometimes holds
 * a web address ("www.landratsamt-ansbach.de"). Such a value opens the website
 * in a new tab; only a value with "@" opens a mail draft.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CentersList, toCenter, toContact } from "@/components/landing/centers-list";
import prüfstellen from "@/data/prüfstellen.json";
import type { Prüfstellen, PrüfstellenData } from "@/types/prüfstellen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const place = (einrichtung: string, email: string): Prüfstellen => ({
    regierungsbezirk: "Mittelfranken",
    plz: "91522",
    ort: "Ansbach",
    einrichtung,
    straße: "Crailsheimstraße 1",
    telefon: "0981 4680",
    email,
});

const MAIL_CENTER = place("VHS Mail", "info@vhs-beispiel.de");
const WEB_CENTER = place("VHS des Landkreises Ansbach", "www.landratsamt-ansbach.de");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
});

async function mount(centers: Prüfstellen[]) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<CentersList stateCode="by" stateName="Bayern" centers={centers} states={[]} />);
    });
}

function linkFor(label: string): HTMLAnchorElement {
    const link = Array.from(container!.querySelectorAll("a")).find((a) => a.textContent?.includes(label));
    if (!link) throw new Error(`no link labelled ${label}`);
    return link;
}

describe("toContact", () => {
    it("turns an address into a mailto: link", () => {
        expect(toContact("info@vhs-beispiel.de")).toEqual({ kind: "mail", label: "info@vhs-beispiel.de", href: "mailto:info@vhs-beispiel.de" });
    });

    it("turns a host with or without www. into a website link", () => {
        expect(toContact("www.landratsamt-ansbach.de")?.href).toBe("https://www.landratsamt-ansbach.de");
        expect(toContact(" vhs-verband-mv.de ")?.href).toBe("https://vhs-verband-mv.de");
        expect(toContact("www.sputnik-garath.com")).toMatchObject({ kind: "web", href: "https://www.sputnik-garath.com" });
        expect(toContact("http://example.org/kurse")?.href).toBe("https://example.org/kurse");
    });

    it("links nothing for an empty or unrecognisable value", () => {
        expect(toContact("")).toBeNull();
        expect(toContact(undefined)).toBeNull();
        expect(toContact("siehe Aushang")).toEqual({ kind: "text", label: "siehe Aushang", href: null });
        expect(toContact("kein @ adresse")?.href).toBeNull();
    });

    it("never builds a mailto: link without @ from the bundled exam centres", () => {
        const centers = (prüfstellen as PrüfstellenData[]).flatMap((state) => state.data.map(toCenter));
        const hrefs = centers.map((center) => center.contact?.href).filter((href): href is string => Boolean(href));
        expect(hrefs.length).toBeGreaterThan(600);
        for (const href of hrefs) {
            if (href.startsWith("mailto:")) expect(href).toContain("@");
            else expect(href).toMatch(/^https:\/\/[^@\s]+$/);
        }
        expect(hrefs).toContain("https://www.landratsamt-ansbach.de");
    });

    it("keeps every e-mail value of the bundled exam centres an address (the sync moves a host to website)", () => {
        const places = (prüfstellen as PrüfstellenData[]).flatMap((state) => state.data as Prüfstellen[]);
        expect(places.filter((p) => p.email.trim() && !p.email.includes("@"))).toEqual([]);
        expect(places.filter((p) => p.website).map((p) => p.website)).toContain("www.landratsamt-ansbach.de");
    });

    it("opens the website field when the e-mail is empty", () => {
        const center = toCenter({ ...place("VHS des Landkreises Ansbach", ""), website: "www.landratsamt-ansbach.de" }, 0);
        expect(center.contact).toMatchObject({ kind: "web", href: "https://www.landratsamt-ansbach.de" });
        expect(toCenter({ ...place("VHS", "a@b.de"), website: "www.b.de" }, 0).contact?.href).toBe("mailto:a@b.de");
    });
});

describe("CentersList contact links", () => {
    it("renders an address as mailto: and a web address as a website in a new tab", async () => {
        await mount([MAIL_CENTER, WEB_CENTER]);

        const mail = linkFor("info@vhs-beispiel.de");
        expect(mail.getAttribute("href")).toBe("mailto:info@vhs-beispiel.de");
        expect(mail.getAttribute("target")).toBeNull();

        const web = linkFor("www.landratsamt-ansbach.de");
        expect(web.getAttribute("href")).toBe("https://www.landratsamt-ansbach.de");
        expect(web.getAttribute("target")).toBe("_blank");
        expect(web.getAttribute("rel")).toContain("noopener");

        expect(container!.querySelector('a[href^="mailto:www."]')).toBeNull();
    });
});
