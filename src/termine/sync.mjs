#!/usr/bin/env node
// Reads the test dates of every exam centre in sources.json from the centre's
// own website and writes them as one file for the app.
//
//   node src/termine/sync.mjs --out FILE [--previous FILE] [--only ID] [--concurrency N]
//
// One GET per source (plus the site's robots.txt), a few times a day, from
// publish.mjs (the Hive automation .hive/automations/termine-sync.yaml),
// which publishes the file on the `data` branch. Nothing is posted, no
// login, no cookie is kept; a site whose robots.txt says no is not read.
//
// A source that cannot be read keeps the dates of its last good read for
// STALE_DAYS and is marked `ok: false`; after that its dates are dropped
// rather than shown as current. A page that suddenly lists no course at all
// while dates are known for the centre counts as not read: that is a moved
// or broken page, not news. The run fails (exit 1, nothing written) when
// the result is not the shape the app expects, when most sources that
// answered last time are silent now, or when no source answered at all -
// that is a broken run, not news.
//
// Node 22, built-ins only.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTER_NAMES, ADAPTERS } from "./adapters/index.mjs";
import { compareSlots, toSlots } from "./lib/courses.mjs";
import { addDays, berlinDay, isClock, isDay } from "./lib/dates.mjs";
import { getPage } from "./lib/http.mjs";
import { fetchRobots, isAllowed } from "./lib/robots.mjs";
import { BOOKABLE, BOOKINGS, STATUSES } from "./lib/status.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SOURCES_FILE = path.join(here, "sources.json");
const DEFAULT_OUT = path.join(here, "output/termine.json");

export const DATA_VERSION = 1;
/** Dates of a source that stopped answering are kept this many days. */
export const STALE_DAYS = 3;
const STATE = /^[A-Z]{2}$/;
const ID = /^[a-z0-9][a-z0-9-]*$/;

function fail(message) {
    throw new Error(message);
}

function isHttpUrl(value) {
    return typeof value === "string" && /^https?:\/\/[^\s]+$/.test(value);
}

function isIsoTime(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * The registry: every entry names its state, town, centre, adapter and the page to read.
 * @param {any} sources
 */
export function validateSources(sources) {
    if (!Array.isArray(sources)) {
        fail("sources.json is not a list");
    }
    const seen = new Set();
    sources.forEach((source, index) => {
        const where = `source ${index} (${source?.id ?? "no id"})`;
        if (typeof source !== "object" || source === null) {
            fail(`${where} is not an object`);
        }
        if (typeof source.id !== "string" || !ID.test(source.id)) {
            fail(`${where}: id must be lower-case letters, digits and dashes`);
        }
        if (seen.has(source.id)) {
            fail(`${where}: the id appears twice`);
        }
        seen.add(source.id);
        if (!STATE.test(source.state ?? "")) {
            fail(`${where}: state must be a two-letter code`);
        }
        if (typeof source.city !== "string" || !source.city.trim() || typeof source.name !== "string" || !source.name.trim()) {
            fail(`${where}: city and name are required`);
        }
        if (!ADAPTER_NAMES.includes(source.adapter)) {
            fail(`${where}: unknown adapter "${source.adapter}"`);
        }
        if (!isHttpUrl(source.url)) {
            fail(`${where}: url is not an http(s) address`);
        }
        if (source.towns !== undefined && (!Array.isArray(source.towns) || source.towns.some((town) => typeof town !== "string" || !town.trim()))) {
            fail(`${where}: towns must be a list of names`);
        }
    });
}

function validateSlot(slot, where) {
    if (typeof slot !== "object" || slot === null) {
        fail(`${where} is not an object`);
    }
    if (typeof slot.id !== "string" || !slot.id) {
        fail(`${where} has no id`);
    }
    if (!isDay(slot.date)) {
        fail(`${where}: date is not YYYY-MM-DD`);
    }
    if (slot.time !== undefined && !isClock(slot.time)) {
        fail(`${where}: time is not HH:MM`);
    }
    if (slot.until !== undefined && !isClock(slot.until)) {
        fail(`${where}: until is not HH:MM`);
    }
    if (!STATUSES.includes(slot.status)) {
        fail(`${where}: unknown status "${slot.status}"`);
    }
    if (slot.booking !== undefined && !BOOKINGS.includes(slot.booking)) {
        fail(`${where}: unknown booking "${slot.booking}"`);
    }
    if (typeof slot.title !== "string" || !slot.title) {
        fail(`${where} has no title`);
    }
    if (slot.place !== undefined && typeof slot.place !== "string") {
        fail(`${where}: place is not text`);
    }
    if (slot.deadline !== undefined && !isDay(slot.deadline)) {
        fail(`${where}: deadline is not YYYY-MM-DD`);
    }
    if (!isHttpUrl(slot.url)) {
        fail(`${where}: url is not an http(s) address`);
    }
}

/**
 * The shape `isTermineData` in src/web/utils/termine-store.ts accepts.
 * @param {any} data
 */
export function validateTermine(data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        fail("the file is not a JSON object");
    }
    if (data.version !== DATA_VERSION) {
        fail(`version must be ${DATA_VERSION}`);
    }
    if (!isIsoTime(data.generatedAt)) {
        fail("generatedAt is not an ISO time in UTC");
    }
    if (!Array.isArray(data.centres)) {
        fail("centres is not a list");
    }
    const seen = new Set();
    for (const centre of data.centres) {
        const where = `centre ${centre?.id ?? "(no id)"}`;
        if (typeof centre !== "object" || centre === null || typeof centre.id !== "string" || !ID.test(centre.id)) {
            fail(`${where}: id must be lower-case letters, digits and dashes`);
        }
        if (seen.has(centre.id)) {
            fail(`${where} appears twice`);
        }
        seen.add(centre.id);
        if (!STATE.test(centre.state ?? "") || typeof centre.city !== "string" || !centre.city || typeof centre.name !== "string" || !centre.name) {
            fail(`${where}: state, city and name are required`);
        }
        if (!isHttpUrl(centre.url)) {
            fail(`${where}: url is not an http(s) address`);
        }
        if (typeof centre.ok !== "boolean") {
            fail(`${where}: ok must be true or false`);
        }
        if (centre.checkedAt !== null && !isIsoTime(centre.checkedAt)) {
            fail(`${where}: checkedAt is neither null nor an ISO time in UTC`);
        }
        if (!Array.isArray(centre.slots)) {
            fail(`${where}: slots is not a list`);
        }
        const slotIds = new Set();
        centre.slots.forEach((slot, index) => {
            validateSlot(slot, `${where}, slot ${index}`);
            if (slotIds.has(slot.id)) {
                fail(`${where}: slot ${slot.id} appears twice`);
            }
            slotIds.add(slot.id);
        });
    }
}

