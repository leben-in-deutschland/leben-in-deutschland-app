// Compares the extracted BAMF catalogue with the app's question file and
// writes a review report plus a proposed merged file. Nothing under
// src/web/ is written: the proposal is an input for the owner's review.
//
//   node src/catalogue/compare.mjs
//
// Reads data/bamf-catalogue.json and src/web/data/question.json; writes
// output/report.md and output/question.proposed.json. Matching is
// one-to-one within the same scope (general <-> general, state <-> same
// state): exact normalised stem first, then a fuzzy fallback. Exit 1 only
// when an input is missing; the report itself is the result.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { outputRoot, relative, repoRoot } from "./check.mjs";
import { cataloguePath } from "./extract.mjs";
import { jaccard, normalise, scopeOf, sharedAnswers, similarity, tokens } from "./lib/text.mjs";

export const questionPath = path.join(repoRoot, "src/web/data/question.json");
export const reportPath = path.join(outputRoot, "report.md");
export const proposalPath = path.join(outputRoot, "question.proposed.json");

const LETTERS = ["a", "b", "c", "d"];
const STEM_JACCARD = 0.8;
const LOOSE_STEM_JACCARD = 0.6;
const LOOSE_SHARED_ANSWERS = 3;
const APPROXIMATE_ANSWER = 0.75;

function answersOf(question) {
    return LETTERS.map((letter) => question[letter] ?? "");
}

function officialScope(question) {
    return question.part === "state" ? question.stateCode : "general";
}

/**
 * Pairs official questions with existing ones, one-to-one, best score
 * first. Exact stem matches (tier 1) always win over fuzzy ones (tier 2).
 */
export function matchQuestions(official, existing) {
    const candidates = [];
    const existingByScope = new Map();
    for (const question of existing) {
        const scope = scopeOf(question.num);
        existingByScope.set(scope, [...(existingByScope.get(scope) ?? []), question]);
    }
    const prepared = new Map(existing.map((question) => [question, { stem: normalise(question.question), tokens: tokens(question.question), answers: answersOf(question) }]));
    for (const question of official) {
        const stem = normalise(question.question);
        const stemTokens = tokens(question.question);
        for (const candidate of existingByScope.get(officialScope(question)) ?? []) {
            const other = prepared.get(candidate);
            const shared = sharedAnswers(question.answers, other.answers);
            if (stem === other.stem) {
                candidates.push({ official: question, existing: candidate, how: "exact", score: 100 + shared });
                continue;
            }
            const similarity = jaccard(stemTokens, other.tokens);
            // A stem that gained or lost a trailing note still contains the other one.
            const contained = shared >= LOOSE_SHARED_ANSWERS && (stem.startsWith(other.stem) || other.stem.startsWith(stem));
            if (similarity >= STEM_JACCARD || (similarity >= LOOSE_STEM_JACCARD && shared >= LOOSE_SHARED_ANSWERS) || contained) {
                candidates.push({ official: question, existing: candidate, how: "fuzzy", score: similarity * 10 + shared / 10, similarity });
            }
        }
    }
    candidates.sort((a, b) => b.score - a.score);
    const matches = new Map();
    const taken = new Set();
    for (const candidate of candidates) {
        if (matches.has(candidate.official) || taken.has(candidate.existing)) {
            continue;
        }
        matches.set(candidate.official, candidate);
        taken.add(candidate.existing);
    }
    return matches;
}

/** Index of `text` among `answers` by normalised equality, or -1. */
function indexOfAnswer(answers, text) {
    const wanted = normalise(text);
    return answers.findIndex((answer) => normalise(answer) === wanted);
}

/** Maps picture answers "1".."4" or "Bild 1".."Bild 4" onto each other by their number. */
function pictureIndex(answers, text) {
    const number = /^(?:Bild\s*)?([1-4])$/i.exec(text.trim())?.[1];
    if (!number || !answers.every((answer) => /^(?:Bild\s*)?[1-4]$/i.test(answer.trim()))) {
        return -1;
    }
    return answers.findIndex((answer) => answer.trim().endsWith(number));
}

