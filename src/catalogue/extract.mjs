// Extracts every question of the BAMF Gesamtfragenkatalog PDF: 300 general
// questions (Teil I) and 16 x 10 state questions (Teil II), each with its
// four answers and, for picture questions, the images painted on the page.
//
//   node src/catalogue/extract.mjs                 # reads output/gesamtfragenkatalog.pdf (from check.mjs)
//   node src/catalogue/extract.mjs --pdf <path>    # another copy of the catalogue
//
// Writes data/bamf-catalogue.json (committed), output/images/<num>-<n>.png,
// and output/gesamtfragenkatalog.txt (the text as read, for debugging). The
// PDF has no answer key, so no solutions are produced. Exits 1 when the
// validation fails; the JSON is still written so the problem can be
// inspected.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { outputRoot, pdfPath as defaultPdfPath, PDF_URL, readState, relative, repoRoot } from "./check.mjs";
import { openPdf, readImages, readInfo, readLines } from "./lib/pdf.mjs";
import { encodePng } from "./lib/png.mjs";
import { cleanText, isAnswerLine, stripCheckbox } from "./lib/text.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const cataloguePath = path.join(here, "data/bamf-catalogue.json");
export const imagesDir = path.join(outputRoot, "images");
export const textDumpPath = path.join(outputRoot, "gesamtfragenkatalog.txt");

export const GENERAL_COUNT = 300;
export const STATE_COUNT = 16;
export const PER_STATE = 10;

const FOOTER = /^Seite \d+ von \d+$/;
const HEADING = /^Aufgabe (\d+)$/;
const STATE_HEADING = /^Fragen für das Bundesland (.+)$/;
const PICTURE_CAPTIONS = /^Bild 1 Bild 2 Bild 3 Bild 4$/;
const CREDIT = /^©/;
const PICTURE_ANSWERS = ["Bild 1", "Bild 2", "Bild 3", "Bild 4"];

/** Name -> code of the sixteen states, from the app's states.json. */
export function readStateCodes() {
    const states = JSON.parse(readFileSync(path.join(repoRoot, "src/web/data/states.json"), "utf8"));
    return new Map(states.map((state) => [state.name, state.code]));
}

function parseArgs(argv) {
    const options = { pdf: defaultPdfPath };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--pdf" && argv[i + 1]) {
            options.pdf = path.resolve(argv[++i]);
        } else {
            throw new Error(`unknown argument ${argv[i]}`);
        }
    }
    return options;
}

/** The repeated BAMF logo: painted into the top-left corner of every page. */
function isHeaderImage(image, view) {
    return image.top > view[3] - 20 && image.x < 20;
}

function isPictureQuestion(question) {
    return question.answers.length === PICTURE_ANSWERS.length && question.answers.every((answer, index) => answer === PICTURE_ANSWERS[index]);
}

/**
 * Walks the pages and returns `{ questions, pagesWithoutHeader, text }`.
 * Each question is `{ num, part, state, stateCode, page, question, answers,
 * images: [{ pxWidth, pxHeight, kind, data }], credit }`; the images are
 * assigned to the "Aufgabe" heading above them on the same page.
 */
