// Watches the official catalogue without writing anything.
//
//   node src/catalogue/watch.mjs    # prints what changed on stdout, or nothing
//
// Reads the landing page's two signals (page date, link version) and asks the
// PDF conditionally with the validators from state.json; a 304, or a 200 whose
// bytes hash to the stored sha256, means nothing changed. Diagnostics go to
// stderr, so stdout carries only the change. Exit 1 on an error (network,
// firewall redirect, a body that is not a PDF).
//
// The PULSE watch automation (.pulse/automations/bamf-catalogue-sync.yaml via
// scripts/watch-catalogue.sh) runs this daily, with no model, in a fresh
// worktree of the default branch without node_modules; it therefore never
// opens the PDF (no pdfjs) and leaves state.json and output/ untouched. When
// it prints something, the job it queues runs check.mjs and the rest of the
// pipeline (see .pulse/skills/bamf-catalogue-sync/SKILL.md).
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_URL, PDF_URL, parseLandingPage, readState, relative, statePath } from "./check.mjs";
import { getDocument, getHtml } from "./lib/http.mjs";

function short(hash) {
    return hash ? `${hash.slice(0, 12)}…` : "(none)";
}

/** The changes against state.json, one line each; empty when nothing changed. */
export async function watch({ log = (line) => console.error(line) } = {}) {
    const previous = readState();
    if (!previous) {
        return [`no ${relative(statePath)} yet; run node src/catalogue/check.mjs once to record the current catalogue`];
    }
    log(`watching the BAMF catalogue (${new Date().toISOString()})`);
    const changes = [];

    const landing = parseLandingPage(await getHtml(LANDING_URL));
    log(`  page date      ${landing.pageDate} (stored ${previous.pageDate})`);
    log(`  link version   ${landing.version} (stored ${previous.version})`);
    if (landing.pageDate !== previous.pageDate) {
        changes.push(`landing page date ${previous.pageDate} -> ${landing.pageDate}`);
    }
    if (landing.version !== previous.version) {
        changes.push(`download link version ${previous.version} -> ${landing.version}`);
    }

    const conditional = Boolean(previous.etag || previous.lastModified);
    const result = await getDocument(PDF_URL, conditional ? { etag: previous.etag, lastModified: previous.lastModified } : {});
    if (result.status === 304) {
        log("  PDF            304 Not Modified");
    } else {
        if (!result.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
            throw new Error(`the download is not a PDF (content type ${result.contentType || "unknown"}, ${result.buffer.length} bytes); the site may have answered with an error page`);
        }
        const sha256 = createHash("sha256").update(result.buffer).digest("hex");
        log(`  PDF            200 OK, ${result.buffer.length} bytes, sha256 ${short(sha256)} (stored ${short(previous.sha256)})`);
        if (sha256 !== previous.sha256) {
            const when = result.lastModified ? `, Last-Modified ${result.lastModified}` : "";
            changes.push(`PDF bytes changed: ${result.buffer.length} bytes, sha256 ${sha256}${when} (stored ${previous.bytes} bytes, ${previous.sha256})`);
        }
    }
    return changes;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const changes = await watch();
        if (changes.length > 0) {
            const previous = readState();
            console.log(`The official BAMF Gesamtfragenkatalog changed (stored Stand ${previous?.stand ?? "(none)"}, downloaded ${previous?.downloadedAt ?? "(never)"}):`);
            for (const line of changes) {
                console.log(`  ${line}`);
            }
        } else {
            console.error("  nothing changed since the last download");
        }
    } catch (error) {
        console.error(`✗ ${error.message}`);
        process.exit(1);
    }
}
