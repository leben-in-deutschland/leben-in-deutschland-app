#!/usr/bin/env node
// Finds, for the exam centres BAMF lists (src/web/data/prüfstellen.json), the
// page on each centre's own website that lists its test dates, and proposes
// it as a source for the sync.
//
//   node src/termine/discover.mjs                      # every centre; writes output/candidates.json
//   node src/termine/discover.mjs --new                # only the centres that are not a source yet
//   node src/termine/discover.mjs --state by           # one state
//   node src/termine/discover.mjs --host vhs-calw.de   # one website
//   node src/termine/discover.mjs --merge              # adds the candidates to sources.json (existing entries stay) and renews the website's copy
//
// A maintenance tool, run by hand a few times a year: the schedule never
// runs it. Per website it reads robots.txt, the start page and at most
// MAX_PAGES further pages - the keyword search of a Kufer site, the links
// that mention "Einbürgerung", the site's own search and the parts of the
// programme where the test usually stands - and keeps the page on which an
// adapter finds the most test dates. Websites whose course system no adapter
// knows are listed as "no adapter" and left for a later one.
//
// BAMF lists a mail address, not a website. Where the address is not the
// centre's website, the tool looks for it: it follows the address to where
// it redirects, and for a Volkshochschule listed under its town hall or
// district it follows the town's link to the school and tries the usual
// names ("vhs-<town>.de"). Such a website counts only when it names the
// centre's postcode or town (see `probeSite`).
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
import { attrOf, innerText, openingTags, resolveUrl, textOf } from "./lib/html.mjs";
import { getPage, sameSite } from "./lib/http.mjs";
import { isAllowed, readRobots } from "./lib/robots.mjs";
import { writeWebRegistry } from "./web-registry.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const CENTRES_FILE = path.join(repoRoot, "src/web/data/prüfstellen.json");
export const SOURCES_FILE = path.join(here, "sources.json");
const CANDIDATES_FILE = path.join(here, "output/candidates.json");

const MAX_PAGES = 5;
/** Websites read for one centre besides the one BAMF's address names, and names tried to find them. */
const MAX_WEBSITES = 4;
const MAX_NAMES = 12;
const PAUSE_MS = 400;
const KEYWORD = "Einbürgerungstest";
/** Mail providers: an address there says nothing about the centre's website. */
const MAIL_HOSTS = new Set(["t-online.de", "web.de", "gmx.de", "gmx.net", "gmail.com", "googlemail.com", "outlook.de", "outlook.com", "hotmail.com", "hotmail.de", "yahoo.de", "aol.com", "freenet.de", "arcor.de", "online.de", "posteo.de", "mail.de"]);
const MENTIONS_EXAM = /inb(ü|ue|%c3%bc)rgerung|leben[- ]in[- ]deutschland/i;
const NOT_A_PAGE = /\.(pdf|docx?|xlsx?|jpe?g|png|gif|svg|ics|zip|mp[34])(\?|$)/i;
/** A Volkshochschule by its name ("Kreisvolkshochschule", "VHS", "vhs im Kreis") or by a link's words. */
const SCHOOL = /volkshochschule|(?<![\p{L}\d])k?vhs(?![\p{L}\d])/iu;
/** A school of a district or region, not of the town it sits in ("Kreisvolkshochschule", "VHS des Landkreises X", "VHS Region Y"). */
const DISTRICT = /kreis|region|zweckverband/i;
/** A host or path that carries the school in its name ("vhs-x.de", "kvhs-x.de", "/volkshochschule"). */
const SCHOOL_NAME = /vhs|volkshochschule/i;
/** Hosts that carry "vhs" without being one school's website: the associations' portals. */
const NOT_A_SCHOOL = /(^|\.)(volkshochschule\.de|vhs\.cloud|vhs-lernportal\.de|vhs-ehrenamtsportal\.de|vhs-kursfinder\.de|vhs-digitaler-campus\.de)$/i;

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