/**
 * One entry of sources.json.
 * @typedef {{ id: string, state: string, city: string, name: string, plz?: string, towns?: string[], adapter: string, url: string }} Source
 *
 * What reading one source gave: its upcoming exam dates, or why it could not be read.
 * @typedef {{ ok: true, slots: import("./lib/courses.mjs").Slot[] } | { ok: false, error: string }} ReadResult
 *
 * One centre of the published file.
 * @typedef {Omit<Source, "adapter"> & { checkedAt: string | null, ok: boolean, slots: import("./lib/courses.mjs").Slot[] }} Centre
 *
 * The published file.
 * @typedef {{ version: number, generatedAt: string, centres: Centre[] }} Termine
 */

/** True when the last file knows a date of the centre that is still ahead. */
function expectsDates(previous, today) {
    return Array.isArray(previous?.slots) && previous.slots.some((slot) => isDay(slot?.date) && (!today || slot.date > today));
}

/**
 * Reads one source: robots.txt first, then the page, then the adapter.
 * Resolves with { ok: true, slots } or { ok: false, error }; never throws.
 *
 * `previous` is the centre's entry in the last file. A page in the site's
 * layout that lists no course at all - maintenance, a changed link shape -
 * is recognised but empty; when the last file knows dates ahead for the
 * centre, that is a failed read, so the dates stay (marked unconfirmed)
 * instead of vanishing at once.
 *
 * @param {Source} source
 * @param {{ today?: string, robots?: (url: string) => Promise<string | null>, page?: (url: string) => Promise<{ url: string, html: string }>, previous?: Partial<Centre> | null }} [options]
 * @returns {Promise<ReadResult>}
 */
