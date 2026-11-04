// @vitest-environment node
/*
 * The BAMF catalogue pipeline (src/catalogue/add.mjs) ships a new official
 * question only after the owner confirmed the answer: the agent prepares the
 * complete entry in data/pending-questions.json, `--check` validates it
 * strictly, and `--confirm` moves it into the app's question file in the
 * format apply.mjs writes.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    appendQuestions,
    assertedLetters,
    confirmEntries,
    contextNamesAnswer,
    LANGUAGES,
    mayEqualGerman,
    nextNum,
    ownerSummary,
    run,
    serialisePending,
    serialiseQuestions,
    templateFor,
    toQuestion,
    validatePending,
} from "../../catalogue/add.mjs";

type Entry = Record<string, unknown> & { translation: Record<string, Record<string, string>> };

const STATE_CODES = ["BW", "BY", "BE"];
const LETTERS = ["a", "b", "c", "d"] as const;

function sha256(officialNum: string, question: string, answers: string[]) {
    return createHash("sha256").update(JSON.stringify([officialNum, question, answers])).digest("hex");
}

/** A shipped-looking app question with the given number. */
function appQuestion(num: string, question = `Frage ${num}?`) {
    return {
        num,
        question,
        a: "Antwort A",
        b: "Antwort B",
        c: "Antwort C",
        d: "Antwort D",
        solution: "a",
        image: "-",
        translation: null,
        category: "General",
        context: "Kontext",
        id: createHash("sha256").update(`${num}${question}`).digest("hex"),
    };
}

/** 300 general questions and BW-1..BW-10, BY-1..BY-10, BE-1..BE-10, in the order of the app file. */
function catalogue() {
    const general = Array.from({ length: 300 }, (_, i) => appQuestion(String(i + 1)));
    const states = STATE_CODES.flatMap((code) => Array.from({ length: 10 }, (_, i) => appQuestion(`${code}-${i + 1}`)));
    return [...general, ...states];
}

const CONTEXT =
    "In Deutschland dürfen Menschen offen etwas gegen die Regierung sagen, weil hier Meinungsfreiheit gilt. " +
    "Artikel 5 des Grundgesetzes schützt das Recht, die eigene Meinung in Wort, Schrift und Bild frei zu äußern und zu verbreiten, " +
    "auch wenn sie sich gegen die Regierung richtet. Religionsfreiheit betrifft den Glauben, nicht die politische Kritik. " +
    "Dass Menschen Steuern zahlen, begründet kein Grundrecht, und eine Wahlpflicht gibt es in Deutschland nicht. " +
    'Daher ist die richtige Antwort "d: hier Meinungsfreiheit gilt."';

/** A complete, valid pending entry (official question 1 of the 2025 catalogue), numbered 301. */
function pendingEntry(overrides: Record<string, unknown> = {}): Entry {
    const question = "In Deutschland dürfen Menschen offen etwas gegen die Regierung sagen, weil …";
    const answers = ["hier Religionsfreiheit gilt.", "die Menschen Steuern zahlen.", "die Menschen das Wahlrecht haben.", "hier Meinungsfreiheit gilt."];
    const translation: Record<string, Record<string, string>> = {};
    for (const lang of LANGUAGES as string[]) {
        translation[lang] = {
            question: `[${lang}] ${question}`,
            a: `[${lang}] ${answers[0]}`,
            b: `[${lang}] ${answers[1]}`,
            c: `[${lang}] ${answers[2]}`,
            d: `[${lang}] ${answers[3]}`,
            context: `[${lang}] ${CONTEXT}`,
        };
    }
    return {
        num: "301",
        question,
        a: answers[0],
        b: answers[1],
        c: answers[2],
        d: answers[3],
        solution: "d",
        image: "-",
        translation,
        category: "Rights & Freedoms",
        context: CONTEXT,
        id: sha256("1", question, answers),
        officialNum: "1",
        justification: "Art. 5 Abs. 1 GG garantiert die Meinungsfreiheit.",
        preparedOn: "2026-11-03",
        confirmed: false,
        ...overrides,
    };
}

function problemsOf(entry: Entry, existing = catalogue(), pending: Entry[] = [entry]) {
    return validatePending(entry, existing, pending, { stateCodes: STATE_CODES }) as string[];
}

