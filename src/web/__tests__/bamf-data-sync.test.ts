// @vitest-environment node
/*
 * scripts/bamf-data-sync.mjs reads bamf.de itself: the exam date from the
 * Einbürgerung page and the exam centres from one .xlsx per state, through
 * the dependency-free reader in scripts/lib/xlsx.mjs. These tests build a
 * tiny workbook in memory (a minimal ZIP writer on node:zlib) and HTML
 * fixtures shaped like the live pages; nothing here touches the network.
 */
import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
    describeEvaluation,
    describePruefstellen,
    formatGermanDate,
    formatGermanDateTime,
    guardPruefstellen,
    moveWebsite,
    nextEvaluation,
    parseDownloadLinks,
    parseExamDate,
    rowsToCentres,
    STATES,
    validateEvaluation,
    validatePruefstellen,
} from "../../../scripts/bamf-data-sync.mjs";
import { columnIndex, decodeXml, readWorkbook, readZip } from "../../../scripts/lib/xlsx.mjs";

/** A ZIP with local headers, a central directory and the end record; `stored` entries use method 0. */
function zip(entries: { name: string; text: string; stored?: boolean }[], comment = ""): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const { name, text, stored } of entries) {
        const nameBytes = Buffer.from(name, "utf8");
        const raw = Buffer.from(text, "utf8");
        const data = stored ? raw : deflateRawSync(raw);
        const method = stored ? 0 : 8;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(method, 8);
        local.writeUInt32LE(crc32(raw), 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        locals.push(local, nameBytes, data);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(crc32(raw), 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBytes);
        offset += local.length + nameBytes.length + data.length;
    }
    const directory = Buffer.concat(centrals);
    const commentBytes = Buffer.from(comment, "utf8");
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(commentBytes.length, 20);
    return Buffer.concat([...locals, directory, end, commentBytes]);
}

const NBSP = "\u00a0";

const SHARED_STRINGS = [
    "Übersicht der benannten Einrichtungen als Prüfstellen für den Einbürgerungstest in Bayern",
    "Spalte 1",
    "Kreis / kreisfreie Stadt",
    "PLZ",
    "Ort",
    "Name der Prüfstelle",
    "Straße",
    "Telefon",
    "E-Mail",
    "Nürnberg",
    "<r><t>Sprache </t></r><r><rPh sb=\"0\" eb=\"1\"><t>x</t></rPh><t>&amp; Bildung GmbH</t></r>",
    "Gewerbemuseumsplatz 1",
    "0911/231-0",
    "info@example.org",
    `86551${NBSP}`,
    "Aichach-Friedberg",
    "VHS Landkreis Aichach-Friedberg e.V.",
    "Steubstr. 3",
    "Versteckt e.V.",
    "Stand 16.11.2020",
];

function sheetXml(rows: string): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:H8"/><sheetData>${rows}</sheetData></worksheet>`;
}

function s(ref: string, index: number): string {
    return `<c r="${ref}" s="2" t="s"><v>${index}</v></c>`;
}

const SHEET_ONE = sheetXml([
    "<row r=\"1\" spans=\"1:10\" ht=\"12.75\" customHeight=\"1\"/>",
    `<row r="2">${s("A2", 0)}<c r="B2" s="2"/><c r="C2" s="2"/></row>`,
    `<row r="3">${s("A3", 1)}${s("B3", 2)}${s("C3", 3)}${s("D3", 4)}${s("E3", 5)}${s("F3", 6)}${s("G3", 7)}${s("H3", 8)}</row>`,
    `<row r="4"><c r="A4" s="3"/><c r="B4" t="str"><v>Nürnberg</v></c><c r="C4" s="4"><v>90443</v></c>${s("D4", 9)}${s("E4", 10)}${s("F4", 11)}${s("G4", 12)}${s("H4", 13)}</row>`,
    `<row r="5"><c r="A5" s="3"/>${s("B5", 15)}${s("C5", 14)}<c r="D5" t="inlineStr"><is><t>Aichach</t></is></c>${s("E5", 16)}${s("F5", 17)}<c r="G5"/><c r="H5"/></row>`,
    `<row r="6" hidden="1"><c r="A6" s="3"/>${s("B6", 15)}${s("C6", 14)}${s("D6", 9)}${s("E6", 18)}${s("F6", 17)}</row>`,
    `<row r="7"><c r="A7" s="3"/>${s("B7", 15)}${s("C7", 14)}${s("D7", 9)}<c r="E7" s="5"/>${s("F7", 17)}</row>`,
    `<row r="8"><c r="A8" s="3"/>${s("B8", 19)}</row>`,
].join(""));

