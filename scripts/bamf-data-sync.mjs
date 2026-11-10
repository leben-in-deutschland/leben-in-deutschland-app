#!/usr/bin/env node
// Keeps the app's bundled copies of two BAMF data files in step with bamf.de:
//
//   evaluation    src/web/data/current-evaluation.json   BAMF's evaluation status (exam date, last check)
//   pruefstellen  src/web/data/prüfstellen.json          the exam centres of the 16 states
//
//   node scripts/bamf-data-sync.mjs <source> --check   # watch: print what changed, write nothing
//   node scripts/bamf-data-sync.mjs <source>           # scrape, validate, write, bump the patch version
//
// `--check` is what the PULSE watch automations run (.pulse/automations/*.sh): it
// prints nothing and exits 0 when bamf.de agrees with the bundled file, prints
// a short description of the change when it differs, and exits 1 when the
// scrape failed or is not the shape the app expects. Without `--check` the
// script writes the new file and bumps the patch version in src/web/package.json
// and src/web/package-lock.json, the way the former GitHub workflows did; the
// caller commits.
//
// The data used to come from a separate scraper repository that is archived
// now; this script reads the same two sources it read: the Einbürgerung page
// for the evaluation status and one .xlsx per state for the exam centres.
//
// Node 22, built-ins only: the daemon runs the watch in a fresh worktree of the
// default branch where src/web/node_modules does not exist.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument, getHtml } from "../src/catalogue/lib/http.mjs";
import { decodeXml, readWorkbook } from "./lib/xlsx.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "..");
const webRoot = path.join(repoRoot, "src/web");

const BAMF = "https://www.bamf.de";
const EVALUATION_PAGE = `${BAMF}/DE/Themen/Integration/ZugewanderteTeilnehmende/Einbuergerung/einbuergerung-node.html`;
const PRUEFSTELLEN_PAGE = (code) => `${BAMF}/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-${code.toUpperCase()}.xlsx`;

/** The 16 states in the order of the bundled file (and of the former scraper). */
export const STATES = ["bb", "be", "bw", "by", "hb", "he", "hh", "mv", "ni", "nw", "rp", "sh", "sl", "sn", "st", "th"];

const GERMAN_DATE = /^\d{1,2}\.\d{1,2}\.\d{4}(\s.*)?$/;
const STATE_CODE = /^[a-z]{2}$/;
const STATE_COUNT = 16;

export const SOURCES = {
    evaluation: {
        file: "src/web/data/current-evaluation.json",
        label: "BAMF evaluation status",
        validate: validateEvaluation,
        scrape: scrapeEvaluation,
        describe: describeEvaluation,
        headline: (file) => `bamf.de shows a newer status than ${file}.`,
        commitMessage: (data) => `data: BAMF evaluation status ${data.examDate} (checked ${data.lastSyncAt.split(" ")[0]})`,
    },
    pruefstellen: {
        file: "src/web/data/prüfstellen.json",
        label: "exam centres (Prüfstellen)",
        validate: validatePruefstellen,
        scrape: scrapePruefstellen,
        describe: describePruefstellen,
        headline: (file) => `bamf.de lists a different set than ${file}.`,
        commitMessage: (data) => `data: exam centres from bamf.de (${countCentres(data)} centres)`,
    },
};

function isString(value) {
    return typeof value === "string";
}

function isGermanDate(value) {
    return isString(value) && GERMAN_DATE.test(value.trim());
}

/** The shape `isEvaluationData` in src/web/utils/evaluation-store.ts accepts. */
export function validateEvaluation(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("the evaluation file is not a JSON object");
    }
    if (!isGermanDate(data.examDate)) {
        throw new Error("examDate is not a German date (dd.mm.yyyy)");
    }
    if (!isGermanDate(data.lastSyncAt)) {
        throw new Error("lastSyncAt is not a German date (dd.mm.yyyy[ hh:mm:ss])");
    }
    if (!Array.isArray(data.history)) {
        throw new Error("history is not a list");
    }
    data.history.forEach((entry, index) => {
        if (typeof entry !== "object" || entry === null || !isString(entry.examDate) || !isString(entry.checkedAt)) {
            throw new Error(`history entry ${index} lacks examDate or checkedAt`);
        }
    });
}

