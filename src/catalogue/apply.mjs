// Applies the safe part of the proposal to the app's question file so a new
// official catalogue reaches learners without a human in the loop.
//
//   node src/catalogue/apply.mjs              # write src/web/data/question.json
//   node src/catalogue/apply.mjs --dry-run    # only report what would change
//
// Safe = a matched question whose solution follows an exact answer-text
// match (the PDF has no answer key). Entries marked `needsReview` (new
// question, approximate or unmapped solution) keep their current app
// version and are listed in output/review.md for the owner, together with
// questions that left the official catalogue. Afterwards run
// `node scripts/split-questions.js` in src/web. With GITHUB_OUTPUT set,
// `applied` and `heldBack` are appended. Exit 1 on a missing input, an
// invalid applied entry, or a duplicate question number (learner progress is
// keyed by `num`, so the app file must keep 460 unique numbers before and
// after); nothing to apply is a normal result.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { outputRoot, relative } from "./check.mjs";
import { proposalPath, questionPath } from "./compare.mjs";
import { cataloguePath } from "./extract.mjs";

export const reviewPath = path.join(outputRoot, "review.md");

const LETTERS = ["a", "b", "c", "d"];
const HELPER_FIELDS = ["officialNum", "needsReview", "reviewReason", "notInOfficialCatalogue"];

function parseArgs(argv) {
    const options = { dryRun: false };
    for (const argument of argv) {
        if (argument === "--dry-run") {
            options.dryRun = true;
        } else {
            throw new Error(`unknown argument ${argument}`);
        }
    }
    return options;
}

function stripHelpers(entry) {
    const clean = { ...entry };
    for (const field of HELPER_FIELDS) {
        delete clean[field];
    }
    return clean;
}

/** Learner progress, explanations, and translations are keyed by `num`; a duplicate silently breaks all three. */
function assertUniqueNumbers(label, questions) {
    const seen = new Set();
    const duplicates = new Set();
    for (const question of questions) {
        if (seen.has(question.num)) {
            duplicates.add(question.num);
        }
        seen.add(question.num);
    }
    if (duplicates.size > 0) {
        const sample = [...duplicates].slice(0, 5).join(", ");
        throw new Error(`${label} has ${duplicates.size} duplicate question number(s) (${sample}${duplicates.size > 5 ? ", …" : ""}); nothing was written`);
    }
}

function validate(entry) {
    const problems = [];
    if (!entry.question?.trim()) {
        problems.push("empty question");
    }
    for (const letter of LETTERS) {
        if (!String(entry[letter] ?? "").trim()) {
            problems.push(`empty answer ${letter}`);
        }
    }
    if (!LETTERS.includes(entry.solution)) {
        problems.push(`solution "${entry.solution}" is not a to d`);
    }
    return problems;
}

/** What changed between the app entry and the applied one; empty when nothing did. */
function changesOf(before, after) {
    const changes = [];
    if (before.question !== after.question) {
        changes.push("question");
    }
    const sameSet = LETTERS.every((letter) => LETTERS.some((other) => before[other] === after[letter]));
    if (LETTERS.some((letter) => before[letter] !== after[letter])) {
        changes.push(sameSet ? "answer order" : "answers");
    }
    if (before.solution !== after.solution) {
        changes.push("solution letter");
    }
    return changes;
}

function quote(text) {
    return `"${String(text ?? "").replace(/"/g, '\\"')}"`;
}

function buildReview({ stand, heldBack, added, removed, applied, unchanged }) {
    const lines = [`# BAMF catalogue Stand ${stand ?? "unknown"}: questions that need a human`, ""];
    lines.push(`The automatic sync applied ${applied} question(s) whose texts and solution could be carried over safely and left ${unchanged} unchanged. The entries below were **not** changed in the app because the official PDF has no answer key and their solution could not be matched by exact answer text. Decide each one by hand in \`src/web/data/question.json\`, then run \`node scripts/split-questions.js\` and \`npm test\` in \`src/web\`.`, "");
    lines.push(`## Kept at the current app version (${heldBack.length})`, "");
    if (heldBack.length === 0) {
        lines.push("None.", "");
    }
    for (const { existing, proposed } of heldBack) {
        lines.push(`- **App ${existing.num}** (official ${proposed.officialNum}) — ${proposed.reviewReason}`);
        lines.push(`  - official: ${quote(proposed.question)} · ${LETTERS.map((letter) => `${letter}) ${proposed[letter]}`).join(" · ")} · proposed solution: ${proposed.solution || "none"}`);
        lines.push(`  - app now: ${quote(existing.question)} · ${LETTERS.map((letter) => `${letter}) ${existing[letter]}`).join(" · ")} · solution: ${existing.solution}`);
    }
    lines.push("", `## New in the official catalogue, not added (${added.length})`, "");
    if (added.length === 0) {
        lines.push("None.", "");
    }
    for (const entry of added) {
        lines.push(`- **Official ${entry.officialNum}** ${quote(entry.question)} · ${LETTERS.map((letter) => `${letter}) ${entry[letter]}`).join(" · ")} — needs a solution, translations, and an explanation before it can ship.`);
    }
    lines.push("", `## No longer in the official catalogue, still in the app (${removed.length})`, "");
    if (removed.length === 0) {
        lines.push("None.", "");
    }
    for (const entry of removed) {
        lines.push(`- **App ${entry.num}** ${quote(entry.question)} — remove it only together with a decision on learner progress keyed by this number.`);
    }
    lines.push("", "The full comparison is in the workflow artifact `catalogue-review` (`report.md`, `question.proposed.json`).", "");
    return lines.join("\n");
}

