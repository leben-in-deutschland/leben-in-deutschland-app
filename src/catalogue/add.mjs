// Prepares new official questions for the app and ships them only after the
// owner confirmed the answer.
//
//   node src/catalogue/add.mjs --check                        # validate data/pending-questions.json, print the owner summary
//   node src/catalogue/add.mjs --template <officialNum>[,…]   # add skeleton entries for official questions to the pending file
//   node src/catalogue/add.mjs --confirm <num>[,…]|all [--solution <num>=<letter>]… [--dry-run]
//   node src/catalogue/add.mjs --remove <num>[,…]             # the owner said no
//
// The PDF has no answer key, so a new official question cannot be applied by
// apply.mjs. Instead the agent job writes the complete entry - explanation,
// category, the seven translations, and a proposed solution with a one-line
// justification - into data/pending-questions.json, commits it, and asks the
// owner. `--confirm` is the owner's yes: it moves the confirmed entries into
// src/web/data/question.json (into the block of their scope, serialised like
// apply.mjs does), removes them from the pending file, and keeps the app
// file's numbers unique. Afterwards run `node scripts/split-questions.js &&
// npm test` in src/web. Exit 1 on any invalid entry; nothing is written then.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { relative, repoRoot } from "./check.mjs";
import { questionPath } from "./compare.mjs";
import { cataloguePath } from "./extract.mjs";
import { normalise, scopeOf } from "./lib/text.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const pendingPath = path.join(here, "data/pending-questions.json");
export const statesPath = path.join(repoRoot, "src/web/data/states.json");

export const LETTERS = ["a", "b", "c", "d"];
/** The app's translation languages: TRANSLATION_LANGUAGES in src/web/utils/user-defaults.ts and src/web/scripts/split-questions.js. */
export const LANGUAGES = ["en", "tr", "ru", "fr", "ar", "uk", "hi"];
/** `categories` in src/web/types/question.ts; the app maps anything else to "General". */
export const CATEGORIES = [
    "Rights & Freedoms",
    "Education & Religion",
    "Law & Governance",
    "Democracy & Politics",
    "Economy & Employment",
    "History & Geography",
    "Elections",
    "Press Freedom",
    "Assembly & Protests",
    "Federal System",
    "Constitution",
    "General",
];
/** Languages written in Latin script, in which a proper name may stay as it is. */
const LATIN_SCRIPT = new Set(["en", "tr", "fr"]);
/** A shipped question, in the key order of src/web/data/question.json. */
export const QUESTION_FIELDS = ["num", "question", "a", "b", "c", "d", "solution", "image", "translation", "category", "context", "id"];
/** What a pending entry carries on top of the question. */
export const PENDING_FIELDS = ["officialNum", "justification", "preparedOn", "confirmed"];
const TRANSLATION_FIELDS = ["question", "a", "b", "c", "d", "context"];
/** Numbers the app accepts (NUM in src/web/utils/question-store.ts); a downloaded catalogue with any other number is dropped. */
const NUM = /^(\d{1,3}|[A-Z]{2}-\d{1,2})$/;
export const MIN_CONTEXT_LENGTH = 200;
/** The length of the shipped explanations (450-750 characters); outside is a style note, not an error. */
export const CONTEXT_LENGTH_RANGE = [450, 750];
const GERMAN_WORDS = /\b(der|die|das|und|ist|nicht|ein|eine|einen|einem|einer|den|dem|des|sind|wird|werden|mit|für|auf|von|zu|im|am|dass|auch|oder|als|bei|nach|aus|über|richtig|richtige|antwort)\b/gi;
const MIN_GERMAN_WORDS = 6;
/** Lower-case words that may appear inside a proper name ("Ursula von der Leyen", "Frankfurt am Main"). */
const NAME_CONNECTORS = new Set(["von", "der", "de", "van", "zu", "und", "am", "an", "im", "of", "the", "du", "des", "la", "le"]);
/** Explanations state facts, not their author. */
const MODEL_WORDS = /\b(KI|AI|ChatGPT|GPT|Claude|Gemini|LLM|Sprachmodell|Language Model)\b/;
const FIRST_PERSON = /\b(ich|wir|uns|unser(e|er|es|em|en)?|mein(e|er|es|em|en)?)\b/i;
/** Phrases that assert a letter is the right one: "die richtige Antwort b", "Antwort b ist richtig", "\"b: …\"". */
const ASSERTED_LETTER = [
    /(?:richtige|korrekte|zutreffende)\s+(?:antwort|option|lösung)\s+(?:ist\s+|lautet\s+)?["„“»(]?\s*([a-d])(?!\p{L})/giu,
    /(?:antwort|option|lösung)\s+["„“»(]?\s*([a-d])[")]?\s+ist\s+(?:die\s+)?(?:richtig|korrekt|zutreffend)/giu,
    /["„“»(]\s*([a-d])\s*:/gu,
];

function parseArgs(argv) {
    const options = { check: false, template: [], confirm: null, solutions: {}, remove: [], dryRun: false };
    const list = (value, flag) => {
        if (!value || value.startsWith("--")) {
            throw new Error(`${flag} needs a value`);
        }
        return value.split(",").map((item) => item.trim()).filter(Boolean);
    };
    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === "--check") {
            options.check = true;
        } else if (argument === "--dry-run") {
            options.dryRun = true;
        } else if (argument === "--template") {
            options.template.push(...list(argv[++index], argument));
        } else if (argument === "--confirm") {
            const values = list(argv[++index], argument);
            options.confirm = values.includes("all") ? "all" : values;
        } else if (argument === "--remove") {
            options.remove.push(...list(argv[++index], argument));
        } else if (argument === "--solution") {
            for (const item of list(argv[++index], argument)) {
                const match = /^(.+)=([a-d])$/.exec(item);
                if (!match) {
                    throw new Error(`--solution expects <num>=<letter>, got "${item}"`);
                }
                options.solutions[match[1]] = match[2];
            }
        } else {
            throw new Error(`unknown argument ${argument}`);
        }
    }
    const commands = [options.check, options.template.length > 0, options.confirm !== null, options.remove.length > 0].filter(Boolean).length;
    if (commands !== 1) {
        throw new Error("give exactly one of --check, --template <officialNum>, --confirm <num>|all, --remove <num>");
    }
    if (Object.keys(options.solutions).length > 0 && options.confirm === null) {
        throw new Error("--solution only goes with --confirm");
    }
    return options;
}