/** The shape `PrüfstellenData[]` in src/web/types/prüfstellen.ts describes: 16 states, each with its centres. */
export function validatePruefstellen(data) {
    if (!Array.isArray(data)) {
        throw new Error("the exam-centre file is not a JSON list");
    }
    if (data.length !== STATE_COUNT) {
        throw new Error(`expected ${STATE_COUNT} states, found ${data.length}`);
    }
    const seen = new Set();
    for (const state of data) {
        if (typeof state !== "object" || state === null || !isString(state.stateCode) || !STATE_CODE.test(state.stateCode)) {
            throw new Error("a state entry has no two-letter stateCode");
        }
        if (seen.has(state.stateCode)) {
            throw new Error(`state ${state.stateCode} appears twice`);
        }
        seen.add(state.stateCode);
        if (!Array.isArray(state.data)) {
            throw new Error(`state ${state.stateCode} has no list of centres`);
        }
        state.data.forEach((centre, index) => {
            if (typeof centre !== "object" || centre === null || !isString(centre.ort) || !isString(centre.einrichtung)) {
                throw new Error(`centre ${index} of state ${state.stateCode} lacks ort or einrichtung`);
            }
        });
    }
}

function countCentres(data) {
    return data.reduce((sum, state) => sum + state.data.length, 0);
}

function change(name, before, after) {
    return before === after ? null : `${name} ${before} -> ${after}`;
}

// ---------------------------------------------------------------------------
// Dates. The file shows "last checked" to users in Germany, and the former
// GitHub runner stamped it in UTC - an hour or two behind what the user's
// clock says. Every date and time this script writes is Europe/Berlin,
// whatever the machine's zone.

function berlinParts(date) {
    const parts = {};
    for (const { type, value } of new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date)) {
        parts[type] = value;
    }
    return parts;
}

/** `02.11.2026` in Europe/Berlin. */
export function formatGermanDate(date) {
    const { day, month, year } = berlinParts(date);
    return `${day}.${month}.${year}`;
}

/** `02.11.2026 15:00:00` in Europe/Berlin. */
export function formatGermanDateTime(date) {
    const { hour, minute, second } = berlinParts(date);
    return `${formatGermanDate(date)} ${hour}:${minute}:${second}`;
}

// ---------------------------------------------------------------------------
// Source `evaluation`: the Einbürgerung page carries a service box with the
// sentence "Aktuell wertet das Bundesamt Tests bis Prüfungsdatum
// <strong> 24.08.2026</strong> aus." Two other service boxes on the page
// hold unrelated bold text, so the date is accepted only next to that word.

const DATE_TEXT = /^\d{1,2}\.\d{1,2}\.\d{4}$/;

/** The exam date BAMF is evaluating up to, or a throw: a missing date is never guessed. */
export function parseExamDate(html) {
    for (const box of html.matchAll(/<div class="c-service-box__container">(.*?)<\/div>/gs)) {
        for (const paragraph of box[1].matchAll(/<p\b[^>]*>(.*?)<\/p>/gs)) {
            if (!paragraph[1].includes("Prüfungsdatum")) {
                continue;
            }
            for (const strong of paragraph[1].matchAll(/<strong\b[^>]*>(.*?)<\/strong>/gs)) {
                const text = decodeXml(strong[1].replace(/<[^>]+>/g, "")).trim();
                if (DATE_TEXT.test(text)) {
                    return text;
                }
            }
        }
    }
    throw new Error("no exam date found on the Einbürgerung page (no <strong> date next to \"Prüfungsdatum\" in a c-service-box__container)");
}

/**
 * The next evaluation file: the scraped date, this check's time, and the
 * history extended by one entry only when the date moved. The history is a
 * record of when each date was first seen, so an unchanged date leaves it alone.
 */
export function nextEvaluation(bundled, examDate, now = new Date()) {
    const history = examDate === bundled.examDate ? bundled.history : [...bundled.history, { examDate, checkedAt: formatGermanDate(now) }];
    return { examDate, lastSyncAt: formatGermanDateTime(now), history };
}

async function scrapeEvaluation(bundled) {
    const examDate = parseExamDate(await getHtml(EVALUATION_PAGE));
    return nextEvaluation(bundled, examDate, new Date());
}