describe("validatePending accepts a complete entry", () => {
    it("has no problems", () => {
        expect(problemsOf(pendingEntry())).toEqual([]);
    });

    it("accepts a state question numbered after its state's last one", () => {
        const entry = pendingEntry({ num: "BW-11", officialNum: "BW-3", id: sha256("BW-3", pendingEntry().question as string, LETTERS.map((letter) => pendingEntry()[letter] as string)) });
        expect(problemsOf(entry)).toEqual([]);
    });
});

describe("validatePending rejects each class of defect", () => {
    it("a missing language", () => {
        const entry = pendingEntry();
        delete entry.translation.hi;
        expect(problemsOf(entry)).toEqual(["translation.hi is missing"]);
    });

    it("an unknown language or translation field", () => {
        const entry = pendingEntry();
        entry.translation.de = { ...entry.translation.en };
        entry.translation.en.explanation = "extra";
        expect(problemsOf(entry)).toEqual(["translation.de is not one of the app's languages", "translation.en.explanation is not a translation field"]);
    });

    it("a copied translation", () => {
        const entry = pendingEntry();
        entry.translation.ru.question = entry.question as string;
        entry.translation.en.context = entry.context as string;
        expect(problemsOf(entry)).toEqual([
            "translation.en.context equals the German text (a copy is not a translation)",
            "translation.ru.question equals the German text (a copy is not a translation)",
        ]);
    });

    it("an empty translation field", () => {
        const entry = pendingEntry();
        entry.translation.ar.b = "  ";
        expect(problemsOf(entry)).toEqual(["translation.ar.b is empty"]);
    });

    it("a bad category", () => {
        expect(problemsOf(pendingEntry({ category: "Geschichte" }))).toEqual([expect.stringMatching(/^category "Geschichte" is not one of Rights & Freedoms, /)]);
    });

    it("a duplicate num against the app file", () => {
        expect(problemsOf(pendingEntry({ num: "300" }))).toEqual(["num 300 is already in the app's question file"]);
    });

    it("a num below the highest shipped one (a removed question's number is never reused)", () => {
        const existing = catalogue().filter((question) => question.num !== "299");
        expect(problemsOf(pendingEntry({ num: "299" }), existing)).toEqual(["num 299 lies below the highest shipped number of its scope (300); numbers are never reused, take 301"]);
    });

    it("a duplicate num against another pending entry", () => {
        const first = pendingEntry();
        const second = pendingEntry({ officialNum: "2", question: "Andere Frage?", id: sha256("2", "Andere Frage?", LETTERS.map((letter) => first[letter] as string)) });
        for (const lang of LANGUAGES as string[]) {
            second.translation[lang].question = `[${lang}] Andere Frage?`;
        }
        expect(problemsOf(second, catalogue(), [first, second])).toEqual(["num 301 is used by another pending entry"]);
    });

    it("a num the app would drop and a num of an unknown state", () => {
        expect(problemsOf(pendingEntry({ num: "NEW-1" }))).toEqual(['num "NEW-1" is not a number the app accepts ("1".."999" or "<STATE>-<1..99>")']);
        expect(problemsOf(pendingEntry({ num: "XX-1", officialNum: "XX-1", id: sha256("XX-1", pendingEntry().question as string, LETTERS.map((letter) => pendingEntry()[letter] as string)) }))).toEqual(['num "XX-1" names no known state']);
    });

    it("a num whose scope differs from the official number's", () => {
        expect(problemsOf(pendingEntry({ num: "BW-11" }))).toEqual(["num BW-11 and officialNum 1 belong to different scopes"]);
    });

    it("a wrong id", () => {
        expect(problemsOf(pendingEntry({ id: "abc" }))).toEqual(["id is not 64 hex characters"]);
        const scraperId = createHash("sha256").update(`${pendingEntry().question}${pendingEntry().a}${pendingEntry().b}${pendingEntry().c}${pendingEntry().d}`).digest("hex");
        expect(problemsOf(pendingEntry({ id: scraperId }))).toEqual([expect.stringMatching(/^id does not equal sha256 of \[officialNum, question, answers\] \(expected [0-9a-f]{12}…\)$/)]);
    });

    it("a solution letter the explanation does not name", () => {
        expect(problemsOf(pendingEntry({ solution: "a" }))).toEqual([
            'context does not name the correct answer (a: "hier Religionsfreiheit gilt."); rewrite the explanation and its translated contexts so they end with the right answer',
            "context asserts d as the right answer, but the solution is a; rewrite the explanation and its translated contexts for a",
        ]);
    });

    it("an empty or invalid solution", () => {
        expect(problemsOf(pendingEntry({ solution: "" }))).toEqual(["solution is empty: propose a letter a to d"]);
        expect(problemsOf(pendingEntry({ solution: "e" }))).toEqual(['solution "e" is not a to d']);
    });

    it("a short context", () => {
        const short = 'Meinungsfreiheit ist ein Grundrecht und die richtige Antwort ist "d: hier Meinungsfreiheit gilt."';
        expect(problemsOf(pendingEntry({ context: short }))).toEqual([`context has ${short.length} characters, at least 200 are needed`]);
    });

    it("a context that is not German or names a model", () => {
        const english = "Freedom of expression is protected by Article 5 of the Basic Law, so people may openly criticise the government. ".repeat(3) + 'Therefore the answer is "d: hier Meinungsfreiheit gilt."';
        expect(problemsOf(pendingEntry({ context: english }))).toEqual(["context does not read like German prose (too few German function words)"]);
        expect(problemsOf(pendingEntry({ context: `${CONTEXT} Laut KI ist das so.` }))).toEqual(["context mentions a model or AI; explanations state facts, not their author"]);
    });

    it("missing fields, empty texts, a bad image, a bad date, a non-boolean confirmed", () => {
        const entry = pendingEntry({ image: "http://example.org/x.png", preparedOn: "3.11.2026", confirmed: "yes", a: "", justification: " " });
        delete entry.officialNum;
        const problems = problemsOf(entry);
        expect(problems).toContain("officialNum is missing");
        expect(problems).toContain("answer a is empty");
        expect(problems).toContain('image "http://example.org/x.png" is neither "-" nor an https URL');
        expect(problems).toContain("preparedOn is not an ISO date (YYYY-MM-DD)");
        expect(problems).toContain("confirmed is not a boolean");
        expect(problems).toContain("justification is empty: one sentence why the proposed letter is right, naming the source when possible");
    });

    it("helper fields of the proposal", () => {
        expect(problemsOf(pendingEntry({ needsReview: true }))).toEqual(["unexpected field needsReview (helper fields of the proposal do not ship)"]);
    });
});

