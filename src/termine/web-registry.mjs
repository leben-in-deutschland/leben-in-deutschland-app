#!/usr/bin/env node
// Writes what the website shows of the registry: src/web/data/termine-registry.json.
//
//   node src/termine/web-registry.mjs           # write the file
//   node src/termine/web-registry.mjs --check   # exit 1 when it is not what sources.json says
//
// The pages under /termine name the centres and their towns before the dates
// arrive (and for a search engine that runs no script). The website is built
// from src/web alone, so it reads a copy of the registry: id, state, town,
// name, postcode, further towns and the centre's page - not the adapter,
// which is the sync's business. Run this after every change to sources.json
// (`discover.mjs --merge` does it by itself); a test fails when the copy is
// out of date.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_FILE = path.join(here, "sources.json");
export const WEB_REGISTRY_FILE = path.resolve(here, "../web/data/termine-registry.json");

/**
 * The part of the registry a page shows, in the registry's order.
 * @param {Record<string, any>[]} sources
 * @returns {Record<string, any>[]}
 */
export function webRegistry(sources) {
    return sources.map(({ id, state, city, name, plz, towns, url }) => ({ id, state, city, name, ...(plz ? { plz } : {}), ...(towns ? { towns } : {}), url }));
}

/** @param {Record<string, any>[]} sources */
export function writeWebRegistry(sources) {
    writeFileSync(WEB_REGISTRY_FILE, `${JSON.stringify(webRegistry(sources), null, 2)}\n`);
}

function main(args) {
    const sources = JSON.parse(readFileSync(SOURCES_FILE, "utf8"));
    const file = path.relative(process.cwd(), WEB_REGISTRY_FILE);
    if (args.includes("--check")) {
        const wanted = `${JSON.stringify(webRegistry(sources), null, 2)}\n`;
        let found = "";
        try {
            found = readFileSync(WEB_REGISTRY_FILE, "utf8");
        } catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }
        if (found !== wanted) {
            console.error(`${file} is not what sources.json says; run: node src/termine/web-registry.mjs`);
            process.exit(1);
        }
        console.log(`${file}: up to date (${sources.length} centres)`);
        return;
    }
    writeWebRegistry(sources);
    console.log(`${file}: ${sources.length} centres`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2));
}
