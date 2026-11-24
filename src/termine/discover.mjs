#!/usr/bin/env node
// Finds, for the exam centres BAMF lists (src/web/data/prüfstellen.json), the
// page on each centre's own website that lists its test dates, and proposes
// it as a source for the sync.
//
//   node src/termine/discover.mjs                      # every centre; writes output/candidates.json
//   node src/termine/discover.mjs --state by           # one state
//   node src/termine/discover.mjs --host vhs-calw.de   # one website
//   node src/termine/discover.mjs --merge              # adds the candidates to sources.json (existing entries stay) and renews the website's copy
//
// A maintenance tool, run by hand a few times a year: the schedule never
// runs it. Per website it reads robots.txt, the start page and at most
// MAX_PAGES further pages - the links that mention "Einbürgerung" and, for
// Kufer sites, the keyword search - and keeps the page on which an adapter
// finds the most test dates. Websites whose course system no adapter knows
// are listed as "no adapter" and left for a later one.
//
// `--cache DIR` keeps every fetched page in DIR and reads it from there the
// next time, so a parser can be improved without asking the websites again.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTERS } from "./adapters/index.mjs";
import { isExamTitle } from "./lib/courses.mjs";
import { berlinDay } from "./lib/dates.mjs";
import { attrOf, innerText, openingTags, resolveUrl } from "./lib/html.mjs";
import { getPage, sameSite } from "./lib/http.mjs";
import { fetchRobots, isAllowed } from "./lib/robots.mjs";
import { writeWebRegistry } from "./web-registry.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const CENTRES_FILE = path.join(repoRoot, "src/web/data/prüfstellen.json");
export const SOURCES_FILE = path.join(here, "sources.json");
const CANDIDATES_FILE = path.join(here, "output/candidates.json");

const MAX_PAGES = 5;
const PAUSE_MS = 400;
const KEYWORD = "Einbürgerungstest";
/** Mail providers: an address there says nothing about the centre's website. */
const MAIL_HOSTS = new Set(["t-online.de", "web.de", "gmx.de", "gmx.net", "gmail.com", "googlemail.com", "outlook.de", "outlook.com", "hotmail.com", "hotmail.de", "yahoo.de", "aol.com", "freenet.de", "arcor.de", "online.de", "posteo.de", "mail.de"]);
const MENTIONS_EXAM = /inb(ü|ue|%c3%bc)rgerung|leben[- ]in[- ]deutschland/i;