/** Quoted for messages; JSON escaping covers backslashes, quotes, and control characters. */
function quote(text) {
    return JSON.stringify(String(text ?? ""));
}

/** The same scheme as `proposedId` in compare.mjs: the official number, the stem, and the four answers. */
export function questionId(officialNum, question, answers) {
    return createHash("sha256").update(JSON.stringify([officialNum, question, answers])).digest("hex");
}

export function readStateCodes(file = statesPath) {
    return JSON.parse(readFileSync(file, "utf8")).map((state) => state.code);
}

/** The integer part of a number: "301" -> 301, "BW-11" -> 11, anything else -> NaN. */
export function numberIndex(num) {
    const match = /^(?:[A-Z]{2}-)?(\d+)$/.exec(String(num ?? ""));
    return match ? Number(match[1]) : Number.NaN;
}

function highestIndex(questions, scope) {
    return questions.reduce((highest, question) => (scopeOf(question.num) === scope ? Math.max(highest, numberIndex(question.num) || 0) : highest), 0);
}

/**
 * The next number for a new question of `scope` ("general" or a state code):
 * one above the highest number the app file or the pending file uses in that
 * scope. A removed question's number is never given out again (learner
 * progress is keyed by `num`), and no gap is filled.
 */
export function nextNum(scope, existing, pending = []) {
    const index = Math.max(highestIndex(existing, scope), highestIndex(pending, scope)) + 1;
    return scope === "general" ? String(index) : `${scope}-${index}`;
}

function isProperName(text) {
    const words = text.split(/[\s/-]+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) {
        return false;
    }
    return words.every((word) => /^\p{Lu}/u.test(word) || NAME_CONNECTORS.has(word.toLowerCase())) && words.some((word) => /^\p{Lu}/u.test(word));
}

/**
 * Whether a translation may equal its German source. Always for a text of at
 * most 4 characters or without letters ("EU", "1949", "3%"); in the Latin-
 * script languages (en, tr, fr) also for an answer that is a proper name of
 * up to four capitalised words ("Konrad Adenauer", "Frankfurt/Oder"). A
 * question, an explanation, or anything in ru, ar, uk, hi beyond numbers
 * and abbreviations must differ from the German text.
 */
