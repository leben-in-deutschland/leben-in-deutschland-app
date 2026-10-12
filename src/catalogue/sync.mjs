#!/usr/bin/env node
// Runs the whole pipeline: check -> (when the PDF changed or --force) extract -> compare.
// Usage: node src/catalogue/sync.mjs [--force]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { relative, run as check } from "./check.mjs";
import { run as compare, proposalPath, reportPath } from "./compare.mjs";
import { cataloguePath, run as extract } from "./extract.mjs";

function parseArgs(argv) {
    const options = { force: false };
    for (const argument of argv) {
        if (argument === "--force") {
            options.force = true;
        } else {
            throw new Error(`unknown argument ${argument}`);
        }
    }
    return options;
}

/** Returns `{ changed, extracted, problems }`. */
export async function run({ force = false } = {}) {
    console.log("== 1/3 check");
    const checked = await check({ force });
    if (!checked.changed) {
        console.log("\nThe catalogue PDF did not change; extract and compare were skipped (use --force to run them anyway).");
        return { changed: false, extracted: false, problems: [] };
    }

    console.log("\n== 2/3 extract");
    const { catalogue, problems } = await extract();

    console.log("\n== 3/3 compare");
    const { results } = await compare();

    console.log("\nSummary");
    console.log(`  catalogue   Stand ${catalogue.source.stand ?? "unknown"}, ${catalogue.questions.length} questions, ${catalogue.counts.withImages} with pictures -> ${relative(cataloguePath)}`);
    console.log(`  categories  ${results.identical.length} identical, ${results.reworded.length} reworded, ${results.added.length} new, ${results.removed.length} removed`);
    console.log(`  review      ${relative(reportPath)} and ${relative(proposalPath)}`);
    if (problems.length > 0) {
        console.log(`  ✗ extraction reported ${problems.length} problem(s); do not trust the proposal before they are fixed`);
    }
    return { changed: true, extracted: true, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    run(parseArgs(process.argv.slice(2)))
        .then(({ problems }) => {
            if (problems.length > 0) {
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error(`✗ ${error.message}`);
            process.exit(1);
        });
}