export async function parseCatalogue(doc, pdfjs, stateCodes) {
    const questions = [];
    const pagesWithoutHeader = [];
    let text = "";
    let part = null;
    let state = null;
    let current = null;

    const finish = () => {
        if (current) {
            questions.push(current);
            current = null;
        }
    };

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        const lines = (await readLines(page)).filter((line) => !FOOTER.test(line.text));
        const headings = [];
        text += `===== Seite ${pageNumber} =====\n`;
        for (const line of lines) {
            text += `${line.text.replace(/^[\uf0a3\u25a1]/u, "[ ]")}\n`;
            const heading = HEADING.exec(line.text);
            if (heading) {
                finish();
                if (!part) {
                    throw new Error(`page ${pageNumber}: "Aufgabe ${heading[1]}" before "Teil I"`);
                }
                const index = Number(heading[1]);
                current = {
                    num: part === "general" ? String(index) : `${state.code}-${index}`,
                    part,
                    ...(part === "state" ? { state: state.name, stateCode: state.code } : {}),
                    page: pageNumber,
                    question: "",
                    answers: [],
                    images: [],
                    credit: null,
                    stemLines: [],
                };
                headings.push({ y: line.y, question: current });
                continue;
            }
            if (line.text === "Teil I") {
                finish();
                part = "general";
                continue;
            }
            if (line.text === "Teil II") {
                finish();
                part = "state";
                continue;
            }
            if (line.text === "Allgemeine Fragen" && part === "general" && !current) {
                continue;
            }
            const stateHeading = STATE_HEADING.exec(line.text);
            if (stateHeading && part === "state" && !current) {
                const name = cleanText(stateHeading[1]);
                const code = stateCodes.get(name);
                if (!code) {
                    throw new Error(`page ${pageNumber}: unknown state "${name}" (not in src/web/data/states.json)`);
                }
                state = { name, code };
                continue;
            }
            if (!current) {
                // Title page and section covers.
                continue;
            }
            if (isAnswerLine(line.text)) {
                current.answers.push(stripCheckbox(line.text));
            } else if (CREDIT.test(line.text)) {
                current.credit = cleanText(line.text);
            } else if (PICTURE_CAPTIONS.test(line.text)) {
                continue;
            } else if (current.answers.length === 0) {
                current.stemLines.push({ y: line.y, text: line.text });
            } else {
                current.answers[current.answers.length - 1] += ` ${line.text}`;
            }
        }

        const images = await readImages(page, pdfjs);
        const header = images.filter((image) => isHeaderImage(image, page.view));
        if (header.length !== 1) {
            pagesWithoutHeader.push(pageNumber);
        }
        const content = images.filter((image) => !header.includes(image)).sort((a, b) => b.top - a.top || a.x - b.x);
        for (const image of content) {
            const above = headings.filter((heading) => heading.y > image.top).pop();
            const owner = above?.question ?? current;
            if (!owner) {
                throw new Error(`page ${pageNumber}: an image (${image.pxWidth}x${image.pxHeight}) belongs to no question`);
            }
            owner.images.push({ x: image.x, top: image.top, pxWidth: image.pxWidth, pxHeight: image.pxHeight, kind: image.kind, data: image.data });
        }
        for (const { question } of headings) {
            // A text line under a picture is a caption or source note, not part of the question.
            const top = Math.max(...question.images.map((image) => image.top), -Infinity);
            const captions = question.stemLines.filter((line) => line.y < top);
            if (captions.length > 0) {
                question.stemLines = question.stemLines.filter((line) => line.y >= top);
                question.credit = cleanText([question.credit, ...captions.map((line) => line.text)].filter(Boolean).join(" "));
            }
        }
        page.cleanup();
    }
    finish();
    for (const question of questions) {
        question.question = cleanText(question.stemLines.map((line) => line.text).join(" "));
        question.answers = question.answers.map(cleanText);
        delete question.stemLines;
        // Pictures of one question are read left to right (Bild 1 .. Bild 4).
        question.images.sort((a, b) => a.x - b.x);
    }
    return { questions, pagesWithoutHeader, text };
}

/** Structural checks; returns the list of problems (empty when the catalogue is complete). */
export function validate(questions, stateCodes) {
    const problems = [];
    const general = questions.filter((question) => question.part === "general");
    const states = questions.filter((question) => question.part === "state");
    if (general.length !== GENERAL_COUNT) {
        problems.push(`${general.length} general questions, expected ${GENERAL_COUNT}`);
    }
    if (states.length !== STATE_COUNT * PER_STATE) {
        problems.push(`${states.length} state questions, expected ${STATE_COUNT * PER_STATE}`);
    }
    general.forEach((question, index) => {
        if (question.num !== String(index + 1)) {
            problems.push(`general numbering breaks at Aufgabe ${question.num} (position ${index + 1})`);
        }
    });
    const perState = new Map();
    for (const question of states) {
        perState.set(question.stateCode, [...(perState.get(question.stateCode) ?? []), question]);
    }
    if (perState.size !== STATE_COUNT) {
        problems.push(`${perState.size} states found, expected ${STATE_COUNT}`);
    }
    for (const code of stateCodes.values()) {
        const list = perState.get(code) ?? [];
        if (list.length !== PER_STATE) {
            problems.push(`${code}: ${list.length} questions, expected ${PER_STATE}`);
        }
        list.forEach((question, index) => {
            if (question.num !== `${code}-${index + 1}`) {
                problems.push(`${code}: numbering breaks at ${question.num} (position ${index + 1})`);
            }
        });
    }
    for (const question of questions) {
        const label = `Aufgabe ${question.num} (page ${question.page})`;
        if (!question.question) {
            problems.push(`${label}: empty question text`);
        }
        if (question.answers.length !== 4) {
            problems.push(`${label}: ${question.answers.length} answers, expected 4`);
        }
        if (question.answers.some((answer) => !answer)) {
            problems.push(`${label}: empty answer`);
        }
        if (/Bild 1 Bild 2/.test(question.question)) {
            problems.push(`${label}: picture captions ended up in the question text`);
        }
        const images = question.images?.length ?? 0;
        const expectedImages = isPictureQuestion(question) ? 4 : images > 0 ? 1 : 0;
        if (images !== expectedImages) {
            problems.push(`${label}: ${images} images, expected ${expectedImages}`);
        }
    }
    return problems;
}