describe("the copy rule for translations", () => {
    it("allows years, numbers, and abbreviations in every language", () => {
        for (const lang of LANGUAGES as string[]) {
            expect(mayEqualGerman("1949", lang, "a")).toBe(true);
            expect(mayEqualGerman("3%", lang, "b")).toBe(true);
            expect(mayEqualGerman("EU", lang, "c")).toBe(true);
            expect(mayEqualGerman("Bild 1", lang, "d")).toBe(false);
        }
    });

    it("allows a proper name as an answer in Latin-script languages only", () => {
        expect(mayEqualGerman("Konrad Adenauer", "en", "a")).toBe(true);
        expect(mayEqualGerman("Ursula von der Leyen", "fr", "b")).toBe(true);
        expect(mayEqualGerman("Frankfurt/Oder", "tr", "c")).toBe(true);
        expect(mayEqualGerman("Konrad Adenauer", "ru", "a")).toBe(false);
        expect(mayEqualGerman("Konrad Adenauer", "en", "question")).toBe(false);
        expect(mayEqualGerman("hier Meinungsfreiheit gilt.", "en", "d")).toBe(false);
        expect(mayEqualGerman("Grundgesetz", "en", "a")).toBe(true);
    });
});

describe("the explanation names the answer", () => {
    it("by text, by letter, or quoted with a colon", () => {
        expect(contextNamesAnswer("Deshalb gilt hier Meinungsfreiheit, nicht Religionsfreiheit.", "d", "hier Meinungsfreiheit gilt.")).toBe(false);
        expect(contextNamesAnswer("Die richtige Antwort ist, dass hier Meinungsfreiheit gilt.", "d", "hier Meinungsfreiheit gilt.")).toBe(true);
        expect(contextNamesAnswer("Aus diesen Gründen ist Option d die richtige.", "d", "x")).toBe(true);
        expect(contextNamesAnswer('Daher ist die richtige Antwort "d: hier Meinungsfreiheit gilt."', "d", "x")).toBe(true);
        expect(contextNamesAnswer("Antwort b ist korrekt.", "d", "x")).toBe(false);
    });

    it("tells which letter an explanation asserts", () => {
        expect([...assertedLetters("Aus diesen Gründen ist Option b, freie Wahlen, die richtige Antwort.")]).toEqual([]);
        expect([...assertedLetters("Daher ist die korrekte Antwort c: 17. Juni.")]).toEqual(["c"]);
        expect([...assertedLetters("Antwort c ist korrekt.")]).toEqual(["c"]);
        expect([...assertedLetters('Daher ist die richtige Antwort "a: Ende des Zweiten Weltkriegs in Europa".')]).toEqual(["a"]);
        expect([...assertedLetters('Antwort b ist daher richtig: "Man darf sich seinen Wohnort selbst aussuchen."')]).toEqual(["b"]);
        expect([...assertedLetters("Antwort b, ein Kindergartenplatz, ist daher korrekt.")]).toEqual(["b"]);
        expect([...assertedLetters('Historisch wird sie als "Grundgesetz" bezeichnet, was die Antwort a als korrekt bestätigt.')]).toEqual(["a"]);
        expect([...assertedLetters("In diesem Kontext erkennen wir die Antwort c als korrekt.")]).toEqual(["c"]);
        expect([...assertedLetters("Option a ist somit korrekt.")]).toEqual(["a"]);
        expect([...assertedLetters("Antwort b, die oft gewählt wird, ist falsch.")]).toEqual([]);
    });

    it("never asserts another letter than the solution in the app's shipped German explanations", () => {
        const questions = JSON.parse(readFileSync(path.join(__dirname, "../data/question.json"), "utf8")) as Array<{
            num: string;
            solution: string;
            context?: string;
        }>;
        const wrong = questions
            .map((question) => ({ num: question.num, letters: [...assertedLetters(question.context)].filter((letter) => letter !== question.solution) }))
            .filter((entry) => entry.letters.length > 0)
            .map((entry) => `${entry.num}: ${entry.letters.join(",")}`);
        expect(wrong).toEqual([]);
    });
});