export function mayEqualGerman(german, lang, field) {
    const text = String(german ?? "").trim().replace(/\.$/, "");
    if (text.length <= 4 || !/\p{L}/u.test(text)) {
        return true;
    }
    if (!LATIN_SCRIPT.has(lang) || !LETTERS.includes(field)) {
        return false;
    }
    return isProperName(text);
}

/**
 * Whether the explanation names the correct answer: its text as whole words
 * ("… ist Ende des Zweiten Weltkriegs in Europa …"), or its letter next to
 * Antwort/Option/Lösung ("Antwort d", "Option d)"), or quoted with a colon
 * ("\"d: Ende …\"").
 */
export function contextNamesAnswer(context, letter, answerText) {
    const text = ` ${normalise(context)} `;
    const answer = normalise(String(answerText ?? "").replace(/\.$/, ""));
    if (answer && text.includes(` ${answer} `)) {
        return true;
    }
    if (!LETTERS.includes(letter)) {
        return false;
    }
    const byWord = new RegExp(`(?:antwort|option|lösung)\\s*["„“»(]?\\s*${letter}(?!\\p{L})`, "iu");
    const byQuote = new RegExp(`["„“»(]\\s*${letter}\\s*[:)]`, "iu");
    return byWord.test(context) || byQuote.test(context);
}

/** The letters an explanation asserts to be the right one (see ASSERTED_LETTER); empty when it names the answer by text only. */
export function assertedLetters(context) {
    const letters = new Set();
    for (const pattern of ASSERTED_LETTER) {
        for (const match of String(context ?? "").matchAll(pattern)) {
            letters.add(match[1].toLowerCase());
        }
    }
    return letters;
}

/**
 * Every problem of a pending entry; an empty list means it may ship. The
 * entry is checked against the app's questions (`existing`) and the other
 * pending entries (`pending`, the entry itself excluded by identity).
 */