export async function readSource(source, { today, robots = fetchRobots, page = getPage, previous = null } = {}) {
    try {
        const rules = await robots(source.url);
        if (rules === null) {
            return { ok: false, error: "robots.txt could not be read" };
        }
        if (!isAllowed(rules, source.url)) {
            return { ok: false, error: "robots.txt does not allow this page" };
        }
        const { html, url } = await page(source.url);
        const { recognised, courses } = ADAPTERS[source.adapter].parse(html, url, { today });
        if (!recognised) {
            return { ok: false, error: `the page is not a ${source.adapter} course list any more` };
        }
        if (courses.length === 0 && expectsDates(previous, today)) {
            return { ok: false, error: "no course found on the page" };
        }
        return { ok: true, slots: toSlots(courses, { today }) };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * One centre of the output: the fresh read, or - when it failed - what the last good read still vouches for.
 *
 * @param {Source} source
 * @param {ReadResult} result
 * @param {Partial<Centre> | null | undefined} previous
 * @param {{ now: Date, today: string }} when
 * @returns {Centre}
 */
export function mergeCentre(source, result, previous, { now, today }) {
    const centre = { id: source.id, state: source.state, city: source.city, name: source.name };
    if (source.plz) {
        centre.plz = source.plz;
    }
    if (Array.isArray(source.towns) && source.towns.length > 0) {
        centre.towns = source.towns;
    }
    centre.url = source.url;
    if (result.ok) {
        return { ...centre, checkedAt: now.toISOString(), ok: true, slots: result.slots };
    }
    const checkedAt = isIsoTime(previous?.checkedAt) ? previous.checkedAt : null;
    const fresh = checkedAt !== null && berlinDay(new Date(checkedAt)) >= addDays(today, -STALE_DAYS);
    const kept = fresh && Array.isArray(previous.slots) ? previous.slots.filter((slot) => isDay(slot?.date) && slot.date >= today).sort(compareSlots) : [];
    return { ...centre, checkedAt, ok: false, slots: kept };
}

/**
 * The whole file from the registry, this run's results (by source id) and the previous file.
 *
 * @param {Source[]} sources
 * @param {Map<string, ReadResult>} results
 * @param {{ centres?: Partial<Centre>[] } | null} previousData
 * @param {Date} [now]
 * @returns {Termine}
 */
export function buildTermine(sources, results, previousData, now = new Date()) {
    const today = berlinDay(now);
    const before = new Map((previousData?.centres ?? []).map((centre) => [centre.id, centre]));
    const centres = sources
        .map((source) => mergeCentre(source, results.get(source.id) ?? { ok: false, error: "not read" }, before.get(source.id), { now, today }))
        .sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city, "de") || a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
    return { version: DATA_VERSION, generatedAt: now.toISOString(), centres };
}

/**
 * A run in which most of the sources that answered last time are silent is a
 * broken run, and so is one in which no source answered - also the first
 * run, which has no last time: that is this machine's network, not news.
 *
 * @param {{ centres?: { ok?: boolean }[] } | null} previousData
 * @param {{ centres: { ok?: boolean }[] }} data
 */
export function guardTermine(previousData, data) {
    const answeredBefore = (previousData?.centres ?? []).filter((centre) => centre.ok).length;
    const answeredNow = data.centres.filter((centre) => centre.ok).length;
    if (answeredBefore >= 10 && answeredNow < answeredBefore / 2) {
        fail(`only ${answeredNow} sources answered, ${answeredBefore} did last time; keeping the previous file`);
    }
    if (data.centres.length > 0 && answeredNow === 0) {
        fail(`none of the ${data.centres.length} sources answered; nothing written`);
    }
}

export function summarise(data) {
    const slots = data.centres.flatMap((centre) => centre.slots);
    return {
        centres: data.centres.length,
        answered: data.centres.filter((centre) => centre.ok).length,
        withDates: data.centres.filter((centre) => centre.slots.length > 0).length,
        dates: slots.length,
        bookable: slots.filter((slot) => BOOKABLE.includes(slot.status)).length,
    };
}

/**
 * Reads every source, a few websites at a time and never two pages of one website at once.
 * `previous` is the last file; each source is read knowing its entry there.
 */
export async function readAll(sources, { today, concurrency = 6, log = () => {}, read = readSource, previous = null } = {}) {
    const before = new Map((previous?.centres ?? []).map((centre) => [centre.id, centre]));
    const robotsBySite = new Map();
    const robots = (url) => {
        const origin = new URL(url).origin;
        if (!robotsBySite.has(origin)) {
            robotsBySite.set(origin, fetchRobots(origin));
        }
        return robotsBySite.get(origin);
    };
    const bySite = new Map();
    for (const source of sources) {
        const host = new URL(source.url).hostname;
        bySite.set(host, [...(bySite.get(host) ?? []), source]);
    }
    const sites = [...bySite.values()];
    const results = new Map();
    let next = 0;
    const worker = async () => {
        while (next < sites.length) {
            for (const source of sites[next++]) {
                const result = await read(source, { today, robots, previous: before.get(source.id) ?? null });
                results.set(source.id, result);
                log(result.ok ? `  ${source.id}: ${result.slots.length} dates` : `  ! ${source.id}: ${result.error}`);
            }
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    return results;
}

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

function readJson(file) {
    return file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

async function main(args) {
    const out = path.resolve(option(args, "--out") ?? DEFAULT_OUT);
    const previousFile = option(args, "--previous") ?? out;
    const only = option(args, "--only");
    const concurrency = Number(option(args, "--concurrency") ?? 6);

    const sources = JSON.parse(readFileSync(SOURCES_FILE, "utf8"));
    validateSources(sources);
    let previous = null;
    try {
        previous = readJson(path.resolve(previousFile));
        if (previous) {
            validateTermine(previous);
        }
    } catch (error) {
        console.error(`ignoring the previous file: ${error.message}`);
        previous = null;
    }

    const now = new Date();
    const wanted = only ? sources.filter((source) => source.id === only) : sources;
    console.error(`reading ${wanted.length} of ${sources.length} sources (${now.toISOString()})`);
    const results = await readAll(wanted, { today: berlinDay(now), concurrency, previous, log: (line) => console.error(line) });
    if (only) {
        // A single source is a look at one page, not a new file.
        console.log(JSON.stringify(results.get(only) ?? { ok: false, error: "no such source" }, null, 1));
        return;
    }

    const data = buildTermine(sources, results, previous, now);
    validateTermine(data);
    guardTermine(previous, data);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);
    const summary = summarise(data);
    console.log(`${summary.answered} of ${summary.centres} centres read, ${summary.withDates} list a date; ${summary.dates} dates, ${summary.bookable} bookable`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(`termine sync failed: ${error.message}`);
        process.exit(1);
    });
}