function writeGitHubOutput(values) {
    if (!process.env.GITHUB_OUTPUT) {
        return;
    }
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([name, value]) => `${name}=${value}\n`).join(""));
}

/** Returns `{ applied, heldBack, added, removed, unchanged, written }`. */
export async function run({ dryRun = false } = {}) {
    for (const [file, hint] of [[proposalPath, "run node src/catalogue/compare.mjs first"], [questionPath, "the app's question file is missing"]]) {
        if (!existsSync(file)) {
            throw new Error(`${relative(file)} is missing - ${hint}`);
        }
    }
    const proposal = JSON.parse(readFileSync(proposalPath, "utf8"));
    const existing = JSON.parse(readFileSync(questionPath, "utf8"));
    const stand = existsSync(cataloguePath) ? JSON.parse(readFileSync(cataloguePath, "utf8")).source?.stand ?? null : null;
    console.log(`applying ${relative(proposalPath)} (${proposal.length} entries) to ${relative(questionPath)} (${existing.length} app questions)${dryRun ? " [dry run]" : ""}`);
    assertUniqueNumbers(relative(questionPath), existing);

    const byId = new Map(existing.map((question) => [question.id, question]));
    const proposedById = new Map(proposal.map((entry) => [entry.id, entry]));
    const heldBack = [];
    const added = [];
    const removed = [];
    const changed = [];
    const problems = [];

    const next = existing.map((question) => {
        const proposed = proposedById.get(question.id);
        if (!proposed) {
            throw new Error(`app question ${question.num} (${question.id}) has no entry in the proposal; re-run compare.mjs`);
        }
        if (proposed.notInOfficialCatalogue) {
            removed.push(question);
            return question;
        }
        if (proposed.needsReview) {
            heldBack.push({ existing: question, proposed });
            return question;
        }
        const clean = stripHelpers(proposed);
        const invalid = validate(clean);
        if (clean.num !== question.num || clean.id !== question.id) {
            invalid.push(`proposal changes num/id (${clean.num}/${clean.id})`);
        }
        if (invalid.length > 0) {
            problems.push(`${question.num}: ${invalid.join(", ")}`);
            return question;
        }
        const changes = changesOf(question, clean);
        if (changes.length > 0) {
            changed.push({ num: question.num, changes });
        }
        return clean;
    });
    for (const entry of proposal) {
        if (!byId.has(entry.id)) {
            added.push(entry);
        }
    }

    if (problems.length > 0) {
        for (const problem of problems) {
            console.log(`  ✗ ${problem}`);
        }
        throw new Error(`${problems.length} applied entr${problems.length === 1 ? "y is" : "ies are"} invalid; nothing was written`);
    }

    const applied = changed.length;
    const unchanged = existing.length - applied - heldBack.length - removed.length;
    const tally = {};
    for (const { changes } of changed) {
        for (const change of changes) {
            tally[change] = (tally[change] ?? 0) + 1;
        }
    }

    assertUniqueNumbers("the applied question list", next);

    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(reviewPath, buildReview({ stand, heldBack, added, removed, applied, unchanged }));
    let written = false;
    if (!dryRun && applied > 0) {
        writeFileSync(questionPath, JSON.stringify(next, null, 2));
        written = true;
    }

    console.log(`  applied      ${applied} question(s) changed${applied > 0 ? ` (${Object.entries(tally).map(([change, count]) => `${count} ${change}`).join(", ")})` : ""}`);
    console.log(`  unchanged    ${unchanged} already match the official catalogue`);
    console.log(`  held back    ${heldBack.length} need a human (kept at the current app version)`);
    console.log(`  new          ${added.length} official question(s) not added (no solution yet)`);
    console.log(`  removed      ${removed.length} app question(s) no longer in the catalogue (kept)`);
    console.log(`  review       ${relative(reviewPath)}`);
    console.log(`  question.json ${written ? `written -> ${relative(questionPath)}; run node scripts/split-questions.js in src/web` : dryRun ? "not written (dry run)" : "unchanged"}`);
    writeGitHubOutput({ applied: String(applied), heldBack: String(heldBack.length + added.length + removed.length) });
    return { applied, heldBack, added, removed, unchanged, written };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    run(parseArgs(process.argv.slice(2))).catch((error) => {
        console.error(`✗ ${error.message}`);
        process.exit(1);
    });
}
