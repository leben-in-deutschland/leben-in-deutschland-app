#!/usr/bin/env node
// Runs the whole pipeline: check -> (when the PDF changed or --force) extract -> compare
// -> (with --apply) apply the safe part to src/web/data/question.json.
// Usage: node src/catalogue/sync.mjs [--force] [--apply]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { reviewPath, run as apply } from "./apply.mjs";
import { relative, run as check } from "./check.mjs";
import { run as compare, proposalPath, reportPath } from "./compare.mjs";
import { cataloguePath, run as extract } from "./extract.mjs";

function parseArgs(argv) {
    const options = { force: false, apply: false };
    for (const argument of argv) {
        if (argument === "--force") {
            options.force = true;
        } else if (argument === "--apply") {
            options.apply = true;
        } else {
            throw new Error(`unknown argument ${argument}`);
        }
    }
    return options;
}

/** Returns `{ changed, extracted, applied, problems }`. */
export async function run({ force = false, apply: shouldApply = false } = {}) {
    const steps = shouldApply ? 4 : 3;
    console.log(`== 1/${steps} check`);
    const checked = await check({ force });
    if (!checked.changed) {
        console.log("\nThe catalogue PDF did not change; extract and compare were skipped (use --force to run them anyway).");
        return { changed: false, extracted: false, applied: null, problems: [] };
    }

    console.log(`\n== 2/${steps} extract`);
    const { catalogue, problems } = await extract();

    console.log(`\n== 3/${steps} compare`);
    const { results } = await compare();

    let applied = null;
    if (shouldApply && problems.length === 0) {
        console.log(`\n== 4/${steps} apply`);
        applied = await apply();
    } else if (shouldApply) {
        console.log(`\n== 4/${steps} apply skipped because extraction reported problems`);
    }

    console.log("\nSummary");
    console.log(`  catalogue   Stand ${catalogue.source.stand ?? "unknown"}, ${catalogue.questions.length} questions, ${catalogue.counts.withImages} with pictures -> ${relative(cataloguePath)}`);
    console.log(`  categories  ${results.identical.length} identical, ${results.reworded.length} reworded, ${results.added.length} new, ${results.removed.length} removed`);
    console.log(`  review      ${relative(reportPath)} and ${relative(proposalPath)}`);
    if (applied) {
        console.log(`  applied     ${applied.applied} changed, ${applied.heldBack.length + applied.added.length + applied.removed.length} for a human -> ${relative(reviewPath)}`);
    }
    if (problems.length > 0) {
        console.log(`  ✗ extraction reported ${problems.length} problem(s); do not trust the proposal before they are fixed`);
    }
    return { changed: true, extracted: true, applied, problems };
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