function slug(text) {
    return String(text ?? "")
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * The websites behind BAMF's list: one entry per mail or web domain, with every centre that names it.
 *
 * @param {{ stateCode: string, data: { ort?: string, plz?: string, einrichtung?: string, email?: string, website?: string }[] }[]} states
 * @returns {{ domain: string, centres: { state: string, city: string, plz: string, name: string }[] }[]}
 */
export function websitesOf(states) {
    const sites = new Map();
    for (const state of states) {
        for (const centre of state.data) {
            const fromMail = String(centre.email ?? "").split("@")[1];
            const fromWeb = String(centre.website ?? "").replace(/^https?:\/\//i, "").split("/")[0];
            const domain = (fromMail || fromWeb || "").trim().toLowerCase().replace(/^www\./, "");
            if (!domain || !domain.includes(".") || MAIL_HOSTS.has(domain)) {
                continue;
            }
            if (!sites.has(domain)) {
                sites.set(domain, { domain, centres: [] });
            }
            sites.get(domain).centres.push({ state: state.stateCode.toUpperCase(), city: String(centre.ort ?? "").trim(), plz: String(centre.plz ?? "").trim(), name: String(centre.einrichtung ?? "").trim() });
        }
    }
    return [...sites.values()];
}

/** The registry entry a website becomes: named after its first centre, with every town it serves. */
export function describeSite(site) {
    const counts = new Map();
    for (const centre of site.centres) {
        counts.set(centre.state, (counts.get(centre.state) ?? 0) + 1);
    }
    const state = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    const home = site.centres.filter((centre) => centre.state === state);
    const first = home[0];
    const towns = [...new Set(home.map((centre) => centre.city).filter(Boolean))];
    const entry = { id: `${state.toLowerCase()}-${slug(site.domain.replace(/\.[a-z]+$/, ""))}`, state, city: first.city, name: first.name };
    if (first.plz) {
        entry.plz = first.plz;
    }
    if (towns.length > 1) {
        entry.towns = towns;
    }
    return entry;
}

/** Same-site links on a page that mention the test, best first: "test" beats "Einbürgerung" alone. */
export function examLinks(html, pageUrl) {
    const found = new Map();
    for (const { tag, end } of openingTags(html, "a")) {
        const href = attrOf(tag, "href");
        const url = resolveUrl(href, pageUrl);
        if (!url || !sameSite(url, pageUrl) || /\.(pdf|docx?|jpe?g|png|ics)(\?|$)/i.test(url)) {
            continue;
        }
        const label = `${href} ${innerText(html, end).slice(0, 200)} ${attrOf(tag, "title") ?? ""}`;
        if (!MENTIONS_EXAM.test(label)) {
            continue;
        }
        const score = (/test/i.test(label) ? 2 : 0) + (/termin|pr(ü|ue)fung/i.test(label) ? 1 : 0);
        if (!found.has(url) || found.get(url) < score) {
            found.set(url, score);
        }
    }
    return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);
}

const KEYWORD_FIELD = /^kfs_stichwort(_schlagwort)?$/;

/** The keyword search of a Kufer site as its own search form would send it, with the form's hidden fields. */
function kuferFormUrls(html, pageUrl) {
    const urls = [];
    for (const { tag, end } of openingTags(html, "form")) {
        const closing = html.indexOf("</form", end);
        const inputs = openingTags(html.slice(end, closing < 0 ? end + 6000 : closing), "input");
        const keyword = inputs.map(({ tag: input }) => attrOf(input, "name") ?? "").find((name) => KEYWORD_FIELD.test(name));
        const url = keyword ? resolveUrl(attrOf(tag, "action") || pageUrl, pageUrl) : null;
        if (!url || !sameSite(url, pageUrl)) {
            continue;
        }
        const search = new URL(url);
        for (const { tag: input } of inputs) {
            const name = attrOf(input, "name");
            if (name && (attrOf(input, "type") ?? "").toLowerCase() === "hidden" && !search.searchParams.has(name)) {
                search.searchParams.set(name, attrOf(input, "value") ?? "");
            }
        }
        search.searchParams.set(keyword, KEYWORD);
        urls.push(search.href);
    }
    return urls;
}

/**
 * Keyword-search pages of a Kufer site: first what its search form sends,
 * then the usual search address under the paths its course links share.
 */
export function kuferSearchUrls(html, pageUrl) {
    const votes = new Map();
    const vote = (base, weight) => votes.set(base, (votes.get(base) ?? 0) + weight);
    for (const { tag } of openingTags(html, "a")) {
        const url = resolveUrl(attrOf(tag, "href"), pageUrl);
        if (!url || !sameSite(url, pageUrl)) {
            continue;
        }
        const parsed = new URL(url);
        if (parsed.searchParams.has("kathaupt")) {
            const keep = parsed.searchParams.has("id") ? `?id=${encodeURIComponent(parsed.searchParams.get("id"))}` : "";
            vote(`${parsed.origin}${parsed.pathname}${keep}`, 3);
        }
        const detail = /^(.*?)\/kurs\/[^/]+(?:\/[^/]+)?\/?$/.exec(parsed.pathname);
        if (detail) {
            vote(`${parsed.origin}${detail[1] || "/"}`, 2);
        }
    }
    const guessed = [...votes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1)
        .map(([base]) => {
            const url = new URL(base);
            url.searchParams.set("kathaupt", "26");
            url.searchParams.set("suchesetzen", "false");
            url.searchParams.set("kfs_stichwort_schlagwort", KEYWORD);
            return url.href;
        });
    return [...new Set([...kuferFormUrls(html, pageUrl).slice(0, 1), ...guessed])];
}

/** What the adapters make of one page: the best adapter and its test dates. */
export function assess(html, pageUrl, today) {
    let best = null;
    for (const [name, adapter] of Object.entries(ADAPTERS)) {
        const { recognised, courses } = adapter.parse(html, pageUrl, { today });
        if (!recognised) {
            continue;
        }
        const exams = courses.filter((course) => isExamTitle(course.title));
        const upcoming = exams.filter((course) => course.date >= today);
        const result = { adapter: name, exams: exams.length, upcoming: upcoming.length, sample: exams.slice(0, 3).map((course) => `${course.date} ${course.time ?? ""} ${course.status} ${course.title}`.replace(/\s+/g, " ")) };
        if (!best || result.upcoming > best.upcoming || (result.upcoming === best.upcoming && result.exams > best.exams)) {
            best = result;
        }
    }
    return best;
}

function cached(cacheDir) {
    const robots = new Map();
    const read = async (url) => {
        const file = cacheDir ? path.join(cacheDir, `${createHash("sha1").update(url).digest("hex")}.json`) : null;
        if (file && existsSync(file)) {
            const stored = JSON.parse(readFileSync(file, "utf8"));
            if (stored.error) {
                throw new Error(stored.error);
            }
            return stored;
        }
        try {
            const page = await getPage(url);
            if (file) {
                writeFileSync(file, JSON.stringify(page));
            }
            await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
            return page;
        } catch (error) {
            if (file) {
                writeFileSync(file, JSON.stringify({ error: error.message }));
            }
            throw error;
        }
    };
    const allowed = async (url) => {
        const origin = new URL(url).origin;
        if (!robots.has(origin)) {
            const file = cacheDir ? path.join(cacheDir, `${createHash("sha1").update(`${origin}/robots.txt`).digest("hex")}.robots.json`) : null;
            if (file && existsSync(file)) {
                robots.set(origin, JSON.parse(readFileSync(file, "utf8")).text);
            } else {
                const text = await fetchRobots(origin);
                robots.set(origin, text);
                if (file) {
                    writeFileSync(file, JSON.stringify({ text }));
                }
            }
        }
        const text = robots.get(origin);
        if (text === null) {
            return "unknown";
        }
        return isAllowed(text, url) ? "yes" : "no";
    };
    return { read, allowed };
}

/** Looks at one website and returns the candidate source, or why there is none. */
export async function probeSite(site, { today, io }) {
    const entry = describeSite(site);
    const report = { ...entry, domain: site.domain, pages: 0 };
    let home = null;
    for (const start of [`https://www.${site.domain}/`, `https://${site.domain}/`]) {
        try {
            const allowed = await io.allowed(start);
            if (allowed === "no") {
                report.note = "robots.txt does not allow reading the site";
                return report;
            }
            if (allowed === "unknown") {
                report.note = "no website answers under the mail domain";
                continue;
            }
            home = await io.read(start);
            break;
        } catch (error) {
            report.note = `start page: ${error.message}`;
        }
    }
    if (!home) {
        return report;
    }
    delete report.note;
    const queue = [...kuferSearchUrls(home.html, home.url), ...examLinks(home.html, home.url)];
    const seen = new Set([home.url]);
    let best = null;
    const consider = (url, found) => {
        if (found && found.exams > 0 && (!best || found.upcoming > best.upcoming || (found.upcoming === best.upcoming && found.exams > best.exams))) {
            best = { ...found, url };
        }
    };
    consider(home.url, assess(home.html, home.url, today));
    while (queue.length > 0 && report.pages < MAX_PAGES && !(best && best.upcoming > 0)) {
        const url = queue.shift();
        if (seen.has(url)) {
            continue;
        }
        seen.add(url);
        try {
            if ((await io.allowed(url)) !== "yes") {
                continue;
            }
            report.pages += 1;
            const page = await io.read(url);
            const found = assess(page.html, page.url, today);
            consider(page.url, found);
            if (!found || found.exams === 0) {
                // An information page about the test often links the list of dates.
                queue.unshift(...examLinks(page.html, page.url).filter((link) => !seen.has(link)).slice(0, 2));
            }
        } catch {
            // One unreadable page does not end the search.
        }
    }
    if (!best) {
        const system = Object.entries(ADAPTERS).find(([, adapter]) => adapter.recognises(home.html))?.[0];
        report.note = system ? `${system} site, but no page with test dates found` : "no adapter knows this site's course system";
        return report;
    }
    return { ...report, adapter: best.adapter, url: best.url, exams: best.exams, upcoming: best.upcoming, sample: best.sample };
}

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

export function readSources() {
    return existsSync(SOURCES_FILE) ? JSON.parse(readFileSync(SOURCES_FILE, "utf8")) : [];
}

/**
 * Candidates that are not sources yet, as registry entries, appended to the existing ones in a stable order.
 *
 * @param {Record<string, any>[]} existing
 * @param {Record<string, any>[]} candidates
 * @returns {Record<string, any>[]}
 */
export function mergeSources(existing, candidates) {
    const known = new Set(existing.map((source) => source.id));
    const added = candidates
        .filter((candidate) => candidate.url && candidate.adapter && !known.has(candidate.id))
        .map(({ id, state, city, name, plz, towns, adapter, url }) => ({ id, state, city, name, ...(plz ? { plz } : {}), ...(towns ? { towns } : {}), adapter, url }));
    return [...existing, ...added].sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city, "de") || a.id.localeCompare(b.id));
}