function workbook(comment = ""): Buffer {
    return zip([
        {
            name: "[Content_Types].xml",
            text: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"xml\" ContentType=\"application/xml\"/></Types>",
            stored: true,
        },
        {
            name: "xl/workbook.xml",
            text: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Tabelle1\" sheetId=\"1\" r:id=\"rId1\"/><sheet name=\"Tabelle2\" sheetId=\"2\" r:id=\"rId2\"/></sheets></workbook>",
        },
        {
            name: "xl/_rels/workbook.xml.rels",
            text: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet2.xml\"/><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings\" Target=\"sharedStrings.xml\"/></Relationships>",
        },
        {
            name: "xl/sharedStrings.xml",
            text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="30" uniqueCount="${SHARED_STRINGS.length}">${SHARED_STRINGS.map((text) => `<si>${text.startsWith("<r>") ? text : `<t xml:space="preserve">${text}</t>`}</si>`).join("")}</sst>`,
        },
        { name: "xl/worksheets/sheet1.xml", text: SHEET_ONE },
        { name: "xl/worksheets/sheet2.xml", text: sheetXml("") },
    ], comment);
}

const HEADER = ["Spalte 1", "Kreis / kreisfreie Stadt", "PLZ", "Ort", "Name der Prüfstelle", "Straße", "Telefon", "E-Mail"];

describe("xlsx reader", () => {
    it("lists the ZIP entries, stored and deflated, with or without an archive comment", () => {
        for (const comment of ["", "written by the test"]) {
            const entries = readZip(workbook(comment));
            expect([...entries.keys()]).toEqual([
                "[Content_Types].xml",
                "xl/workbook.xml",
                "xl/_rels/workbook.xml.rels",
                "xl/sharedStrings.xml",
                "xl/worksheets/sheet1.xml",
                "xl/worksheets/sheet2.xml",
            ]);
            expect(entries.get("[Content_Types].xml")?.toString("utf8")).toContain("<Types");
            expect(entries.get("xl/worksheets/sheet1.xml")?.toString("utf8")).toBe(SHEET_ONE);
        }
    });

    it("rejects what is not a ZIP or not a workbook", () => {
        expect(() => readZip(Buffer.from("<!DOCTYPE html><html></html>"))).toThrow(/PK signature/);
        expect(() => readWorkbook(zip([{ name: "a.txt", text: "hello" }]))).toThrow(/not a workbook/);
    });

    it("decodes entities and column letters", () => {
        expect(decodeXml("Sprache &amp; Bildung &lt;x&gt; &quot;a&quot; &apos;b&apos; &#228; &#xFC;")).toBe("Sprache & Bildung <x> \"a\" 'b' ä ü");
        expect(["A", "B", "Z", "AA", "AB", "D27"].map(columnIndex)).toEqual([0, 1, 25, 26, 27, 3]);
    });

    it("reads every sheet in workbook order as string cells, marking hidden rows", () => {
        const { sheets } = readWorkbook(workbook());
        expect(sheets.map((sheet) => sheet.name)).toEqual(["Tabelle1", "Tabelle2"]);
        expect(sheets[1].rows).toEqual([]);
        expect(sheets[0].rows).toEqual([
            { hidden: false, cells: [] },
            { hidden: false, cells: [SHARED_STRINGS[0]] },
            { hidden: false, cells: HEADER },
            { hidden: false, cells: ["", "Nürnberg", "90443", "Nürnberg", "Sprache & Bildung GmbH", "Gewerbemuseumsplatz 1", "0911/231-0", "info@example.org"] },
            { hidden: false, cells: ["", "Aichach-Friedberg", `86551${NBSP}`, "Aichach", "VHS Landkreis Aichach-Friedberg e.V.", "Steubstr. 3"] },
            { hidden: true, cells: ["", "Aichach-Friedberg", `86551${NBSP}`, "Nürnberg", "Versteckt e.V.", "Steubstr. 3"] },
            { hidden: false, cells: ["", "Aichach-Friedberg", `86551${NBSP}`, "Nürnberg", "", "Steubstr. 3"] },
            { hidden: false, cells: ["", "Stand 16.11.2020"] },
        ]);
    });
});

describe("rowsToCentres", () => {
    it("maps the columns by header text and skips title, header, hidden, nameless and trailer rows", () => {
        const { sheets } = readWorkbook(workbook());
        expect(rowsToCentres(sheets[0].rows)).toEqual([
            { regierungsbezirk: "Nürnberg", plz: "90443", ort: "Nürnberg", einrichtung: "Sprache & Bildung GmbH", straße: "Gewerbemuseumsplatz 1", telefon: "0911/231-0", email: "info@example.org" },
            { regierungsbezirk: "Aichach-Friedberg", plz: "86551", ort: "Aichach", einrichtung: "VHS Landkreis Aichach-Friedberg e.V.", straße: "Steubstr. 3", telefon: "", email: "" },
        ]);
        expect(rowsToCentres(sheets[1].rows)).toEqual([]);
    });

    it("places the fields right when a state has no Kreis column (Berlin)", () => {
        const centres = rowsToCentres([
            ["Übersicht der Prüfstellen in Berlin"],
            ["Spalte1", "PLZ", "Ort", "Namen der Prüfstelle", "Straße", "Telefon", "E-Mail"],
            ["", "10781 ", "Berlin", "VHS Berlin-Tempelhof-Schöneberg", "Barbarossaplatz 5", "030/90277/6990", "vhs@example.org"],
        ]);
        expect(centres).toEqual([
            { regierungsbezirk: "", plz: "10781", ort: "Berlin", einrichtung: "VHS Berlin-Tempelhof-Schöneberg", straße: "Barbarossaplatz 5", telefon: "030/90277/6990", email: "vhs@example.org" },
        ]);
    });

    it("accepts the header variants of the other states", () => {
        const rows = (header: string[]) => rowsToCentres([header, ["*", "Kreis X", "12345", "Stadt", "VHS", "Weg 1", "0", "a@b.de"]]);
        expect(rows(["Reg.-Bez.", "Kreis / kreisfreie Städte", "PLZ", "Ort", "Name der Prüfstelle ", "Straße", "Telefon", "E-Mail"])[0].regierungsbezirk).toBe("Kreis X");
        expect(rows(["", "Kreis / kreisfrie Stadt", "PLZ", "Ort", "Namen der Prüfstelle", "Straße", "Telefon", "E-Mail"])[0].einrichtung).toBe("VHS");
        expect(() => rowsToCentres([["PLZ", "Ort"], ["1", "2"]])).toThrow(/no einrichtung column/);
    });

    it("restores the leading zero of a postcode Excel stored as a number", () => {
        const header = ["", "Kreis", "PLZ", "Ort", "Name der Prüfstelle", "Straße", "Telefon", "E-Mail"];
        const plz = (value: string) => rowsToCentres([header, ["", "Halle", value, "Halle (Saale)", "VHS", "Weg 1", "", ""]])[0].plz;
        expect(plz("6108")).toBe("06108");
        expect(plz("06108")).toBe("06108");
        expect(plz("90443")).toBe("90443");
        expect(plz("")).toBe("");
    });

    it("moves a web address from the E-Mail column to website", () => {
        const header = ["", "Kreis", "PLZ", "Ort", "Name der Prüfstelle", "Straße", "Telefon", "E-Mail"];
        const centre = (email: string) => rowsToCentres([header, ["", "Ansbach", "91522", "Ansbach", "VHS", "Weg 1", "0", email]])[0];
        expect(centre(" www.landratsamt-ansbach.de ")).toMatchObject({ email: "", website: "www.landratsamt-ansbach.de" });
        expect(centre("vhs@example.org")).toEqual({ regierungsbezirk: "Ansbach", plz: "91522", ort: "Ansbach", einrichtung: "VHS", straße: "Weg 1", telefon: "0", email: "vhs@example.org" });
        expect(centre("")).not.toHaveProperty("website");
        expect(moveWebsite({ email: "vhs-verband-mv.de" })).toEqual({ email: "", website: "vhs-verband-mv.de" });
    });
});

const EVALUATION_HTML = `<main>
<div class="c-service-box"><div class="c-service-box__container">

  <p>Aktuell wertet das Bundesamt Tests bis Prüfungsdatum<strong> 24.08.2026</strong> aus.</p>
</div></div>
<div class="c-service-box__container">
  <p><span class="GSB-Modul">Es hilft, vor der Abgabe des Antrags ein <strong>Beratungsgespräch</strong> in der Behörde zu führen.</span></p>
</div>
<div class="c-service-box__container">
  <p><span class="GSB-Modul">Möglich ist die <strong>Ermessenseinbürgerung</strong> nach <strong>§ 8 StAG</strong>.</span></p>
</div>
</main>`;

describe("evaluation status", () => {
    it("finds the exam date next to Prüfungsdatum and nothing else", () => {
        expect(parseExamDate(EVALUATION_HTML)).toBe("24.08.2026");
        expect(() => parseExamDate(EVALUATION_HTML.replace("<strong> 24.08.2026</strong>", "<strong>Ende August</strong>"))).toThrow(/no exam date/);
        expect(() => parseExamDate(EVALUATION_HTML.replace("Prüfungsdatum", "Datum"))).toThrow(/no exam date/);
        expect(() => parseExamDate("<html><body><p>Zugriff verweigert</p></body></html>")).toThrow(/no exam date/);
    });

    it("renders Berlin time whatever the machine's zone", () => {
        expect(formatGermanDateTime(new Date("2026-11-02T14:00:00Z"))).toBe("02.11.2026 15:00:00");
        expect(formatGermanDateTime(new Date("2026-07-01T22:30:05Z"))).toBe("02.07.2026 00:30:05");
        expect(formatGermanDate(new Date("2026-01-05T23:59:59Z"))).toBe("06.01.2026");
    });

    const bundled = {
        examDate: "15.08.2026",
        lastSyncAt: "01.11.2026 12:38:53",
        history: [{ examDate: "15.08.2026", checkedAt: "16.10.2026" }],
    };
    const now = new Date("2026-11-02T14:00:00Z");

    it("keeps the history when the date is unchanged and appends when it moved", () => {
        const same = nextEvaluation(bundled, "15.08.2026", now);
        expect(same).toEqual({ examDate: "15.08.2026", lastSyncAt: "02.11.2026 15:00:00", history: bundled.history });
        expect(describeEvaluation(bundled, same)).toEqual(["lastSyncAt 01.11.2026 12:38:53 -> 02.11.2026 (today's check)"]);

        const moved = nextEvaluation(bundled, "24.08.2026", now);
        expect(moved.history).toEqual([...bundled.history, { examDate: "24.08.2026", checkedAt: "02.11.2026" }]);
        expect(bundled.history).toHaveLength(1);
        expect(describeEvaluation(bundled, moved)).toEqual([
            "examDate 15.08.2026 -> 24.08.2026",
            "lastSyncAt 01.11.2026 12:38:53 -> 02.11.2026 (today's check)",
            "history entries 1 -> 2",
        ]);
        validateEvaluation(moved);
    });

    it("reports nothing when the bundled check is from today and the date stands", () => {
        const today = { ...bundled, lastSyncAt: "02.11.2026 09:00:00" };
        expect(describeEvaluation(today, nextEvaluation(today, "15.08.2026", now))).toEqual([]);
    });

    it("validates the file shape", () => {
        expect(() => validateEvaluation([])).toThrow(/not a JSON object/);
        expect(() => validateEvaluation({ ...bundled, examDate: "2026-08-15" })).toThrow(/examDate/);
        expect(() => validateEvaluation({ ...bundled, lastSyncAt: "" })).toThrow(/lastSyncAt/);
        expect(() => validateEvaluation({ ...bundled, history: {} })).toThrow(/history is not a list/);
        expect(() => validateEvaluation({ ...bundled, history: [{ examDate: "x" }] })).toThrow(/history entry 0/);
    });
});

describe("exam centres", () => {
    const centre = (einrichtung: string, plz: string | number = "12345", ort = "Stadt") => ({ regierungsbezirk: "", plz, ort, einrichtung, straße: "", telefon: "", email: "" });
    const states = (fill: (code: string) => ReturnType<typeof centre>[]) => STATES.map((code) => ({ stateCode: code, data: fill(code) }));

    it("collects the xlsx download links of a landing page, entities decoded, html links ignored", () => {
        const html = `<ul>
<li><a class="c-link" href="https://www.BAMF.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-BY.html?nn=282388">Seite</a></li>
<li><a class="c-link c-link--download" href="https://www.BAMF.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-BY.xlsx?__blob=publicationFile&amp;v=77">Download</a></li>
<li><a href="https://www.BAMF.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-BY.xlsx?__blob=publicationFile&amp;v=77">Nochmal</a></li>
<li><a href="https://www.BAMF.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-BW.xlsx?__blob=publicationFile&amp;v=1">Anderes Land</a></li>
</ul>`;
        expect(parseDownloadLinks(html, "by")).toEqual(["https://www.BAMF.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-BY.xlsx?__blob=publicationFile&v=77"]);
        expect(parseDownloadLinks(html, "sh")).toEqual([]);
    });

    it("validates 16 distinct two-letter states with lists of centres", () => {
        validatePruefstellen(states(() => [centre("VHS")]));
        expect(() => validatePruefstellen({})).toThrow(/not a JSON list/);
        expect(() => validatePruefstellen(states(() => []).slice(1))).toThrow(/expected 16 states, found 15/);
        expect(() => validatePruefstellen([...states(() => []).slice(1), { stateCode: "th", data: [] }])).toThrow(/appears twice/);
        expect(() => validatePruefstellen([...states(() => []).slice(1), { stateCode: "XX", data: [] }])).toThrow(/two-letter/);
        expect(() => validatePruefstellen(states((code) => (code === "by" ? [{ ort: "x" } as never] : [])))).toThrow(/centre 0 of state by/);
    });

    it("refuses a list that shrank by more than half or lost a state", () => {
        const before = states(() => [centre("A"), centre("B"), centre("C"), centre("D")]);
        guardPruefstellen(before, states(() => [centre("A"), centre("B")]));
        expect(() => guardPruefstellen(before, states(() => [centre("A")]))).toThrow(/refusing to shrink/);
        expect(() => guardPruefstellen(before, states((code) => (code === "sh" ? [] : [centre("A"), centre("B"), centre("C")])))).toThrow(/state sh lists no exam centre/);
    });

    it("describes the change per state by added and removed centres, or in place", () => {
        const before = states((code) => {
            if (code === "by") return [centre("A"), centre("B"), centre("C")];
            if (code === "rp") return [centre("R", 56068)];
            if (code === "sn") return [centre("S", 9112, "Chemnitz")];
            return [centre("X")];
        });
        const after = states((code) => {
            if (code === "by") return [centre("A"), centre("D"), centre("E"), centre("F")];
            if (code === "rp") return [{ ...centre("R", "56068"), email: "r@example.org" }];
            if (code === "sn") return [centre("S", "9112", "Chemnitz")];
            return [centre("X")];
        });
        expect(describePruefstellen(before, after)).toEqual([
            "centres 18 -> 19",
            "  by 3 -> 4 (+3 / -2)",
            "  rp: 1 entries changed in place",
        ]);
        expect(describePruefstellen(before, before)).toEqual([]);
    });
});