export function validatePending(entry, existing, pending = [], { stateCodes = readStateCodes() } = {}) {
    const problems = [];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return ["the entry is not an object"];
    }
    const others = pending.filter((other) => other !== entry);
    for (const field of [...QUESTION_FIELDS, ...PENDING_FIELDS]) {
        if (!(field in entry)) {
            problems.push(`${field} is missing`);
        }
    }
    for (const field of Object.keys(entry)) {
        if (!QUESTION_FIELDS.includes(field) && !PENDING_FIELDS.includes(field)) {
            problems.push(`unexpected field ${field} (helper fields of the proposal do not ship)`);
        }
    }
    const text = (field) => (typeof entry[field] === "string" ? entry[field].trim() : "");

    if (!text("question")) {
        problems.push("question is empty");
    }
    for (const letter of LETTERS) {
        if (!text(letter)) {
            problems.push(`answer ${letter} is empty`);
        }
    }
    if (!LETTERS.includes(entry.solution)) {
        problems.push(entry.solution ? `solution ${quote(entry.solution)} is not a to d` : "solution is empty: propose a letter a to d");
    }
    if (!CATEGORIES.includes(entry.category)) {
        problems.push(`category ${quote(entry.category)} is not one of ${CATEGORIES.join(", ")}`);
    }
    if (!(entry.image === "-" || /^https:\/\/\S+$/.test(String(entry.image ?? "")))) {
        problems.push(`image ${quote(entry.image)} is neither "-" nor an https URL`);
    }

    const context = text("context");
    if (!context) {
        problems.push("context is empty");
    } else {
        if (context.length < MIN_CONTEXT_LENGTH) {
            problems.push(`context has ${context.length} characters, at least ${MIN_CONTEXT_LENGTH} are needed`);
        }
        if ((context.match(GERMAN_WORDS) ?? []).length < MIN_GERMAN_WORDS) {
            problems.push("context does not read like German prose (too few German function words)");
        }
        if (LETTERS.includes(entry.solution) && !contextNamesAnswer(context, entry.solution, entry[entry.solution])) {
            problems.push(`context does not name the correct answer (${entry.solution}: ${quote(entry[entry.solution])}); rewrite the explanation and its translated contexts so they end with the right answer`);
        }
        const asserted = [...assertedLetters(context)].filter((letter) => letter !== entry.solution);
        if (LETTERS.includes(entry.solution) && asserted.length > 0) {
            problems.push(`context asserts ${asserted.join(" and ")} as the right answer, but the solution is ${entry.solution}; rewrite the explanation and its translated contexts for ${entry.solution}`);
        }
        if (MODEL_WORDS.test(context)) {
            problems.push("context mentions a model or AI; explanations state facts, not their author");
        }
    }

    if (!entry.translation || typeof entry.translation !== "object" || Array.isArray(entry.translation)) {
        problems.push(`translation is not an object with the languages ${LANGUAGES.join(", ")}`);
    } else {
        for (const lang of Object.keys(entry.translation)) {
            if (!LANGUAGES.includes(lang)) {
                problems.push(`translation.${lang} is not one of the app's languages`);
            }
        }
        for (const lang of LANGUAGES) {
            const translated = entry.translation[lang];
            if (!translated || typeof translated !== "object") {
                problems.push(`translation.${lang} is missing`);
                continue;
            }
            for (const field of Object.keys(translated)) {
                if (!TRANSLATION_FIELDS.includes(field)) {
                    problems.push(`translation.${lang}.${field} is not a translation field`);
                }
            }
            for (const field of TRANSLATION_FIELDS) {
                const value = typeof translated[field] === "string" ? translated[field].trim() : "";
                if (!value) {
                    problems.push(`translation.${lang}.${field} is empty`);
                } else if (value === text(field) && !mayEqualGerman(entry[field], lang, field)) {
                    problems.push(`translation.${lang}.${field} equals the German text (a copy is not a translation)`);
                }
            }
        }
    }

    const officialNum = text("officialNum");
    if (!officialNum) {
        problems.push("officialNum is empty");
    } else if (!NUM.test(officialNum)) {
        problems.push(`officialNum ${quote(officialNum)} is not a catalogue number`);
    } else if (others.some((other) => other.officialNum === officialNum)) {
        problems.push(`officialNum ${officialNum} is prepared twice`);
    }

    const num = typeof entry.num === "string" ? entry.num : "";
    if (!NUM.test(num)) {
        problems.push(`num ${quote(entry.num)} is not a number the app accepts ("1".."999" or "<STATE>-<1..99>")`);
    } else {
        const scope = scopeOf(num);
        if (scope !== "general" && !stateCodes.includes(scope)) {
            problems.push(`num ${quote(num)} names no known state`);
        }
        if (existing.some((question) => question.num === num)) {
            problems.push(`num ${num} is already in the app's question file`);
        } else if (numberIndex(num) <= highestIndex(existing, scope)) {
            problems.push(`num ${num} lies below the highest shipped number of its scope (${highestIndex(existing, scope)}); numbers are never reused, take ${nextNum(scope, existing, pending)}`);
        }
        if (others.some((other) => other.num === num)) {
            problems.push(`num ${num} is used by another pending entry`);
        }
        if (officialNum && NUM.test(officialNum) && scopeOf(officialNum) !== scope) {
            problems.push(`num ${num} and officialNum ${officialNum} belong to different scopes`);
        }
    }

    const id = typeof entry.id === "string" ? entry.id : "";
    if (!/^[0-9a-f]{64}$/.test(id)) {
        problems.push("id is not 64 hex characters");
    } else {
        const expected = questionId(officialNum, entry.question, LETTERS.map((letter) => entry[letter]));
        if (id !== expected) {
            problems.push(`id does not equal sha256 of [officialNum, question, answers] (expected ${expected.slice(0, 12)}…)`);
        }
        if (existing.some((question) => question.id === id) || others.some((other) => other.id === id)) {
            problems.push("id is already used");
        }
    }

    if (!text("justification")) {
        problems.push("justification is empty: one sentence why the proposed letter is right, naming the source when possible");
    } else if (MODEL_WORDS.test(entry.justification)) {
        problems.push("justification mentions a model or AI");
    }
    const preparedOn = text("preparedOn");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preparedOn) || Number.isNaN(Date.parse(preparedOn))) {
        problems.push("preparedOn is not an ISO date (YYYY-MM-DD)");
    }
    if (typeof entry.confirmed !== "boolean") {
        problems.push("confirmed is not a boolean");
    }
    return problems;
}