/** One line per changed fact; empty when the files are equal in every fact we name. */
export function describeEvaluation(before, after) {
    const today = after.lastSyncAt.split(" ")[0];
    return [
        change("examDate", before.examDate, after.examDate),
        before.lastSyncAt.split(" ")[0] === today ? null : `lastSyncAt ${before.lastSyncAt} -> ${today} (today's check)`,
        change("history entries", before.history.length, after.history.length),
    ].filter(Boolean);
}

/**
 * The daily job refreshes "last checked" every day, like the former GitHub
 * Action did; so the file counts as changed when the date moved or when the
 * bundled check is not from today. The seconds of `lastSyncAt` do not matter.
 */
function evaluationChanged(before, after) {
    return describeEvaluation(before, after).length > 0;
}

// ---------------------------------------------------------------------------
// Source `pruefstellen`: one workbook per state, reached through an HTML
// landing page (the .xlsx URL without a query) that links the file with a
// `?__blob=publicationFile&v=N` query. Each workbook has one filled sheet
// with a title row, a header row, the centres, and sometimes a "Stand
// dd.mm.yyyy" trailer; the header wording differs slightly between states,
// so columns are mapped by their header text, never by position (the former
// scraper used positions and shipped one state shifted by a column).

const COLUMNS = [
    { field: "regierungsbezirk", header: /^Kreis\b/ },
    { field: "plz", header: /^PLZ$/ },
    { field: "ort", header: /^Ort$/ },
    { field: "einrichtung", header: /^Namen? der Prüfstelle$/ },
    { field: "straße", header: /^Straße$/ },
    { field: "telefon", header: /^Telefon$/ },
    { field: "email", header: /^E-Mail$/ },
];

/**
 * States whose "Kreis / kreisfreie Stadt" column does not belong to its rows.
 * BAMF's Pruefstellen-RP.xlsx sorts that column on its own, apart from the
 * rows (read 2026-11-10 with scripts/lib/xlsx.mjs: the first data row is
 * ["", "Ludwigshafen am Rhein", "57610", "Altenkirchen (Westerwald)", ...];
 * Alzey read "Landau in der Pfalz", Worms "Koblenz", and only 3 of 53 rows
 * named a district containing the town). A district from another row makes
 * a learner who searches the list for a district find the wrong centres, so
 * these states get no district at all - the list hides an empty one, as for
 * Berlin. Remove a state here once BAMF's workbook is sorted again.
 */
export const SCRAMBLED_DISTRICT_STATES = new Set(["rp"]);

/** The `Pruefstellen-XX.xlsx?__blob=...` download links of a state's landing page, entities decoded. */
export function parseDownloadLinks(html, code) {
    const name = `Pruefstellen-${code.toUpperCase()}.xlsx?`;
    const links = [];
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
        const href = decodeXml(match[1]);
        if (href.includes(name) && !links.includes(href)) {
            links.push(href);
        }
    }
    return links;
}

/**
 * BAMF's "E-Mail" column sometimes holds a web address instead of an address
 * ("www.landratsamt-ansbach.de" in Bavaria, "vhs-verband-mv.de"). A value
 * without "@" is no address: it moves to `website` and leaves `email` empty,
 * so the file never offers a mail draft to a host. The field exists only on
 * the centres that need it.
 */
export function moveWebsite(centre) {
    const value = String(centre.email ?? "").trim();
    if (value && !value.includes("@")) {
        centre.email = "";
        centre.website = value;
    }
    return centre;
}

/**
 * The centres of one sheet from its rows (`{ hidden, cells }` as the reader
 * returns them, or plain string arrays). Returns an empty list for a sheet
 * without a header row - the empty companion sheets of every workbook.
 * `code` is the state; a state in SCRAMBLED_DISTRICT_STATES keeps the
 * district empty.
 */