describe("numbering", () => {
    it("takes the next free integer above the highest number of the scope and never fills a gap", () => {
        const existing = catalogue();
        expect(nextNum("general", existing)).toBe("301");
        expect(nextNum("BW", existing)).toBe("BW-11");
        expect(nextNum("general", existing.filter((question) => question.num !== "300"))).toBe("300");
        expect(nextNum("general", existing.filter((question) => question.num !== "150"))).toBe("301");
        expect(nextNum("general", existing, [pendingEntry()])).toBe("302");
        expect(nextNum("HH", existing)).toBe("HH-1");
    });

    it("builds a template with the shared id scheme and empty fields", () => {
        const official = { num: "7", part: "general", question: "Neue Frage?", answers: ["eins", "zwei", "drei", "vier"] };
        const template = templateFor(official, catalogue(), [], "2026-11-03");
        expect(template.num).toBe("301");
        expect(template.id).toBe(sha256("7", "Neue Frage?", ["eins", "zwei", "drei", "vier"]));
        expect(template.solution).toBe("");
        expect(Object.keys(template.translation)).toEqual(LANGUAGES);
        expect(template.confirmed).toBe(false);
        expect(problemsOf(template as Entry).length).toBeGreaterThan(5);
    });
});

describe("appendQuestions", () => {
    it("adds a general question after the last general one and a state question after its state", () => {
        const existing = catalogue();
        const general = toQuestion(pendingEntry());
        const state = toQuestion(pendingEntry({ num: "BW-11" }));
        const result = appendQuestions(existing, [state, general]);
        expect(result).toHaveLength(existing.length + 2);
        expect(result.map((question) => question.num).slice(299, 302)).toEqual(["300", "301", "BW-1"]);
        expect(result.map((question) => question.num).slice(310, 313)).toEqual(["BW-10", "BW-11", "BY-1"]);
        expect(Object.keys(result[300])).toEqual(["num", "question", "a", "b", "c", "d", "solution", "image", "translation", "category", "context", "id"]);
        expect(existing).toHaveLength(330);
    });
});

