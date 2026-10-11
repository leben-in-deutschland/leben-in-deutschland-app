// Captures raw app screens for the store listing from the exported web build.
//
//   node src/store/capture.mjs                 # every language, device, and shot
//   node src/store/capture.mjs --lang de --device phone --shot home --explore
//
// Requires `src/web/out` (run `npm run build` in src/web first). Writes PNGs to
// src/store/output/raw/<lang>/<device>/<shot>.png. `--explore` also dumps the
// visible text of every page to help pick shots.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";
import { startServer } from "./lib/server.mjs";
import { buildStorageSeed } from "./lib/demo-user.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../web/out");
const rawDir = path.join(here, "output/raw");
const catalogue = JSON.parse(readFileSync(path.resolve(here, "../web/data/questions-core.json"), "utf8"));
const questions = Array.isArray(catalogue) ? catalogue : (catalogue.questions ?? Object.values(catalogue));

const ANDROID_UA =
    "Mozilla/5.0 (Linux; Android 14; SM-G780G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

/** Viewports in CSS pixels; `scale` is the device pixel ratio of the raw capture. */
export const DEVICES = {
    phone: { width: 412, height: 915, scale: 3, mobile: true },
    tablet: { width: 1032, height: 1376, scale: 2, mobile: true },
};

export const LANGUAGES = ["de", "en"];

/**
 * Shots in listing order. `steps` run after the page loaded; see `runStep`.
 * `translation` picks the translation language of the demo record for the shot.
 */
export const SHOTS = [
    { id: "home", path: "/dashboard.html" },
    {
        id: "practice",
        path: "/prepare.html?action=new",
        steps: [{ waitFor: "[data-answer-list] button" }, { answerCorrectly: true }, { wait: 700 }, { openPanel: "explanation" }, { wait: 600 }],
    },
    {
        id: "translation",
        path: "/prepare.html?action=new",
        translation: { de: "en", en: "tr" },
        steps: [
            { waitFor: "[data-answer-list] button" },
            { clickText: { de: "Überspringen", en: "Skip" } },
            { wait: 700 },
            { openPanel: "translation" },
            { wait: 600 },
        ],
    },
    {
        id: "mock",
        path: "/mock.html",
        steps: [
            { clickText: { de: "Prüfung starten", en: "Start exam" } },
            { waitFor: "[aria-labelledby='exam-question'] button" },
            { shiftTime: 11 * 60 * 1000 + 17 * 1000 },
            { answerAndNext: 4 },
            { click: "[aria-labelledby='exam-question'] button", index: 1 },
            { wait: 500 },
        ],
    },
    { id: "progress", path: "/progress.html" },
    { id: "streak", path: "/progress.html", steps: [{ scrollToHeading: { de: "Serie", en: "Streak" } }, { wait: 500 }] },
    { id: "modes", path: "/practice.html" },
    { id: "settings", path: "/settings.html" },
];

function parseArgs(argv) {
    const args = { lang: null, device: null, shot: null, explore: false, theme: "dark" };
    for (let i = 0; i < argv.length; i++) {
        const value = argv[i];
        if (value === "--explore") {
            args.explore = true;
        } else if (value.startsWith("--")) {
            args[value.slice(2)] = argv[++i];
        }
    }
    return args;
}

function initScript(seed) {
    return `(() => {
        try {
            localStorage.clear();
            const seed = ${JSON.stringify(seed)};
            for (const key in seed) localStorage.setItem(key, seed[key]);
        } catch (error) {}
        window.CapacitorCustomPlatform = { name: "android", plugins: {} };
    })();`;
}

/** Index of the correct answer of the question currently on screen. */
async function correctAnswerIndex(page) {
    const text = await page.evaluate(`(() => {
        const list = document.querySelector("[data-answer-list]");
        const heading = list && document.getElementById(list.getAttribute("aria-labelledby"));
        return heading ? heading.textContent.trim() : "";
    })()`);
    const match = questions.find((q) => text.includes(q.question.trim()) || q.question.trim().includes(text));
    if (!match) {
        throw new Error(`question not found in catalogue: ${text.slice(0, 80)}`);
    }
    return ["a", "b", "c", "d"].indexOf(match.solution);
}