export function rowsToCentres(rows, code = "") {
    const dropDistrict = SCRAMBLED_DISTRICT_STATES.has(code);
    const normalised = rows.map((row) => (Array.isArray(row) ? { hidden: false, cells: row } : row));
    const headerAt = normalised.findIndex((row) => row.cells.some((cell) => cell.trim() === "PLZ"));
    if (headerAt < 0) {
        return [];
    }
    const header = normalised[headerAt].cells.map((cell) => cell.trim());
    const index = {};
    for (const { field, header: pattern } of COLUMNS) {
        index[field] = header.findIndex((cell) => pattern.test(cell));
    }
    for (const field of ["plz", "ort", "einrichtung"]) {
        if (index[field] < 0) {
            throw new Error(`the header row ${JSON.stringify(header)} has no ${field} column`);
        }
    }
    const centres = [];
    for (const { hidden, cells } of normalised.slice(headerAt + 1)) {
        const first = (cells.find((cell) => cell.trim()) ?? "").trim();
        if (hidden || first.startsWith("Stand")) {
            continue;
        }
        const centre = {};
        for (const { field } of COLUMNS) {
            centre[field] = index[field] < 0 ? "" : (cells[index[field]] ?? "").trim();
        }
        if (dropDistrict) {
            centre.regierungsbezirk = "";
        }
        // Excel keeps a postcode typed as a number without its leading zero
        // (Saxony, Saxony-Anhalt, Brandenburg): "6108" is 06108.
        if (/^\d{4}$/.test(centre.plz)) {
            centre.plz = `0${centre.plz}`;
        }
        moveWebsite(centre);
        if (centre.einrichtung) {
            centres.push(centre);
        }
    }
    return centres;
}

async function scrapeState(code) {
    const links = parseDownloadLinks(await getHtml(PRUEFSTELLEN_PAGE(code)), code);
    if (links.length === 0) {
        throw new Error(`the landing page of state ${code} links no Pruefstellen-${code.toUpperCase()}.xlsx file`);
    }
    const centres = [];
    for (const link of links) {
        const { buffer, contentType } = await getDocument(link);
        if (buffer.subarray(0, 2).toString("latin1") !== "PK") {
            throw new Error(`the download for state ${code} is not an .xlsx file (${contentType.split(";")[0] || "no content type"}); the site's WAF may have answered instead`);
        }
        for (const sheet of readWorkbook(buffer).sheets) {
            centres.push(...rowsToCentres(sheet.rows, code));
        }
    }
    if (centres.length === 0) {
        throw new Error(`state ${code} lists no exam centre`);
    }
    return centres;
}

async function scrapePruefstellen() {
    const data = [];
    // One state after the other: bamf.de need not see a burst of 32 requests.
    for (const code of STATES) {
        data.push({ stateCode: code, data: await scrapeState(code) });
    }
    return data;
}

function centreKey(centre) {
    return [centre.einrichtung, centre.plz, centre.ort].map((value) => String(value ?? "").trim()).join("|");
}

/** A centre with every field a trimmed string, so a numeric PLZ compares equal to its text. */
function normaliseCentre(centre) {
    const normalised = {};
    for (const field of [...COLUMNS.map((column) => column.field), "website"]) {
        normalised[field] = String(centre[field] ?? "").trim();
    }
    return normalised;
}

function normalisePruefstellen(data) {
    return data.map((state) => ({ stateCode: state.stateCode, data: state.data.map(normaliseCentre) }));
}

export function describePruefstellen(before, after) {
    const lines = [change("centres", countCentres(before), countCentres(after))].filter(Boolean);
    const states = new Map(before.map((state) => [state.stateCode, state]));
    for (const state of after) {
        const was = states.get(state.stateCode)?.data ?? [];
        const wasKeys = new Set(was.map(centreKey));
        const nowKeys = new Set(state.data.map(centreKey));
        const added = state.data.filter((centre) => !wasKeys.has(centreKey(centre))).length;
        const removed = was.filter((centre) => !nowKeys.has(centreKey(centre))).length;
        if (added || removed) {
            lines.push(`  ${state.stateCode} ${was.length} -> ${state.data.length} (+${added} / -${removed})`);
        } else if (JSON.stringify(was.map(normaliseCentre)) !== JSON.stringify(state.data.map(normaliseCentre))) {
            const inPlace = state.data.filter((centre, i) => JSON.stringify(normaliseCentre(centre)) !== JSON.stringify(normaliseCentre(was[i] ?? {}))).length;
            lines.push(`  ${state.stateCode}: ${inPlace} entries changed in place`);
        }
    }
    return lines;
}