describe("confirmEntries", () => {
    it("ships the confirmed entries and keeps the rest pending", () => {
        const first = pendingEntry();
        const second = pendingEntry({ num: "302", officialNum: "2", question: "Zweite Frage?", id: sha256("2", "Zweite Frage?", LETTERS.map((letter) => first[letter] as string)) });
        for (const lang of LANGUAGES as string[]) {
            second.translation[lang].question = `[${lang}] Zweite Frage?`;
        }
        const result = confirmEntries({ existing: catalogue(), pending: [first, second], nums: ["301"], stateCodes: STATE_CODES });
        expect(result.questions).toHaveLength(331);
        expect(result.questions[300].num).toBe("301");
        expect(result.questions[300]).not.toHaveProperty("justification");
        expect(result.pending).toEqual([second]);
        expect(result.confirmed[0].confirmed).toBe(true);
    });

    it("refuses an unknown number and a --solution for an entry that is not confirmed", () => {
        expect(() => confirmEntries({ existing: catalogue(), pending: [pendingEntry()], nums: ["999"], stateCodes: STATE_CODES })).toThrow(/no pending entry has the number 999/);
        expect(() => confirmEntries({ existing: catalogue(), pending: [pendingEntry()], nums: [], solutions: { "301": "a" }, stateCodes: STATE_CODES })).toThrow(/names an entry that is not being confirmed/);
    });

    it("applies the owner's corrected letter only when the explanation names that answer", () => {
        const refused = () => confirmEntries({ existing: catalogue(), pending: [pendingEntry()], nums: ["301"], solutions: { "301": "a" }, stateCodes: STATE_CODES });
        expect(refused).toThrow(/context does not name the correct answer \(a: "hier Religionsfreiheit gilt\."\); rewrite the explanation/);

        const rewritten = CONTEXT.replace('Daher ist die richtige Antwort "d: hier Meinungsfreiheit gilt."', 'Daher ist die richtige Antwort "a: hier Religionsfreiheit gilt."');
        const entry = pendingEntry({ context: rewritten });
        for (const lang of LANGUAGES as string[]) {
            entry.translation[lang].context = `[${lang}] ${rewritten}`;
        }
        const result = confirmEntries({ existing: catalogue(), pending: [entry], nums: ["301"], solutions: { "301": "a" }, stateCodes: STATE_CODES });
        expect(result.questions[300].solution).toBe("a");
        expect(result.pending).toEqual([]);
    });

    it("refuses an invalid entry and a duplicate number in the app file", () => {
        expect(() => confirmEntries({ existing: catalogue(), pending: [pendingEntry({ category: "x" })], nums: "all", stateCodes: STATE_CODES })).toThrow(/1 problem\(s\) in the confirmed entries; nothing was written/);
        expect(() => confirmEntries({ existing: [...catalogue(), appQuestion("5")], pending: [pendingEntry()], nums: "all", stateCodes: STATE_CODES })).toThrow(/duplicate question number/);
    });
});

describe("serialisation", () => {
    it("writes question.json like apply.mjs (2-space JSON, no trailing newline) and the pending file with one", () => {
        const questions = [appQuestion("1")];
        expect(serialiseQuestions(questions)).toBe(JSON.stringify(questions, null, 2));
        expect(serialiseQuestions(questions).endsWith("\n")).toBe(false);
        expect(serialisePending([])).toBe("[]\n");
    });

    it("summarises the pending questions for the owner with the confirm command", () => {
        const summary = ownerSummary([pendingEntry()]);
        expect(summary).toContain("**301** (official 1, Rights & Freedoms): In Deutschland dürfen Menschen offen etwas gegen die Regierung sagen, weil …");
        expect(summary).toContain("- d) hier Meinungsfreiheit gilt. ← proposed");
        expect(summary).toContain("- why d: Art. 5 Abs. 1 GG garantiert die Meinungsfreiheit.");
        expect(summary).toContain("`node src/catalogue/add.mjs --confirm 301`");
        expect(ownerSummary([])).toBe("No new questions are waiting for confirmation.");
    });
});

