#!/usr/bin/env node
// Keeps the app's bundled copies of two files that the scraper repository
// (github.com/leben-in-deutschland/leben-in-deutschland-scrapper) publishes in
// step with their source:
//
//   evaluation    src/web/data/current-evaluation.json   BAMF's evaluation status (exam date, last check)
//   pruefstellen  src/web/data/prüfstellen.json          the exam centres of the 16 states
//
//   node scripts/scraper-sync.mjs <source> --check   # watch: print what changed, write nothing
//   node scripts/scraper-sync.mjs <source>           # download, validate, write, bump the patch version
//
// `--check` is what the PULSE watch automations run (.pulse/automations/*.sh): it
// prints nothing and exits 0 when the download equals the bundled file, prints
// a short description of the change when it differs, and exits 1 when the
// download failed or is not the shape the app expects. Without `--check` the
// script writes the new file and bumps the patch version in src/web/package.json
// and src/web/package-lock.json, the way the former GitHub workflows did; the
// caller commits (see .pulse/skills/scraper-data-sync/SKILL.md).
//
// Node 22, built-ins only: the daemon runs the watch in a fresh worktree of the
// default branch where src/web/node_modules does not exist.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "..");
const webRoot = path.join(repoRoot, "src/web");

const SCRAPER_RAW = "https://raw.githubusercontent.com/leben-in-deutschland/leben-in-deutschland-scrapper/main/data/";
const USER_AGENT = "LebenInDeutschlandDataSync/1.0 (+https://github.com/leben-in-deutschland/leben-in-deutschland-app)";
const TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 3_000;

const GERMAN_DATE = /^\d{1,2}\.\d{1,2}\.\d{4}(\s.*)?$/;
const STATE_CODE = /^[a-z]{2}$/;
const STATE_COUNT = 16;

export const SOURCES = {
    evaluation: {
        file: "src/web/data/current-evaluation.json",
        url: `${SCRAPER_RAW}current-evaluation.json`,
        label: "BAMF evaluation status",
        validate: validateEvaluation,
        describe: describeEvaluation,
        commitMessage: (data) => `data: BAMF evaluation status ${data.examDate} (checked ${data.lastSyncAt.split(" ")[0]})`,
    },
    pruefstellen: {
        file: "src/web/data/prüfstellen.json",
        url: `${SCRAPER_RAW}pr%C3%BCfstellen.json`,
        label: "exam centres (Prüfstellen)",
        validate: validatePruefstellen,
        describe: describePruefstellen,
        commitMessage: (data) => `data: exam centres from the scraper (${countCentres(data)} centres)`,
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

/** One line per changed fact; empty when the files are equal in every fact we name. */
export function describeEvaluation(before, after) {
    return [
        change("examDate", before.examDate, after.examDate),
        change("lastSyncAt", before.lastSyncAt, after.lastSyncAt),
        change("history entries", before.history.length, after.history.length),
    ].filter(Boolean);
}

export function describePruefstellen(before, after) {
    const lines = [change("centres", countCentres(before), countCentres(after))].filter(Boolean);
    const counts = new Map(before.map((state) => [state.stateCode, state.data.length]));
    for (const state of after) {
        const line = change(`  ${state.stateCode}`, counts.get(state.stateCode) ?? 0, state.data.length);
        if (line) {
            lines.push(line);
        }
    }
    return lines;
}

/**
 * The scraper re-scrapes the centres from scratch; a half-empty result means a
 * scrape failed, not that half the centres closed. Refuse to carry that over.
 */
function guardPruefstellen(before, after) {
    const was = countCentres(before);
    const now = countCentres(after);
    if (now * 2 < was) {
        throw new Error(`the download has ${now} centres, the bundled file ${was}; refusing to shrink the list by more than half`);
    }
}

async function attempt(url) {
    let response;
    try {
        response = await fetch(url, {
            headers: { "user-agent": USER_AGENT, accept: "application/json" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch (error) {
        const reason = error.name === "TimeoutError" ? `no response within ${TIMEOUT_MS / 1000} s` : (error.cause?.code ?? error.message);
        throw Object.assign(new Error(`GET ${new URL(url).pathname} failed: ${reason}`), { retryable: true });
    }
    if (response.status >= 500) {
        await response.body?.cancel();
        throw Object.assign(new Error(`GET ${new URL(url).pathname} failed with ${response.status}`), { retryable: true });
    }
    if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`GET ${new URL(url).pathname} failed with ${response.status}`);
    }
    return response.text();
}

/** GETs the published file as text; network errors and 5xx answers are retried once. */
export async function download(url) {
    for (let tries = 0; ; tries++) {
        try {
            return await attempt(url);
        } catch (error) {
            if (error.retryable && tries < 1) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                continue;
            }
            throw error;
        }
    }
}

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
    const bundledText = readFileSync(filePath, "utf8");
    const bundled = parse(bundledText, source.file);
    source.validate(bundled);

    const downloadedText = await download(source.url);
    const downloaded = parse(downloadedText, "the download");
    source.validate(downloaded);
    if (sourceName === "pruefstellen") {
        guardPruefstellen(bundled, downloaded);
    }

    if (downloadedText === bundledText) {
        if (!check) {
            console.log(`${source.file} is up to date with the scraper; nothing written.`);
        }
        return { changed: false };
    }

    const lines = source.describe(bundled, downloaded);
    if (lines.length === 0) {
        lines.push("the file differs only in formatting or in facts this script does not name");
    }
    if (check) {
        console.log(`${source.label}: ${source.file} differs from the scraper's file.`);
        for (const line of lines) {
            console.log(`  ${line}`);
        }
        return { changed: true };
    }

    writeFileSync(filePath, downloadedText);
    const { current, next } = bumpVersion();
    console.log(`Wrote ${source.file}:`);
    for (const line of lines) {
        console.log(`  ${line}`);
    }
    console.log(`Bumped src/web/package.json and package-lock.json ${current} -> ${next}.`);
    console.log(`Suggested commit message: ${source.commitMessage(downloaded)}`);
    return { changed: true, commitMessage: source.commitMessage(downloaded) };
}

function usage() {
    console.error("usage: node scripts/scraper-sync.mjs evaluation|pruefstellen [--check]");
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