/** Index of the official answer closest to `text` (similarity >= 0.75, unique best), or -1. */
function approximateIndex(answers, text, taken = new Set()) {
    const scored = answers
        .map((answer, index) => ({ index, similarity: taken.has(index) ? -1 : similarity(text, answer) }))
        .sort((a, b) => b.similarity - a.similarity);
    if (scored[0].similarity < APPROXIMATE_ANSWER) {
        return -1;
    }
    return scored[1] && scored[1].similarity === scored[0].similarity ? -1 : scored[0].index;
}

/**
 * Builds the proposed entry for a matched pair: the official texts, every
 * other field kept, the solution letter moved with its answer, and the
 * translations' a-d permuted when the answers only changed places.
 */
function mergeMatched(existing, official) {
    const oldAnswers = answersOf(existing);
    const permutation = oldAnswers.map((answer) => {
        const index = indexOfAnswer(official.answers, answer);
        return index >= 0 ? index : pictureIndex(official.answers, answer);
    });
    const fullPermutation = permutation.every((index) => index >= 0) && new Set(permutation).size === 4;
    const oldIndex = LETTERS.indexOf(existing.solution);
    let newIndex = oldIndex >= 0 ? permutation[oldIndex] : -1;
    let approximate = false;
    let byElimination = false;
    if (oldIndex >= 0 && newIndex < 0) {
        const taken = new Set(permutation.filter((index) => index >= 0));
        newIndex = approximateIndex(official.answers, oldAnswers[oldIndex], taken);
        if (newIndex < 0 && taken.size === 3) {
            // The three wrong answers are known, so the remaining official answer is the correct one.
            newIndex = [0, 1, 2, 3].find((index) => !taken.has(index));
            byElimination = true;
        }
        approximate = newIndex >= 0;
    }

    const merged = { ...existing, question: official.question };
    official.answers.forEach((answer, index) => {
        merged[LETTERS[index]] = answer;
    });
    let solutionStatus;
    if (oldIndex < 0) {
        solutionStatus = "missing";
        merged.needsReview = true;
        merged.reviewReason = "the existing entry has no solution letter";
    } else if (newIndex < 0) {
        solutionStatus = "unmapped";
        merged.needsReview = true;
        merged.reviewReason = `the correct answer "${oldAnswers[oldIndex]}" is not among the official answers; the old letter ${existing.solution} was kept and may now point at another answer`;
    } else if (approximate) {
        solutionStatus = "approximate";
        merged.solution = LETTERS[newIndex];
        merged.needsReview = true;
        merged.reviewReason = byElimination
            ? `the correct answer "${oldAnswers[oldIndex]}" is not among the official answers, but the three other answers are, so "${official.answers[newIndex]}" was chosen by elimination (${existing.solution} → ${LETTERS[newIndex]}); confirm the letter`
            : `the correct answer was matched approximately: "${oldAnswers[oldIndex]}" ≈ "${official.answers[newIndex]}" (${existing.solution} → ${LETTERS[newIndex]}); confirm the letter`;
    } else {
        merged.solution = LETTERS[newIndex];
        solutionStatus = newIndex === oldIndex ? "kept" : "moved";
    }
    const reordered = fullPermutation && permutation.some((index, from) => index !== from);
    if (reordered && existing.translation) {
        merged.translation = Object.fromEntries(
            Object.entries(existing.translation).map(([lang, entry]) => {
                if (!entry || typeof entry !== "object") {
                    return [lang, entry];
                }
                const permuted = { ...entry };
                permutation.forEach((to, from) => {
                    permuted[LETTERS[to]] = entry[LETTERS[from]];
                });
                return [lang, permuted];
            }),
        );
    }
    merged.officialNum = official.num;
    return { merged, solutionStatus, reordered, sameTexts: fullPermutation };
}

function proposedId(official) {
    return createHash("sha256").update(JSON.stringify([official.num, official.question, official.answers])).digest("hex");
}

