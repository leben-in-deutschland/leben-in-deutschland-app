// Reads the "last updated" signals of the official BAMF question catalogue
// and downloads the PDF only when it changed.
//
//   node src/catalogue/check.mjs            # conditional download, prints changed=true|false
//   node src/catalogue/check.mjs --force    # download regardless of the stored signals
//
// Signals: the date and the link version (`v=`) on the landing page, and the
// Last-Modified/ETag headers of the PDF through a conditional GET. The last
// seen values live in state.json (committed); the PDF goes to output/ (not
// committed). With GITHUB_OUTPUT set, `changed` and `stand` are appended for
// the following workflow steps. Exit 1 only on errors; an unchanged
// catalogue is a normal result.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument, getHtml } from "./lib/http.mjs";
import { openPdf, readInfo } from "./lib/pdf.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");
export const statePath = path.join(here, "state.json");
export const outputRoot = path.join(here, "output");
export const pdfPath = path.join(outputRoot, "gesamtfragenkatalog.pdf");

export const LANDING_URL = "https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.pdf";
export const PDF_URL = `${LANDING_URL}?__blob=publicationFile`;

export function relative(file) {
    return path.relative(repoRoot, file);
}

export function readState() {
    if (!existsSync(statePath)) {
        return null;
    }
    try {
        return JSON.parse(readFileSync(statePath, "utf8"));
    } catch {
        throw new Error(`${relative(statePath)} is not valid JSON`);
    }
}