describe("the command line on files", () => {
    let dir = "";

    afterEach(() => {
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
            dir = "";
        }
    });

    function files(pending: Entry[], questions = catalogue()) {
        dir = mkdtempSync(path.join(tmpdir(), "catalogue-add-"));
        const questionPath = path.join(dir, "question.json");
        const pendingPath = path.join(dir, "pending-questions.json");
        const statesPath = path.join(dir, "states.json");
        const cataloguePath = path.join(dir, "bamf-catalogue.json");
        writeFileSync(questionPath, JSON.stringify(questions, null, 2));
        writeFileSync(pendingPath, serialisePending(pending));
        writeFileSync(statesPath, JSON.stringify(STATE_CODES.map((code) => ({ code, name: code }))));
        writeFileSync(cataloguePath, JSON.stringify({ questions: [{ num: "9", part: "general", page: 3, question: "Offizielle Frage neun?", answers: ["eins", "zwei", "drei", "vier"] }] }));
        return { questionPath, pendingPath, statesPath, cataloguePath };
    }

    const command = (overrides: Record<string, unknown>) => ({ check: false, template: [], confirm: null, solutions: {}, remove: [], dryRun: false, ...overrides });

    it("--check passes an empty and a valid pending file and fails an invalid one", async () => {
        const paths = files([]);
        await expect(run(command({ check: true }), paths)).resolves.toMatchObject({ invalid: 0 });
        writeFileSync(paths.pendingPath, serialisePending([pendingEntry()]));
        await expect(run(command({ check: true }), paths)).resolves.toMatchObject({ invalid: 0 });
        writeFileSync(paths.pendingPath, serialisePending([pendingEntry({ solution: "b" })]));
        await expect(run(command({ check: true }), paths)).rejects.toThrow(/1 pending entry is invalid/);
    });

    it("--confirm moves the entry into question.json byte for byte like apply.mjs and empties the pending file", async () => {
        const paths = files([pendingEntry()]);
        await run(command({ confirm: ["301"] }), paths);
        const written = readFileSync(paths.questionPath, "utf8");
        const questions = JSON.parse(written);
        expect(questions).toHaveLength(331);
        expect(written).toBe(JSON.stringify(questions, null, 2));
        expect(questions[300]).toEqual(toQuestion(pendingEntry()));
        expect(readFileSync(paths.pendingPath, "utf8")).toBe("[]\n");
    });

    it("--confirm --dry-run and a refused correction write nothing", async () => {
        const paths = files([pendingEntry()]);
        const before = readFileSync(paths.questionPath, "utf8");
        await run(command({ confirm: "all", dryRun: true }), paths);
        expect(readFileSync(paths.questionPath, "utf8")).toBe(before);
        await expect(run(command({ confirm: ["301"], solutions: { "301": "b" } }), paths)).rejects.toThrow(/context does not name the correct answer/);
        expect(readFileSync(paths.questionPath, "utf8")).toBe(before);
        expect(JSON.parse(readFileSync(paths.pendingPath, "utf8"))).toHaveLength(1);
    });

    it("--remove drops a pending entry and --template adds a skeleton", async () => {
        const paths = files([pendingEntry()]);
        await run(command({ remove: ["301"] }), paths);
        expect(readFileSync(paths.pendingPath, "utf8")).toBe("[]\n");
        await expect(run(command({ remove: ["301"] }), paths)).rejects.toThrow(/no pending entry has the number 301/);
        await run(command({ template: ["9"] }), paths);
        const pending = JSON.parse(readFileSync(paths.pendingPath, "utf8"));
        expect(pending).toHaveLength(1);
        expect(pending[0]).toMatchObject({ num: "301", officialNum: "9", question: "Offizielle Frage neun?", a: "eins", solution: "", confirmed: false });
        await expect(run(command({ template: ["9"] }), paths)).rejects.toThrow(/already pending/);
        await expect(run(command({ template: ["10"] }), paths)).rejects.toThrow(/official question 10 is not in/);
    });
});