function newEntry(official, usedNums) {
    const num = usedNums.has(official.num) ? `NEW-${official.num}` : official.num;
    usedNums.add(num);
    const entry = { num, question: official.question };
    official.answers.forEach((answer, index) => {
        entry[LETTERS[index]] = answer;
    });
    return {
        ...entry,
        solution: "",
        image: official.images?.[0] ?? "-",
        translation: null,
        category: null,
        context: null,
        id: proposedId(official),
        officialNum: official.num,
        needsReview: true,
        reviewReason: "new in the official catalogue: no solution, translation, or explanation yet",
    };
}

/** Quoted for the Markdown report; JSON escaping covers backslashes, quotes, and control characters. */
function quote(text) {
    return JSON.stringify(String(text ?? ""));
}

/**
 * The changed fields of a matched pair. Answers are paired by text (exact,
 * then closest), not by position, so a mere reordering produces no diff.
 */
function fieldDiffs(existing, official) {
    const diffs = [];
    if (normalise(existing.question) !== normalise(official.question)) {
        diffs.push(`question: ${quote(existing.question)} → ${quote(official.question)}`);
    }
    const oldAnswers = answersOf(existing);
    const taken = new Set();
    const unpaired = [];
    for (const answer of oldAnswers) {
        const index = indexOfAnswer(official.answers, answer);
        if (index >= 0 && !taken.has(index)) {
            taken.add(index);
        } else {
            unpaired.push(answer);
        }
    }
    for (const answer of unpaired) {
        const index = approximateIndex(official.answers, answer, taken);
        if (index >= 0) {
            taken.add(index);
            diffs.push(`answer: ${quote(answer)} → ${quote(official.answers[index])}`);
        } else {
            diffs.push(`answer dropped: ${quote(answer)}`);
        }
    }
    official.answers.forEach((answer, index) => {
        if (!taken.has(index)) {
            diffs.push(`answer added: ${quote(answer)}`);
        }
    });
    return diffs;
}