function pruefstellenChanged(before, after) {
    return JSON.stringify(normalisePruefstellen(before)) !== JSON.stringify(normalisePruefstellen(after));
}

/**
 * The centres are scraped from scratch; a half-empty result means a scrape
 * went wrong, not that half the centres closed. Refuse to carry that over.
 */
export function guardPruefstellen(before, after) {
    const was = countCentres(before);
    const now = countCentres(after);
    if (now * 2 < was) {
        throw new Error(`bamf.de lists ${now} centres, the bundled file ${was}; refusing to shrink the list by more than half`);
    }
    for (const state of after) {
        if (state.data.length === 0) {
            throw new Error(`state ${state.stateCode} lists no exam centre`);
        }
    }
}

// ---------------------------------------------------------------------------

function parse(text, what) {
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${what} is not valid JSON`);
    }
}

function bumpPatch(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) {
        throw new Error(`the version ${JSON.stringify(version)} is not major.minor.patch`);
    }
    return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

/**
 * Bumps the patch version in package.json and package-lock.json the way
 * `npm version patch --no-git-tag-version` would, without npm: the installed
 * npm may rewrite the lockfile in its own dialect (see the project memory).
 * Only files that re-serialise byte for byte are touched.
 */
export function bumpVersion() {
    const files = [
        { file: path.join(webRoot, "package.json"), set: (json, version) => { json.version = version; } },
        {
            file: path.join(webRoot, "package-lock.json"),
            set: (json, version) => {
                json.version = version;
                if (json.packages?.[""]) {
                    json.packages[""].version = version;
                }
            },
        },
    ];
    const loaded = files.map(({ file, set }) => {
        const text = readFileSync(file, "utf8");
        const json = parse(text, path.relative(repoRoot, file));
        if (`${JSON.stringify(json, null, 2)}\n` !== text) {
            throw new Error(`${path.relative(repoRoot, file)} is not in npm's two-space JSON format; bump the version by hand`);
        }
        return { file, set, json };
    });
    const current = loaded[0].json.version;
    const next = bumpPatch(current);
    for (const { file, set, json } of loaded) {
        set(json, next);
        writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    }
    return { current, next };
}

export async function run(sourceName, { check }) {
    const source = SOURCES[sourceName];
    const filePath = path.join(repoRoot, source.file);
    const bundled = parse(readFileSync(filePath, "utf8"), source.file);
    source.validate(bundled);

    const scraped = await source.scrape(bundled);
    source.validate(scraped);
    let changed;
    if (sourceName === "pruefstellen") {
        guardPruefstellen(bundled, scraped);
        changed = pruefstellenChanged(bundled, scraped);
    } else {
        changed = evaluationChanged(bundled, scraped);
    }

    if (!changed) {
        if (!check) {
            console.log(`${source.file} is up to date with bamf.de; nothing written.`);
        }
        return { changed: false };
    }

    const lines = source.describe(bundled, scraped);
    if (lines.length === 0) {
        lines.push("the file differs only in formatting or in facts this script does not name");
    }
    if (check) {
        console.log(`${source.label}: ${source.headline(source.file)}`);
        for (const line of lines) {
            console.log(`  ${line}`);
        }
        return { changed: true };
    }

    writeFileSync(filePath, `${JSON.stringify(scraped, null, 2)}\n`);
    const { current, next } = bumpVersion();
    console.log(`Wrote ${source.file}:`);
    for (const line of lines) {
        console.log(`  ${line}`);
    }
    console.log(`Bumped src/web/package.json and package-lock.json ${current} -> ${next}.`);
    const commitMessage = source.commitMessage(scraped);
    console.log(`Suggested commit message: ${commitMessage}`);
    return { changed: true, commitMessage };
}

function usage() {
    console.error("usage: node scripts/bamf-data-sync.mjs evaluation|pruefstellen [--check]");
    process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const check = args.includes("--check");
    const names = args.filter((arg) => !arg.startsWith("--"));
    if (names.length !== 1 || !SOURCES[names[0]] || args.some((arg) => arg.startsWith("--") && arg !== "--check")) {
        usage();
    }
    try {
        await run(names[0], { check });
    } catch (error) {
        console.error(`error: ${error.message}`);
        process.exit(1);
    }
}