async function runStep(page, step, lang) {
    if (step.wait) {
        await new Promise((resolve) => setTimeout(resolve, step.wait));
    }
    if (step.waitFor) {
        await page.waitFor(`document.querySelector(${JSON.stringify(step.waitFor)})`, { label: step.waitFor });
    }
    if (step.click) {
        await page.click(step.click, { index: step.index ?? 0 });
    }
    if (step.clickText) {
        const label = typeof step.clickText === "string" ? step.clickText : step.clickText[lang];
        const found = await page.evaluate(`(() => {
            const nodes = [...document.querySelectorAll("button, a")];
            const node = nodes.find((n) => n.textContent.trim() === ${JSON.stringify(label)});
            if (!node) return false;
            node.setAttribute("data-store-target", "");
            return true;
        })()`);
        if (!found) {
            throw new Error(`no button with text "${label}"`);
        }
        await page.click("[data-store-target]");
    }
    if (step.answerCorrectly) {
        const index = await correctAnswerIndex(page);
        await page.click("[data-answer-list] button", { index });
    }
    if (step.openPanel) {
        const label = step.openPanel === "explanation" ? { de: "Erklärung", en: "Explanation" } : { de: "Übersetzen", en: "Translate" };
        const found = await page.evaluate(`(() => {
            const nodes = [...document.querySelectorAll("button[aria-expanded]")];
            const node = nodes.find((n) => n.textContent.includes(${JSON.stringify(label[lang])}));
            if (!node) return "missing";
            if (node.getAttribute("aria-expanded") === "true") return "open";
            node.setAttribute("data-store-target", "");
            return "closed";
        })()`);
        if (found === "missing") {
            throw new Error(`no ${step.openPanel} panel`);
        }
        if (found === "closed") {
            await page.click("[data-store-target]");
        }
    }
    if (step.shiftTime) {
        // Moves the page clock forward so timers show a session in progress.
        await page.evaluate(`(() => {
            const RealDate = Date;
            const offset = ${step.shiftTime};
            class ShiftedDate extends RealDate {
                constructor(...args) {
                    if (args.length === 0) {
                        super(RealDate.now() + offset);
                    } else {
                        super(...args);
                    }
                }
                static now() {
                    return RealDate.now() + offset;
                }
            }
            window.Date = ShiftedDate;
        })()`);
    }
    if (step.answerAndNext) {
        for (let i = 0; i < step.answerAndNext; i++) {
            await page.click("[aria-labelledby='exam-question'] button", { index: i % 4 });
            await new Promise((resolve) => setTimeout(resolve, 250));
            await runStep(page, { clickText: { de: "Weiter", en: "Next" } }, lang);
            await new Promise((resolve) => setTimeout(resolve, 450));
        }
    }
    if (step.scrollToHeading) {
        const label = step.scrollToHeading[lang];
        const found = await page.evaluate(`(() => {
            const heading = [...document.querySelectorAll("h1, h2, h3")].find((n) => n.textContent.trim() === ${JSON.stringify(label)});
            if (!heading) return false;
            const card = heading.closest("section, article, [data-surface]") ?? heading;
            const top = card.getBoundingClientRect().top + window.scrollY - 76;
            window.scrollTo({ top, behavior: "instant" });
            return true;
        })()`);
        if (!found) {
            throw new Error(`no heading "${label}"`);
        }
    }
    if (step.scrollTo) {
        await page.evaluate(`(() => { const n = document.querySelector(${JSON.stringify(step.scrollTo)}); if (n) n.scrollIntoView({ block: "start" }); })()`);
    }
    if (step.scrollBy) {
        await page.evaluate(`window.scrollBy(0, ${step.scrollBy})`);
    }
}

export async function captureAll({ lang, device, shot, explore, theme } = {}) {
    if (!existsSync(path.join(outDir, "dashboard.html"))) {
        throw new Error(`missing ${outDir}/dashboard.html - run "npm run build" in src/web first`);
    }
    const server = await startServer({ "/": outDir });
    const browser = await launchBrowser();
    const results = [];
    try {
        const page = await browser.newPage();
        for (const language of LANGUAGES.filter((item) => !lang || item === lang)) {
            for (const [deviceId, metrics] of Object.entries(DEVICES).filter(([id]) => !device || id === device)) {
                await page.setDevice({ ...metrics, userAgent: ANDROID_UA });
                await page.setColorScheme(theme === "light" ? "light" : "dark");
                for (const item of SHOTS.filter((entry) => !shot || entry.id === shot)) {
                    const seed = buildStorageSeed({ language, theme, translationLanguage: item.translation?.[language] });
                    await page.setInitScript(initScript(seed));
                    await page.navigate(`${server.url}${item.path}`);
                    await page.settle(900);
                    for (const step of item.steps ?? []) {
                        await runStep(page, step, language);
                    }
                    await page.settle(500);
                    const dir = path.join(rawDir, language, deviceId);
                    mkdirSync(dir, { recursive: true });
                    const file = path.join(dir, `${item.id}.png`);
                    writeFileSync(file, await page.screenshot());
                    results.push(file);
                    console.log(`captured ${path.relative(here, file)}`);
                    if (explore) {
                        const text = await page.evaluate(`document.body.innerText`);
                        writeFileSync(file.replace(/\.png$/, ".txt"), text);
                    }
                }
            }
        }
    } finally {
        await browser.close();
        await server.close();
    }
    return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    captureAll(parseArgs(process.argv.slice(2))).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