async function main(args) {
    if (args.includes("--merge")) {
        const candidates = JSON.parse(readFileSync(CANDIDATES_FILE, "utf8"));
        const before = readSources();
        const after = mergeSources(before, candidates);
        writeFileSync(SOURCES_FILE, `${JSON.stringify(after, null, 2)}\n`);
        writeWebRegistry(after);
        console.log(`sources.json: ${before.length} -> ${after.length} sources (the website's copy is renewed)`);
        return;
    }
    const state = option(args, "--state")?.toUpperCase();
    const host = option(args, "--host")?.toLowerCase();
    const limit = Number(option(args, "--limit") ?? Number.POSITIVE_INFINITY);
    const concurrency = Number(option(args, "--concurrency") ?? 6);
    const cacheDir = option(args, "--cache");
    if (cacheDir) {
        mkdirSync(cacheDir, { recursive: true });
    }
    const today = berlinDay();
    const sites = websitesOf(JSON.parse(readFileSync(CENTRES_FILE, "utf8")))
        .filter((site) => (!state || site.centres.some((centre) => centre.state === state)) && (!host || site.domain === host))
        .slice(0, limit);
    const io = cached(cacheDir);
    const reports = [];
    let next = 0;
    const worker = async () => {
        while (next < sites.length) {
            const site = sites[next++];
            const report = await probeSite(site, { today, io }).catch((error) => ({ ...describeSite(site), domain: site.domain, note: error.message }));
            reports.push(report);
            console.error(`${report.url ? "+" : "-"} ${report.state} ${site.domain}: ${report.url ? `${report.adapter}, ${report.upcoming} upcoming of ${report.exams}` : report.note}`);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    reports.sort((a, b) => a.id.localeCompare(b.id));
    mkdirSync(path.dirname(CANDIDATES_FILE), { recursive: true });
    writeFileSync(CANDIDATES_FILE, `${JSON.stringify(reports, null, 2)}\n`);
    const found = reports.filter((report) => report.url);
    console.log(`${sites.length} websites, ${found.length} with a page of test dates (${found.filter((report) => report.upcoming > 0).length} list an upcoming date); see ${path.relative(repoRoot, CANDIDATES_FILE)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(`discover failed: ${error.message}`);
        process.exit(1);
    });
}