/** Style notes that do not block shipping; the owner reads the texts anyway. */
export function styleNotes(entry) {
    const notes = [];
    const context = typeof entry.context === "string" ? entry.context.trim() : "";
    if (context && (context.length < CONTEXT_LENGTH_RANGE[0] || context.length > CONTEXT_LENGTH_RANGE[1])) {
        notes.push(`context has ${context.length} characters; the shipped explanations have ${CONTEXT_LENGTH_RANGE[0]}-${CONTEXT_LENGTH_RANGE[1]}`);
    }
    if (FIRST_PERSON.test(context)) {
        notes.push("context uses the first person; the shipped explanations do not");
    }
    if (typeof entry.justification === "string" && entry.justification.trim().length > 300) {
        notes.push("justification is longer than one sentence");
    }
    return notes;
}

/** A skeleton entry for an official question; `--check` fails until the empty fields are filled. */
export function templateFor(official, existing, pending = [], today = new Date().toISOString().slice(0, 10)) {
    const scope = official.part === "state" ? official.stateCode : "general";
    const entry = { num: nextNum(scope, existing, pending), question: official.question };
    official.answers.forEach((answer, index) => {
        entry[LETTERS[index]] = answer;
    });
    /** @type {Record<string, Record<string, string>>} */
    const translation = {};
    for (const lang of LANGUAGES) {
        translation[lang] = Object.fromEntries(TRANSLATION_FIELDS.map((field) => [field, ""]));
    }
    return {
        ...entry,
        solution: "",
        image: "-",
        translation,
        category: "",
        context: "",
        id: questionId(official.num, official.question, official.answers),
        officialNum: official.num,
        justification: "",
        preparedOn: today,
        confirmed: false,
    };
}

/** The shipped question: the twelve fields in the file's key order, nothing else. */
export function toQuestion(entry) {
    return Object.fromEntries(QUESTION_FIELDS.map((field) => [field, entry[field]]));
}

function compareNumbers(a, b) {
    const scopeA = scopeOf(a.num);
    const scopeB = scopeOf(b.num);
    if (scopeA !== scopeB) {
        return scopeA === "general" ? -1 : scopeB === "general" ? 1 : scopeA.localeCompare(scopeB);
    }
    return numberIndex(a.num) - numberIndex(b.num);
}

/**
 * The app's questions with the new ones added, each at the end of the block
 * of its scope (a general question after the last general one, a state
 * question after the last one of its state), so the file keeps its order:
 * general questions first, then one block per state. A question of a scope
 * the file does not have yet goes to the end.
 */
export function appendQuestions(existing, entries) {
    const result = existing.slice();
    for (const entry of entries.slice().sort(compareNumbers)) {
        const scope = scopeOf(entry.num);
        let last = -1;
        result.forEach((question, index) => {
            if (scopeOf(question.num) === scope) {
                last = index;
            }
        });
        result.splice(last < 0 ? result.length : last + 1, 0, entry);
    }
    return result;
}