function pluralise(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

export function buildReport({ catalogue, existing, results, proposal, duplicates }) {
    const { identical, reworded, added, removed, solutionStatus, reordered, fuzzy } = results;
    const needsReview = proposal.filter((entry) => entry.needsReview).length;
    const order = new Map(catalogue.questions.map((question, index) => [question.num, index]));
    const matched = [...identical, ...reworded].sort((a, b) => order.get(a.official.num) - order.get(b.official.num));
    const sameNumber = matched.filter(({ official, existing: entry }) => official.num === entry.num);
    const sameGeneral = sameNumber.filter(({ official }) => official.part === "general").length;
    const sameState = sameNumber.length - sameGeneral;
    const matchedGeneral = matched.filter(({ official }) => official.part === "general").length;
    const imageQuestions = catalogue.questions.filter((question) => question.images);
    const imageFiles = imageQuestions.reduce((sum, question) => sum + question.images.length, 0);
    const lines = [];

    lines.push("# BAMF Gesamtfragenkatalog vs. app questions", "");
    lines.push(`- Official catalogue: Stand ${catalogue.source.stand ?? "unknown"}, PDF sha256 \`${catalogue.source.sha256.slice(0, 12)}…\`, Last-Modified ${catalogue.source.lastModified ?? "unknown"}, extracted ${catalogue.source.extractedAt}, ${catalogue.questions.length} questions (${catalogue.counts.general} general + ${catalogue.counts.state} state)`);
    lines.push(`- App questions: \`src/web/data/question.json\`, ${existing.length} questions`);
    lines.push(`- Proposal: \`src/catalogue/output/question.proposed.json\` (same schema as the app file, ${proposal.length} entries, not applied)`, "");

    lines.push("## Summary", "");
    lines.push("| Category | Count | Meaning |", "| --- | ---: | --- |");
    lines.push(`| identical | ${identical.length} | stem and all four answers identical after normalisation (${identical.filter((entry) => entry.reordered).length} of them list the answers in another order) |`);
    lines.push(`| reworded | ${reworded.length} | matched, but the stem or an answer differs (${pluralise(fuzzy, "fuzzy stem match", "fuzzy stem matches")}) |`);
    lines.push(`| new | ${added.length} | official questions without a counterpart in the app |`);
    lines.push(`| removed | ${removed.length} | app questions without a counterpart in the official catalogue |`, "");
    lines.push(`The proposal adopts the official answer order: ${reordered} matched questions had the same answers in another order, so their solution letter and the a–d of their translations move along. Solutions: ${solutionStatus.kept} kept their letter, ${solutionStatus.moved} moved with their answer, ${solutionStatus.approximate} were matched approximately (reworded answer, flagged for review), ${solutionStatus.unmapped + solutionStatus.missing} could not be mapped (old letter kept, flagged). The PDF contains no answer key; new questions have an empty solution. ${pluralise(needsReview, "entry", "entries")} in the proposal carry \`needsReview: true\`.`, "");
    lines.push(`Picture questions in the official catalogue: ${imageQuestions.length} (${imageQuestions.filter((question) => question.images.length === 4).length} with four pictures, ${imageQuestions.filter((question) => question.images.length === 1).length} with one); ${imageFiles} PNG files under \`src/catalogue/output/images/\`. The app has ${existing.filter((question) => question.image && question.image !== "-").length} questions with an image.`, "");

    lines.push("## Numbering", "");
    lines.push(`The app's numbers come from a third-party source and do not follow the official PDF: only ${sameGeneral} of ${matchedGeneral} matched general questions share their number with the official catalogue (${sameState} of ${matched.length - matchedGeneral} state questions do). The app keys learner progress, schedules, and translations by \`num\`, so renumbering is an owner decision; the proposal keeps every existing \`num\` and records the official number in \`officialNum\`.`);
    if (duplicates.length > 0) {
        lines.push("", `Note: ${pluralise(duplicates.length, "number is", "numbers are")} used more than once in the app file (${duplicates.slice(0, 12).join(", ")}${duplicates.length > 12 ? ", …" : ""}); matching therefore uses the unique \`id\`.`);
    }
    lines.push("", "<details>", `<summary>Numbering table (${matched.length} matched questions: official → app)</summary>`, "");
    lines.push("| Official | App | Status |", "| --- | --- | --- |");
    for (const { official, existing: entry, status } of matched) {
        lines.push(`| ${official.num} | ${entry.num}${official.num === entry.num ? "" : " ≠"} | ${status} |`);
    }
    lines.push("", "</details>", "");

    lines.push(`## Reworded (${reworded.length})`, "");
    if (reworded.length === 0) {
        lines.push("None.", "");
    }
    for (const { official, existing: entry, how, merged } of reworded) {
        lines.push(`- **Official ${official.num}** ↔ app ${entry.num}${how === "fuzzy" ? " (fuzzy match)" : ""}${merged.needsReview ? ` — needs review: ${merged.reviewReason}` : ""}`);
        for (const diff of fieldDiffs(entry, official)) {
            lines.push(`  - ${diff}`);
        }
    }
    lines.push("");

    lines.push(`## New in the official catalogue (${added.length})`, "");
    if (added.length === 0) {
        lines.push("None.", "");
    }
    for (const { official, merged } of added) {
        lines.push(`- **Official ${official.num}** (page ${official.page}, proposed as \`${merged.num}\`): ${official.question}`);
        official.answers.forEach((answer, index) => lines.push(`  - ${LETTERS[index]}: ${answer}`));
        if (official.images) {
            lines.push(`  - images: ${official.images.join(", ")}`);
        }
    }
    lines.push("");

    lines.push(`## Not in the official catalogue (${removed.length})`, "");
    if (removed.length === 0) {
        lines.push("None.", "");
    }
    for (const entry of removed) {
        lines.push(`- **App ${entry.num}**: ${entry.question}`);
    }
    lines.push("");

    lines.push("## Next steps for the owner", "");
    lines.push("1. Review `src/catalogue/output/report.md` (this file) and `src/catalogue/output/question.proposed.json`; every entry with `needsReview: true` carries a `reviewReason`.");
    lines.push("2. Decide on numbering: keep the app's `num` values (default, no progress is lost) or renumber to the official numbers in a dedicated migration.");
    lines.push("3. Add solutions for new questions from an authoritative source (the PDF has none) and fill in translations and explanations where they are missing.");
    lines.push("4. Copy the approved texts into `src/web/data/question.json`; drop the helper fields `officialNum`, `needsReview`, `reviewReason`, and `notInOfficialCatalogue` first.");
    lines.push("5. Run `node scripts/split-questions.js` in `src/web`, then `npm test`, `npm run lint`, and `npm run build`.");
    lines.push("6. Pictures: the PNG files under `src/catalogue/output/images/` are extracted for review; the app keeps using its own image URLs until the owner decides otherwise.");
    lines.push("");
    return lines.join("\n");
}

export async function run() {
    for (const [file, hint] of [[cataloguePath, "run node src/catalogue/extract.mjs first"], [questionPath, "the app's question file is missing"]]) {
        if (!existsSync(file)) {
            throw new Error(`${relative(file)} is missing - ${hint}`);
        }
    }
    const catalogue = JSON.parse(readFileSync(cataloguePath, "utf8"));
    const existing = JSON.parse(readFileSync(questionPath, "utf8"));
    console.log(`comparing ${relative(cataloguePath)} (${catalogue.questions.length} official questions) with ${relative(questionPath)} (${existing.length} app questions)`);

    const matches = matchQuestions(catalogue.questions, existing);
    const results = { identical: [], reworded: [], added: [], removed: [], solutionStatus: { kept: 0, moved: 0, approximate: 0, unmapped: 0, missing: 0 }, reordered: 0, fuzzy: 0 };
    const replacements = new Map();
    const usedNums = new Set(existing.map((question) => question.num));
    for (const official of catalogue.questions) {
        const match = matches.get(official);
        if (!match) {
            const merged = newEntry(official, usedNums);
            results.added.push({ official, merged });
            continue;
        }
        const { merged, solutionStatus, reordered, sameTexts } = mergeMatched(match.existing, official);
        results.solutionStatus[solutionStatus]++;
        if (reordered) {
            results.reordered++;
        }
        if (match.how === "fuzzy") {
            results.fuzzy++;
        }
        const identical = sameTexts && normalise(match.existing.question) === normalise(official.question);
        const record = { official, existing: match.existing, how: match.how, merged, reordered, status: identical ? (reordered ? "identical, answers reordered" : "identical") : "reworded" };
        results[identical ? "identical" : "reworded"].push(record);
        replacements.set(match.existing, merged);
    }
    const proposal = existing.map((question) => replacements.get(question) ?? { ...question, notInOfficialCatalogue: true });
    results.removed = existing.filter((question) => !replacements.has(question));
    proposal.push(...results.added.map(({ merged }) => merged));

    const counts = new Map();
    for (const question of existing) {
        counts.set(question.num, (counts.get(question.num) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([num]) => num);

    mkdirSync(outputRoot, { recursive: true });
    const report = buildReport({ catalogue, existing, results, proposal, duplicates });
    writeFileSync(reportPath, report);
    writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);

    console.log(`  identical    ${results.identical.length}`);
    console.log(`  reworded     ${results.reworded.length} (${results.fuzzy} fuzzy matches)`);
    console.log(`  new          ${results.added.length}`);
    console.log(`  removed      ${results.removed.length}`);
    console.log(`  reordered    ${results.reordered} matched questions list the same answers in another order`);
    console.log(`  solutions    ${results.solutionStatus.kept} kept, ${results.solutionStatus.moved} moved, ${results.solutionStatus.approximate} approximate, ${results.solutionStatus.unmapped + results.solutionStatus.missing} unmapped`);
    console.log(`  same number  ${[...results.identical, ...results.reworded].filter(({ official, existing: entry }) => official.num === entry.num).length} of ${results.identical.length + results.reworded.length} matched questions`);
    console.log(`  report       ${relative(reportPath)}`);
    console.log(`  proposal     ${relative(proposalPath)} (${proposal.length} entries; nothing under src/web was changed)`);
    return { results, report, proposal };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    run().catch((error) => {
        console.error(`✗ ${error.message}`);
        process.exit(1);
    });
}