function sha256(buffer) {
    return createHash("sha256").update(buffer).digest("hex");
}

function previousExtractedAt(catalogue) {
    if (!existsSync(cataloguePath)) {
        return null;
    }
    try {
        const previous = JSON.parse(readFileSync(cataloguePath, "utf8"));
        const same = previous.source?.sha256 === catalogue.source.sha256 && JSON.stringify(previous.questions) === JSON.stringify(catalogue.questions);
        return same ? previous.source.extractedAt ?? null : null;
    } catch {
        return null;
    }
}

export async function run({ pdf = defaultPdfPath } = {}) {
    if (!existsSync(pdf)) {
        throw new Error(`${relative(pdf)} is missing - run node src/catalogue/check.mjs first`);
    }
    const buffer = readFileSync(pdf);
    const digest = sha256(buffer);
    const state = readState();
    const fromState = state?.sha256 === digest ? state : null;
    const stateCodes = readStateCodes();

    const { pdfjs, doc, close } = await openPdf(buffer);
    let parsed;
    let info;
    try {
        info = await readInfo(doc);
        console.log(`reading ${relative(pdf)} (${info.pages} pages, Stand ${info.stand ?? "unknown"})`);
        parsed = await parseCatalogue(doc, pdfjs, stateCodes);
    } finally {
        await close();
    }
    const { questions, pagesWithoutHeader, text } = parsed;

    rmSync(imagesDir, { recursive: true, force: true });
    mkdirSync(imagesDir, { recursive: true });
    let imageCount = 0;
    for (const question of questions) {
        const files = question.images.map((image, index) => {
            const file = `images/${question.num}-${index + 1}.png`;
            writeFileSync(path.join(outputRoot, file), encodePng({ width: image.pxWidth, height: image.pxHeight, kind: image.kind, data: image.data }));
            imageCount++;
            return file;
        });
        if (files.length > 0) {
            question.images = files;
        } else {
            delete question.images;
            delete question.credit;
        }
    }
    writeFileSync(textDumpPath, text);

    const withImages = questions.filter((question) => question.images);
    const catalogue = {
        source: {
            pdfUrl: fromState?.pdfUrl ?? PDF_URL,
            stand: info.stand,
            lastModified: fromState?.lastModified ?? null,
            etag: fromState?.etag ?? null,
            sha256: digest,
            pages: info.pages,
            extractedAt: null,
        },
        counts: {
            general: questions.filter((question) => question.part === "general").length,
            state: questions.filter((question) => question.part === "state").length,
            withImages: withImages.length,
        },
        questions,
    };
    catalogue.source.extractedAt = previousExtractedAt(catalogue) ?? new Date().toISOString();
    mkdirSync(path.dirname(cataloguePath), { recursive: true });
    writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);

    const generalPages = questions.filter((question) => question.part === "general").map((question) => question.page);
    const statePages = questions.filter((question) => question.part === "state").map((question) => question.page);
    const range = (pages) => (pages.length ? `pages ${Math.min(...pages)}-${Math.max(...pages)}` : "no pages");
    const four = withImages.filter((question) => question.images.length === 4).length;
    console.log(`  general questions   ${catalogue.counts.general} (${range(generalPages)})`);
    console.log(`  state questions     ${catalogue.counts.state} (${new Set(statePages.map((page) => questions.find((q) => q.page === page).stateCode)).size} states, ${range(statePages)})`);
    console.log(`  image questions     ${withImages.length} (${four} with four pictures, ${withImages.length - four} with one)`);
    console.log(`  images written      ${imageCount} -> ${relative(imagesDir)}`);
    console.log(`  header logo         skipped on ${info.pages - pagesWithoutHeader.length} of ${info.pages} pages${pagesWithoutHeader.length ? ` (none found on ${pagesWithoutHeader.join(", ")})` : ""}`);
    console.log(`  text dump           ${relative(textDumpPath)}`);
    console.log(`  catalogue           ${relative(cataloguePath)}`);

    const problems = validate(questions, stateCodes);
    if (problems.length > 0) {
        console.log(`\n${problems.length} problem(s):`);
        for (const problem of problems) {
            console.log(`  ✗ ${problem}`);
        }
        console.log(`the catalogue was written anyway so the problems can be inspected in ${relative(cataloguePath)}`);
        return { catalogue, problems };
    }
    console.log(`\nAll checks passed: ${questions.length} questions (${GENERAL_COUNT} general + ${STATE_COUNT * PER_STATE} state), 4 answers each.`);
    return { catalogue, problems };
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