/** Learner progress, explanations, and translations are keyed by `num`; a duplicate silently breaks all three. */
export function assertUniqueNumbers(label, questions) {
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

/**
 * The owner's yes. Marks the entries named in `nums` ("all" for every
 * pending entry) as confirmed, applies the owner's `solutions`
 * (`{ "301": "c" }`) first, validates every confirmed entry, and returns the
 * app's questions with the confirmed ones added plus the pending entries
 * that stay. Throws on an unknown number or an invalid entry; a corrected
 * letter whose answer the explanation does not name is refused.
 */
export function confirmEntries({ existing, pending, nums, solutions = {}, stateCodes }) {
    assertUniqueNumbers("the app's question file", existing);
    const byNum = new Map(pending.map((entry) => [entry.num, entry]));
    const wanted = nums === "all" ? pending.map((entry) => entry.num) : nums;
    const unknown = wanted.filter((num) => !byNum.has(num));
    if (unknown.length > 0) {
        throw new Error(`no pending entry has the number ${unknown.join(", ")} (pending: ${pending.map((entry) => entry.num).join(", ") || "none"})`);
    }
    for (const num of Object.keys(solutions)) {
        if (!wanted.includes(num)) {
            throw new Error(`--solution ${num}=${solutions[num]} names an entry that is not being confirmed`);
        }
    }
    const next = pending.map((entry) => {
        if (!wanted.includes(entry.num)) {
            return entry;
        }
        const corrected = solutions[entry.num] && solutions[entry.num] !== entry.solution ? { ...entry, solution: solutions[entry.num] } : { ...entry };
        corrected.confirmed = true;
        return corrected;
    });
    const confirmed = next.filter((entry) => entry.confirmed === true);
    const problems = [];
    for (const entry of confirmed) {
        for (const problem of validatePending(entry, existing, next, stateCodes ? { stateCodes } : {})) {
            problems.push(`${entry.num}: ${problem}`);
        }
    }
    if (problems.length > 0) {
        throw new Error(`${problems.length} problem(s) in the confirmed entries; nothing was written:\n  ✗ ${problems.join("\n  ✗ ")}`);
    }
    const questions = appendQuestions(existing, confirmed.map(toQuestion));
    assertUniqueNumbers("the question list after adding", questions);
    return { questions, pending: next.filter((entry) => entry.confirmed !== true), confirmed };
}

/** Byte for byte what apply.mjs writes: 2-space JSON without a trailing newline. */
export function serialiseQuestions(questions) {
    return JSON.stringify(questions, null, 2);
}

export function serialisePending(pending) {
    return `${JSON.stringify(pending, null, 2)}\n`;
}

/** The Markdown block the agent posts to the owner: every question, the proposed letter, and the commands. */
export function ownerSummary(pending) {
    if (pending.length === 0) {
        return "No new questions are waiting for confirmation.";
    }
    const lines = [`### New official questions awaiting your confirmation (${pending.length})`, ""];
    for (const entry of pending) {
        lines.push(`**${entry.num}** (official ${entry.officialNum}, ${entry.category || "no category"}): ${entry.question}`);
        for (const letter of LETTERS) {
            lines.push(`- ${letter}) ${entry[letter]}${entry.solution === letter ? " ← proposed" : ""}`);
        }
        lines.push(`- why ${entry.solution || "?"}: ${entry.justification || "(no justification yet)"}`, "");
    }
    const nums = pending.map((entry) => entry.num).join(",");
    lines.push(`Confirm: \`node src/catalogue/add.mjs --confirm ${nums}\` (or \`--confirm all\`). Another letter: \`--confirm <num> --solution <num>=<letter>\` (the explanation must name that answer, otherwise the agent rewrites it first). Reject: \`node src/catalogue/add.mjs --remove <num>\`.`);
    return lines.join("\n");
}

function readJson(file, hint) {
    if (!existsSync(file)) {
        throw new Error(`${relative(file)} is missing - ${hint}`);
    }
    return JSON.parse(readFileSync(file, "utf8"));
}

function readPending(file) {
    const pending = readJson(file, "create it with [] or run from the repository root");
    if (!Array.isArray(pending)) {
        throw new Error(`${relative(file)} must hold an array of pending entries`);
    }
    return pending;
}

function logProblems(entry, problems, notes) {
    const label = `${entry?.num ?? "?"} (official ${entry?.officialNum ?? "?"})`;
    if (problems.length === 0) {
        console.log(`  ✓ ${label} solution ${entry.solution}: ${quote(entry.question)}`);
    } else {
        console.log(`  ✗ ${label}`);
        for (const problem of problems) {
            console.log(`      - ${problem}`);
        }
    }
    for (const note of notes) {
        console.log(`      · ${note}`);
    }
}

/**
 * The command line. `paths` overrides the files (tests); returns what was
 * done. Exit 1 (a thrown error) on any problem; nothing is written then.
 */
export async function run(options, paths = {}) {
    const files = { questionPath, pendingPath, cataloguePath, statesPath, ...paths };
    const existing = readJson(files.questionPath, "the app's question file is missing");
    const pending = readPending(files.pendingPath);
    const stateCodes = readStateCodes(files.statesPath);

    if (options.check) {
        console.log(`checking ${relative(files.pendingPath)} (${pending.length} pending entr${pending.length === 1 ? "y" : "ies"}) against ${relative(files.questionPath)} (${existing.length} app questions)`);
        assertUniqueNumbers(relative(files.questionPath), existing);
        let invalid = 0;
        for (const entry of pending) {
            const problems = validatePending(entry, existing, pending, { stateCodes });
            invalid += problems.length > 0 ? 1 : 0;
            logProblems(entry, problems, styleNotes(entry));
        }
        console.log(`  ${pending.length - invalid} valid, ${invalid} invalid, ${pending.filter((entry) => entry.confirmed === true).length} confirmed but not shipped`);
        if (invalid > 0) {
            throw new Error(`${invalid} pending entr${invalid === 1 ? "y is" : "ies are"} invalid`);
        }
        if (pending.length > 0) {
            console.log("", ownerSummary(pending));
        }
        return { pending, invalid };
    }

    if (options.template.length > 0) {
        const catalogue = readJson(files.cataloguePath, "run node src/catalogue/extract.mjs first");
        const existingIds = new Set(existing.map((question) => question.id));
        const added = [];
        for (const officialNum of options.template) {
            const official = catalogue.questions.find((question) => question.num === officialNum);
            if (!official) {
                throw new Error(`official question ${officialNum} is not in ${relative(files.cataloguePath)}`);
            }
            const id = questionId(official.num, official.question, official.answers);
            if (existingIds.has(id)) {
                throw new Error(`official question ${officialNum} is already in the app (id ${id.slice(0, 12)}…)`);
            }
            if (pending.some((entry) => entry.id === id || entry.officialNum === officialNum)) {
                throw new Error(`official question ${officialNum} is already pending`);
            }
            const entry = templateFor(official, existing, pending);
            pending.push(entry);
            added.push(entry);
        }
        if (!options.dryRun) {
            writeFileSync(files.pendingPath, serialisePending(pending));
        }
        for (const entry of added) {
            console.log(`  + ${entry.num} (official ${entry.officialNum}): ${quote(entry.question)}`);
        }
        console.log(`  pending  ${pending.length} entr${pending.length === 1 ? "y" : "ies"} in ${relative(files.pendingPath)}${options.dryRun ? " (dry run, not written)" : ""}; fill solution, justification, category, context and the ${LANGUAGES.length} translations, then run --check`);
        return { added, pending };
    }

    if (options.remove.length > 0) {
        const missing = options.remove.filter((num) => !pending.some((entry) => entry.num === num));
        if (missing.length > 0) {
            throw new Error(`no pending entry has the number ${missing.join(", ")}`);
        }
        const rest = pending.filter((entry) => !options.remove.includes(entry.num));
        if (!options.dryRun) {
            writeFileSync(files.pendingPath, serialisePending(rest));
        }
        console.log(`  removed  ${options.remove.join(", ")}; ${rest.length} pending entr${rest.length === 1 ? "y" : "ies"} left in ${relative(files.pendingPath)}${options.dryRun ? " (dry run, not written)" : ""}`);
        return { removed: options.remove, pending: rest };
    }

    console.log(`confirming ${options.confirm === "all" ? "all pending entries" : options.confirm.join(", ")} into ${relative(files.questionPath)} (${existing.length} app questions)${options.dryRun ? " [dry run]" : ""}`);
    const result = confirmEntries({ existing, pending, nums: options.confirm, solutions: options.solutions, stateCodes });
    for (const entry of result.confirmed) {
        console.log(`  ✓ ${entry.num} (official ${entry.officialNum}) solution ${entry.solution}: ${quote(entry.question)}`);
    }
    if (!options.dryRun) {
        writeFileSync(files.questionPath, serialiseQuestions(result.questions));
        writeFileSync(files.pendingPath, serialisePending(result.pending));
    }
    console.log(`  question.json ${options.dryRun ? "not written (dry run)" : `written -> ${relative(files.questionPath)}`} (${existing.length} -> ${result.questions.length} questions); run \`node scripts/split-questions.js && npm test\` in src/web`);
    console.log(`  pending       ${result.pending.length} entr${result.pending.length === 1 ? "y" : "ies"} left in ${relative(files.pendingPath)}`);
    return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    Promise.resolve()
        .then(() => run(parseArgs(process.argv.slice(2))))
        .catch((error) => {
            console.error(`✗ ${error.message}`);
            process.exit(1);
        });
}