/** "www.VHS-X.de" -> "vhs-x.de". */
function bareHost(urlOrHost) {
    const host = /^https?:/i.test(urlOrHost) ? new URL(urlOrHost).hostname : String(urlOrHost);
    return host.toLowerCase().replace(/^www\./, "");
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

/** The centres of the state most of a website's centres are in. */
function homeCentres(site) {
    const counts = new Map();
    for (const centre of site.centres) {
        counts.set(centre.state, (counts.get(centre.state) ?? 0) + 1);
    }
    const state = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    return site.centres.filter((centre) => centre.state === state);
}

/**
 * The registry entry a website becomes: named after its first centre, with
 * every town it serves. The id carries the website that is read - `website`
 * when that is not the domain of BAMF's address.
 */
export function describeSite(site, website = site.domain) {
    const home = homeCentres(site);
    const first = home[0];
    const towns = [...new Set(home.map((centre) => centre.city).filter(Boolean))];
    const entry = { id: `${first.state.toLowerCase()}-${slug(bareHost(website).replace(/\.[a-z]+$/, ""))}`, state: first.state, city: first.city, name: first.name };
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
        if (!url || !sameSite(url, pageUrl) || NOT_A_PAGE.test(url)) {
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

/** Where the test usually stands in a programme, by the words of a link: [pattern, weight]. */
const AREAS = [
    [/integration|deutsch als|deutsch-als|deutsch lernen|\bda[fz]\b/i, 3],
    [/pr(ü|ue)fung|zertifikat|einb(ü|ue)rgerung/i, 3],
    [/deutsch/i, 2],
    [/sprache|gesellschaft|politik|grundbildung/i, 1],
];

/**
 * Same-site links to the parts of a programme where the test usually stands
 * ("Deutsch und Integration", "Prüfungen", "Gesellschaft"), best first. For
 * a site whose start page does not name the test and that has no keyword
 * search to ask.
 */
export function areaLinks(html, pageUrl) {
    const found = new Map();
    for (const { tag, end } of openingTags(html, "a")) {
        const url = resolveUrl(attrOf(tag, "href"), pageUrl)?.replace(/#.*$/, "");
        if (!url || url === pageUrl || !sameSite(url, pageUrl) || NOT_A_PAGE.test(url) || /\/kurs\//.test(url)) {
            continue;
        }
        const label = `${innerText(html, end).slice(0, 120)} ${attrOf(tag, "title") ?? ""}`;
        const score = AREAS.reduce((sum, [pattern, weight]) => sum + (pattern.test(label) ? weight : 0), 0);
        if (score > 0 && (found.get(url) ?? 0) < score) {
            found.set(url, score);
        }
    }
    return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);
}

const KUFER_FIELD = /^kfs_stichwort(_schlagwort)?$/;
/** The text field of a site's own search ("q", "s", "Suchbegriffe", "tx_x[searchString]"). */
const SEARCH_FIELD = /^(q|s|search|query|suche|suchbegriffe?|suchwort|stichwort|searchterm|term|keywords?)$|\[(q|search|searchString|sword|query)\]$/i;
const TYPED = ["", "text", "search"];

/**
 * The keyword search a form of the page would send: its address, its hidden
 * fields and the keyword. With `typed`, only a form that asks with GET and
 * whose keyword field is one a visitor types into.
 */
function formUrls(html, pageUrl, field, { typed = false } = {}) {
    const urls = [];
    for (const { tag, end } of openingTags(html, "form")) {
        if (typed && (attrOf(tag, "method") ?? "get").toLowerCase() !== "get") {
            continue;
        }
        const closing = html.indexOf("</form", end);
        const inputs = openingTags(html.slice(end, closing < 0 ? end + 6000 : closing), "input");
        const keyword = inputs
            .filter(({ tag: input }) => !typed || TYPED.includes((attrOf(input, "type") ?? "").toLowerCase()))
            .map(({ tag: input }) => attrOf(input, "name") ?? "")
            .find((name) => field.test(name));
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

/** What a site's own search form would send for the keyword; only forms that ask with GET. */
export function siteSearchUrls(html, pageUrl) {
    return [...new Set(formUrls(html, pageUrl, SEARCH_FIELD, { typed: true }))];
}

/** Paths of a Kufer site that are no part of the programme. */
const NOT_THE_PROGRAMME = /login|warenkorb|newsletter|merkliste/i;

/**
 * Keyword-search pages of a Kufer site: first what its search form sends,
 * then the usual search address under the paths its course links share -
 * "?kathaupt=26" in the current template, ".../kw/kathaupt/18/" in the
 * older one that carries its functions in the path - and, where the start
 * page shows no course at all, under its "Kurssuche".
 */
export function kuferSearchUrls(html, pageUrl) {
    const votes = new Map();
    const older = new Map();
    const searches = new Set();
    const vote = (map, base, weight) => map.set(base, (map.get(base) ?? 0) + weight);
    for (const { tag } of openingTags(html, "a")) {
        const url = resolveUrl(attrOf(tag, "href"), pageUrl);
        if (!url || !sameSite(url, pageUrl)) {
            continue;
        }
        const parsed = new URL(url);
        if (parsed.searchParams.has("kathaupt")) {
            const keep = parsed.searchParams.has("id") ? `?id=${encodeURIComponent(parsed.searchParams.get("id"))}` : "";
            vote(votes, `${parsed.origin}${parsed.pathname}${keep}`, 3);
        }
        const detail = /^(.*?)\/kurs\/[^/]+(?:\/[^/]+)?\/?$/.exec(parsed.pathname);
        if (detail) {
            vote(votes, `${parsed.origin}${detail[1] || "/"}`, 2);
        }
        const inPath = /^(.*?)\/kw\/(?:bereich|kathaupt|kurs)\//.exec(parsed.pathname);
        if (inPath && !NOT_THE_PROGRAMME.test(parsed.pathname)) {
            vote(older, `${parsed.origin}${inPath[1]}`, 1);
        }
        if (/\/kurssuche\/?$/.test(parsed.pathname) && !parsed.search) {
            searches.add(`${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`);
        }
    }
    const current = (base) => {
        const url = new URL(base);
        url.searchParams.set("kathaupt", "26");
        url.searchParams.set("suchesetzen", "false");
        url.searchParams.set("kfs_stichwort_schlagwort", KEYWORD);
        return url.href;
    };
    const guessed = [...votes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1)
        .map(([base]) => current(base));
    // The shortest path in front of "/kw/" is the programme itself ("/programm"), a longer one a part of it.
    const inPath = [...older.keys()]
        .sort((a, b) => a.length - b.length || a.localeCompare(b))
        .slice(0, 1)
        .map((base) => `${base}/kw/kathaupt/18/suchesetzen/false/?kfs_stichwort=${encodeURIComponent(KEYWORD)}`);
    const viaSearch = guessed.length + inPath.length > 0 ? [] : [...searches].slice(0, 1).map((base) => current(base));
    return [...new Set([...formUrls(html, pageUrl, KUFER_FIELD).slice(0, 1), ...guessed, ...inPath, ...viaSearch])];
}

/** "Lauf a.d.Pegnitz" -> "Lauf", "Rotenburg (Wümme)" -> "Rotenburg": a town's own name, without what tells it from its namesakes. */
export function townName(city) {
    return String(city ?? "")
        .replace(/\s*[(/,].*$/, "")
        .replace(/\s+(?:(?:a|b|i|v|o)\.|am\b|an\b|bei\b|im\b|in\b|ob\b|vor\b|unter\b).*$/i, "")
        .trim();
}

/** Where a town's Volkshochschule usually is, and the town's own website, which links it. */
export function guessedWebsites(city) {
    const town = slug(townName(city));
    return town ? [`vhs-${town}.de`, `vhs.${town}.de`, `volkshochschule-${town}.de`, `${town}.de`] : [];
}

/**
 * Where a page of a town or district leads to its Volkshochschule:
 * `websites` are other hosts that carry the school in their name
 * ("vhs-x.de", "kvhs-x.de", "vhs.x.de"), the ones whose link says so too
 * first; `pages` are pages of the same site about the school. A link that
 * only says "Volkshochschule" and leads to any other host is not followed:
 * it is a press release or a council paper far more often than the school.
 *
 * @returns {{ websites: string[], pages: string[] }}
 */
export function schoolLinks(html, pageUrl) {
    const websites = new Map();
    const pages = new Map();
    for (const { tag, end } of openingTags(html, "a")) {
        const url = resolveUrl(attrOf(tag, "href"), pageUrl)?.replace(/#.*$/, "");
        if (!url || !/^https?:/i.test(url) || NOT_A_PAGE.test(url)) {
            continue;
        }
        const target = new URL(url);
        const host = bareHost(url);
        const named = SCHOOL.test(`${innerText(html, end).slice(0, 200)} ${attrOf(tag, "title") ?? ""}`);
        if (sameSite(url, pageUrl)) {
            const score = (SCHOOL_NAME.test(target.pathname) ? 2 : 0) + (named ? 1 : 0);
            if (score > 0 && url !== pageUrl && (pages.get(url) ?? 0) < score) {
                pages.set(url, score);
            }
            continue;
        }
        const score = 1 + (named ? 1 : 0);
        if (SCHOOL_NAME.test(host) && !NOT_A_SCHOOL.test(host) && (websites.get(host) ?? 0) < score) {
            websites.set(host, score);
        }
    }
    const best = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
    return { websites: best(websites), pages: best(pages) };
}

/**
 * How a page names one of the centres: "plz" by its postcode, "town" by the
 * name of its town, null not at all. A website found by a link or a guess
 * belongs to the centre only when it says so.
 *
 * @param {string} html
 * @param {{ city: string, plz: string }[]} centres
 * @returns {"plz" | "town" | null}
 */
export function namesCentre(html, centres) {
    const text = textOf(String(html ?? ""));
    if (centres.some((centre) => /^\d{5}$/.test(centre.plz) && new RegExp(`(?<!\\d)${centre.plz}(?!\\d)`).test(text))) {
        return "plz";
    }
    const named = centres.some((centre) => {
        const town = townName(centre.city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return town.length > 2 && new RegExp(`(?<![\\p{L}])${town}(?![\\p{L}])`, "iu").test(text);
    });
    return named ? "town" : null;
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

function systemOf(html) {
    return Object.entries(ADAPTERS).find(([, adapter]) => adapter.recognises(html))?.[0] ?? null;
}

/** Reads pages and robots.txt politely, through `cacheDir` when one is given. */
function cached(cacheDir) {
    const robots = new Map();
    const fileOf = (key, suffix) => (cacheDir ? path.join(cacheDir, `${createHash("sha1").update(key).digest("hex")}${suffix}`) : null);
    const failure = (message, moved) => Object.assign(new Error(message), { moved: moved ?? null });
    const read = async (url) => {
        const file = fileOf(url, ".json");
        if (file && existsSync(file)) {
            const stored = JSON.parse(readFileSync(file, "utf8"));
            if (stored.error) {
                // Pages kept before `moved` was recorded name the other site in the message only.
                const host = /redirected to another site \(([^)]+)\)/.exec(stored.error)?.[1];
                throw failure(stored.error, stored.moved ?? (host ? `https://${host}/` : null));
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
                writeFileSync(file, JSON.stringify({ error: error.message, moved: error.location ?? null }));
            }
            throw failure(error.message, error.location);
        }
    };
    const robotsOf = async (url) => {
        const origin = new URL(url).origin;
        if (!robots.has(origin)) {
            const file = fileOf(`${origin}/robots.txt`, ".robots.json");
            const stored = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
            // An unreadable robots.txt kept before `moved` was recorded is asked for again.
            if (stored && (stored.text !== null || "moved" in stored)) {
                robots.set(origin, { text: stored.text, moved: stored.moved ?? null });
            } else {
                const answer = await readRobots(origin);
                robots.set(origin, answer);
                if (file) {
                    writeFileSync(file, JSON.stringify(answer));
                }
            }
        }
        return robots.get(origin);
    };
    const allowed = async (url) => {
        const { text } = await robotsOf(url);
        if (text === null) {
            return "unknown";
        }
        return isAllowed(text, url) ? "yes" : "no";
    };
    /** Where the site of `url` sends its visitors when it is only a redirect to another site. */
    const moved = async (url) => (await robotsOf(url)).moved;
    return { read, allowed, moved };
}

/**
 * Looks at one website: robots.txt, the start page and at most MAX_PAGES
 * further pages. `best` is the page with the most test dates, `system` the
 * course system an adapter recognised; without a start page, `note` says
 * why and `moved` where the website redirects to.
 */
async function probeWebsite(domain, { today, io, start = null }) {
    const result = { domain, pages: 0, home: null, system: null, best: null, note: null, moved: null };
    for (const url of [...(start ? [start] : []), `https://www.${domain}/`, `https://${domain}/`]) {
        try {
            const allowed = await io.allowed(url);
            if (allowed === "no") {
                result.note = "robots.txt does not allow reading the site";
                return result;
            }
            if (allowed === "unknown") {
                result.note = "no website answers under the mail domain";
                result.moved = result.moved ?? (await io.moved?.(url)) ?? null;
                continue;
            }
            result.home = await io.read(url);
            break;
        } catch (error) {
            result.note = `start page: ${error.message}`;
            result.moved = result.moved ?? error.moved ?? null;
        }
    }
    const home = result.home;
    if (!home) {
        return result;
    }
    result.note = null;
    result.moved = null;
    result.system = systemOf(home.html);
    const queue = [...kuferSearchUrls(home.html, home.url), ...examLinks(home.html, home.url)];
    if (result.system) {
        queue.push(...siteSearchUrls(home.html, home.url).slice(0, 1), ...areaLinks(home.html, home.url).slice(0, 3));
    }
    const seen = new Set([home.url]);
    const consider = (url, html, found) => {
        if (found && found.exams > 0 && (!result.best || found.upcoming > result.best.upcoming || (found.upcoming === result.best.upcoming && found.exams > result.best.exams))) {
            result.best = { ...found, url, html };
        }
    };
    consider(home.url, home.html, assess(home.html, home.url, today));
    while (queue.length > 0 && result.pages < MAX_PAGES && !(result.best && result.best.upcoming > 0)) {
        const url = queue.shift();
        if (seen.has(url)) {
            continue;
        }
        seen.add(url);
        try {
            if ((await io.allowed(url)) !== "yes") {
                continue;
            }
            result.pages += 1;
            const page = await io.read(url);
            const found = assess(page.html, page.url, today);
            result.system = result.system ?? found?.adapter ?? null;
            consider(page.url, page.html, found);
            if (!found || found.exams === 0) {
                // An information page about the test often links the list of dates,
                // and a part of the programme the part below it.
                queue.unshift(...examLinks(page.html, page.url).filter((link) => !seen.has(link)).slice(0, 2));
                if (result.system) {
                    queue.push(...areaLinks(page.html, page.url).filter((link) => !seen.has(link)).slice(0, 2));
                }
            }
        } catch {
            // One unreadable page does not end the search.
        }
    }
    return result;
}

function noteOf(found) {
    return found.note ?? (found.system ? `${found.system} site, but no page with test dates found` : "no adapter knows this site's course system");
}

/**
 * Looks at one of BAMF's websites and returns the candidate source, or why
 * there is none.
 *
 * The domain of BAMF's mail address comes first. Where it lists no test
 * date, the centre's website may be another one:
 *
 *   - the address redirects there ("redirect") - the centre's own word;
 *   - a Volkshochschule listed under its town hall or district: the town's
 *     page links the school ("link"), or the school has one of the usual
 *     names ("guess").
 *
 * A website found by a link or a guess counts only when it names the
 * centre: its postcode, or - for a link - its town. Two guesses stay in
 * the report with `check`, for a person to look at: one that names the
 * town alone, because towns share names, and one for a district's school,
 * because "vhs-<town>.de" is the school of the town it sits in. The
 * entry's id carries the website that is read. A website in `known` is a
 * source already and is not read again.
 */
export async function probeSite(site, { today, io, known = new Set() }) {
    const listed = await probeWebsite(site.domain, { today, io });
    const report = { ...describeSite(site), domain: site.domain, pages: listed.pages };
    const candidate = (found, extra = {}) => ({ ...report, ...extra, adapter: found.best.adapter, url: found.best.url, exams: found.best.exams, upcoming: found.best.upcoming, sample: found.best.sample });
    if (listed.best) {
        return candidate(listed);
    }
    const centres = homeCentres(site);
    const school = centres.some((centre) => SCHOOL.test(centre.name));
    /** Websites to look at: { domain, via, start }. */
    const queue = [];
    const tried = new Set([site.domain]);
    const add = (domain, via, start = null) => {
        if (!tried.has(domain) && !queue.some((entry) => entry.domain === domain)) {
            queue.push({ domain, via, start });
        }
    };
    if (listed.moved) {
        add(bareHost(listed.moved), "redirect", /\/robots\.txt$/.test(new URL(listed.moved).pathname) ? null : listed.moved);
    }
    // A school under its own name that answers is its own website; one under its town's name, or silent, is looked for.
    if (school && !listed.system && (!listed.home || !SCHOOL_NAME.test(site.domain))) {
        if (listed.home) {
            const links = schoolLinks(listed.home.html, listed.home.url);
            links.websites.slice(0, 3).forEach((domain) => add(domain, "link"));
            if (links.websites.length === 0 && links.pages.length > 0 && (await io.allowed(links.pages[0]).catch(() => "no")) === "yes") {
                report.pages += 1;
                const page = await io.read(links.pages[0]).catch(() => null);
                schoolLinks(page?.html ?? "", page?.url ?? links.pages[0])
                    .websites.slice(0, 3)
                    .forEach((domain) => add(domain, "link"));
            }
        }
        for (const city of [...new Set(centres.map((centre) => centre.city))].slice(0, 2)) {
            guessedWebsites(city).forEach((domain) => add(domain, "guess"));
        }
    }
    // A name that is not the school's leads elsewhere when it is for sale: only a school's or the town's own host is followed.
    const places = centres.map((centre) => slug(townName(centre.city))).filter(Boolean);
    const related = (domain) => SCHOOL_NAME.test(domain) || places.some((place) => domain.includes(place));
    const looked = [];
    let read = 0;
    while (queue.length > 0 && read < MAX_WEBSITES && tried.size <= MAX_NAMES) {
        const { domain, via, start } = queue.shift();
        tried.add(domain);
        if (known.has(domain)) {
            return { ...report, note: `already a source: ${domain}`, website: domain, via };
        }
        const found = await probeWebsite(domain, { today, io, start });
        report.pages += found.pages;
        if (!found.home) {
            if (found.moved && (via === "redirect" || related(bareHost(found.moved)))) {
                add(bareHost(found.moved), via);
            }
            continue;
        }
        read += 1;
        const named = via === "redirect" ? "redirect" : namesCentre(`${found.home.html} ${found.best?.html ?? ""}`, centres);
        if (found.best && named) {
            const doubt =
                via !== "guess" ? null : named === "town" ? "the website names the town, not the postcode" : centres.every((centre) => DISTRICT.test(centre.name)) ? "the centre is a district's school, the name is the town's" : null;
            return candidate(found, { ...describeSite(site, domain), domain: site.domain, website: domain, via, ...(doubt ? { check: `found by its usual name; ${doubt}` } : {}) });
        }
        looked.push(`${domain}: ${found.best ? "test dates, but the website does not name the centre" : noteOf(found)}`);
        if (found.system && named) {
            // The school's own website is found; it lists no test date.
            break;
        }
        if (school && !found.system) {
            // A town's page: it links its school.
            schoolLinks(found.home.html, found.home.url)
                .websites.slice(0, 3)
                .forEach((other) => add(other, "link"));
        }
    }
    return { ...report, note: noteOf(listed), ...(looked.length > 0 ? { looked } : {}) };
}

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

export function readSources() {
    return existsSync(SOURCES_FILE) ? JSON.parse(readFileSync(SOURCES_FILE, "utf8")) : [];
}

/**
 * Candidates that are not sources yet, as registry entries, appended to the
 * existing ones in a stable order. A candidate that waits for a person's
 * look (`check`) is left out; of two candidates that lead to the same
 * website the first one stays and takes the other's towns.
 *
 * @param {Record<string, any>[]} existing
 * @param {Record<string, any>[]} candidates
 * @returns {Record<string, any>[]}
 */
export function mergeSources(existing, candidates) {
    const known = new Set(existing.map((source) => source.id));
    const added = new Map();
    for (const { id, state, city, name, plz, towns, adapter, url, check } of candidates) {
        if (!url || !adapter || check || known.has(id)) {
            continue;
        }
        const first = added.get(id);
        if (first) {
            const all = [...new Set([...(first.towns ?? [first.city]), ...(towns ?? [city])])];
            added.set(id, { ...first, ...(all.length > 1 ? { towns: all } : {}), adapter: first.adapter, url: first.url });
            continue;
        }
        added.set(id, { id, state, city, name, ...(plz ? { plz } : {}), ...(towns ? { towns } : {}), adapter, url });
    }
    // `towns` stands in front of `adapter` and `url` in every entry.
    const entries = [...added.values()].map(({ adapter, url, ...entry }) => ({ ...entry, adapter, url }));
    return [...existing, ...entries].sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city, "de") || a.id.localeCompare(b.id));
}

async function main(args) {
    if (args.includes("--merge")) {
        const candidates = JSON.parse(readFileSync(CANDIDATES_FILE, "utf8"));
        const before = readSources();
        const after = mergeSources(before, candidates);
        writeFileSync(SOURCES_FILE, `${JSON.stringify(after, null, 2)}\n`);
        writeWebRegistry(after);
        const waiting = candidates.filter((candidate) => candidate.url && candidate.check).length;
        console.log(`sources.json: ${before.length} -> ${after.length} sources (the website's copy is renewed)${waiting > 0 ? `; ${waiting} candidates wait for a look (\"check\")` : ""}`);
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
    // A centre that is a source is read by the sync four times a day; `--new` leaves its website alone.
    const sources = args.includes("--new") ? readSources() : [];
    const known = new Set(sources.map((source) => bareHost(source.url)));
    const isSource = (site) => known.has(site.domain) || sources.some((source) => source.id === describeSite(site).id);
    const sites = websitesOf(JSON.parse(readFileSync(CENTRES_FILE, "utf8")))
        .filter((site) => (!state || site.centres.some((centre) => centre.state === state)) && (!host || site.domain === host) && !isSource(site))
        .slice(0, limit);
    const io = cached(cacheDir);
    const reports = [];
    let next = 0;
    const worker = async () => {
        while (next < sites.length) {
            const site = sites[next++];
            const report = await probeSite(site, { today, io, known }).catch((error) => ({ ...describeSite(site), domain: site.domain, note: error.message }));
            reports.push(report);
            const where = report.website ? ` at ${report.website} (${report.via})` : "";
            console.error(`${report.url ? (report.check ? "?" : "+") : "-"} ${report.state} ${site.domain}: ${report.url ? `${report.adapter}, ${report.upcoming} upcoming of ${report.exams}${where}` : report.note}`);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    reports.sort((a, b) => a.id.localeCompare(b.id) || a.domain.localeCompare(b.domain));
    mkdirSync(path.dirname(CANDIDATES_FILE), { recursive: true });
    writeFileSync(CANDIDATES_FILE, `${JSON.stringify(reports, null, 2)}\n`);
    const found = reports.filter((report) => report.url);
    const waiting = found.filter((report) => report.check).length;
    console.log(`${sites.length} websites, ${found.length} with a page of test dates (${found.filter((report) => report.upcoming > 0).length} list an upcoming date${waiting > 0 ? `, ${waiting} wait for a look` : ""}); see ${path.relative(repoRoot, CANDIDATES_FILE)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(`discover failed: ${error.message}`);
        process.exit(1);
    });
}