/** The landing page's date ("Datum: dd.mm.yyyy") and the `v=` counter of the download link. */
export function parseLandingPage(html) {
    const pageDate = /Datum:(?:&#32;|&nbsp;|\s|<[^>]*>)*(\d{2}\.\d{2}\.\d{4})/.exec(html)?.[1] ?? null;
    const version = /gesamtfragenkatalog-lebenindeutschland\.pdf\?__blob=publicationFile(?:&amp;|&)v=(\d+)/i.exec(html)?.[1] ?? null;
    const announced = /(\d+)\s+bundesweiten\s+und\s+(\d+)\s+bundeslandspezifischen/i.exec(html);
    if (!pageDate || !version) {
        throw new Error(`the landing page changed its layout: ${pageDate ? "" : "no \"Datum:\" date"}${!pageDate && !version ? ", " : ""}${version ? "" : "no download link with a version number"} found`);
    }
    return {
        pageDate,
        version,
        announced: announced ? { general: Number(announced[1]), state: Number(announced[2]) } : null,
    };
}

function signal(name, current, stored) {
    const shown = current ?? "(none)";
    const previous = stored === undefined || stored === null ? "(none)" : stored;
    const flag = stored !== undefined && stored !== null && current !== null && current !== stored ? "  <- changed" : "";
    console.log(`  ${name.padEnd(14)} ${shown}${flag}`);
    console.log(`  ${"".padEnd(14)} stored: ${previous}`);
}

/** Opens the downloaded PDF and returns `{ stand, pages, title }`. */
export async function inspectPdf(buffer) {
    const { doc, close } = await openPdf(buffer);
    try {
        return await readInfo(doc);
    } finally {
        await close();
    }
}

function writeGitHubOutput(values) {
    if (!process.env.GITHUB_OUTPUT) {
        return;
    }
    const lines = Object.entries(values).map(([name, value]) => `${name}=${value ?? ""}\n`).join("");
    appendFileSync(process.env.GITHUB_OUTPUT, lines);
}

/**
 * Runs the check. Returns `{ changed, stand, state, downloaded }`; `state`
 * is the (possibly rewritten) content of state.json.
 */
export async function run({ force = false } = {}) {
    const previous = readState();
    console.log(`checking the BAMF catalogue (${new Date().toISOString()})`);
    console.log(`  landing page   ${LANDING_URL}`);
    const landing = parseLandingPage(await getHtml(LANDING_URL));
    signal("page date", landing.pageDate, previous?.pageDate);
    signal("link version", landing.version, previous?.version);
    if (landing.announced) {
        console.log(`  announced      ${landing.announced.general} general + ${landing.announced.state} state questions`);
    }
    const landingChanged = previous !== null && (landing.pageDate !== previous.pageDate || landing.version !== previous.version);

    const conditional = !force && previous !== null && Boolean(previous.etag || previous.lastModified);
    console.log(`  PDF            ${PDF_URL}`);
    console.log(`  request        ${conditional ? "conditional GET (If-None-Match / If-Modified-Since from state.json)" : force ? "GET (forced)" : "GET (no stored signals yet)"}`);
    let result = await getDocument(PDF_URL, conditional ? { etag: previous.etag, lastModified: previous.lastModified } : {});

    if (result.status === 304) {
        console.log("  response       304 Not Modified");
        signal("Last-Modified", previous.lastModified ?? null, previous.lastModified);
        signal("ETag", previous.etag ?? null, previous.etag);
        if (landingChanged) {
            console.log("  ! the landing page shows a new date or link version although the PDF reports 304; downloading anyway");
            result = await getDocument(PDF_URL, {});
        } else {
            console.log("  nothing changed since the last download");
            const outcome = { changed: false, stand: previous.stand ?? null, state: previous, downloaded: false };
            writeGitHubOutput({ changed: "false", stand: outcome.stand });
            console.log("changed=false");
            return outcome;
        }
    }

    console.log(`  response       200 OK, ${result.buffer.length} bytes, ${result.contentType || "no content type"}`);
    if (!result.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        throw new Error(`the download is not a PDF (content type ${result.contentType || "unknown"}, ${result.buffer.length} bytes); the site may have answered with an error page`);
    }
    signal("Last-Modified", result.lastModified, previous?.lastModified);
    signal("ETag", result.etag, previous?.etag);

    const sha256 = createHash("sha256").update(result.buffer).digest("hex");
    const identical = previous?.sha256 === sha256;
    signal("sha256", sha256, previous?.sha256);
    // The site sometimes answers 200 without validators; for identical bytes the
    // stored ones stay valid and keep the next request conditional.
    const lastModified = result.lastModified ?? (identical ? previous?.lastModified ?? null : null);
    const etag = result.etag ?? (identical ? previous?.etag ?? null : null);
    if (identical && (!result.lastModified || !result.etag)) {
        console.log("  ! the response carried no validators; the stored ones were kept because the bytes are identical");
    }
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(pdfPath, result.buffer);
    console.log(`  saved          ${relative(pdfPath)}`);

    const info = await inspectPdf(result.buffer);
    if (!info.stand) {
        console.log(`  ! no "Stand: dd.mm.yyyy" in the PDF title "${info.title}"`);
    }
    signal("Stand (title)", info.stand, previous?.stand);
    console.log(`  pages          ${info.pages}`);

    const state = {
        landingUrl: LANDING_URL,
        pdfUrl: PDF_URL,
        pageDate: landing.pageDate,
        version: landing.version,
        lastModified,
        etag,
        sha256,
        bytes: result.buffer.length,
        pages: info.pages,
        stand: info.stand,
        downloadedAt: identical && previous?.downloadedAt ? previous.downloadedAt : new Date().toISOString(),
    };
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
    console.log(`  state          ${relative(statePath)} ${JSON.stringify(state) === JSON.stringify(previous) ? "unchanged" : "rewritten"}`);

    let changed = true;
    if (identical && !landingChanged) {
        if (force) {
            console.log("  the PDF is byte-identical to the last download; --force continues anyway");
        } else {
            console.log("  the PDF is byte-identical to the last download");
            changed = false;
        }
    } else if (identical) {
        console.log("  ! the landing page changed but the PDF bytes did not");
    }
    const outcome = { changed, stand: info.stand, state, downloaded: true };
    writeGitHubOutput({ changed: String(changed), stand: info.stand });
    console.log(`changed=${changed}`);
    return outcome;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    run({ force: process.argv.includes("--force") }).catch((error) => {
        console.error(`✗ ${error.message}`);
        process.exit(1);
    });
}
