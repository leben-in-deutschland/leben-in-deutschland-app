// Renders the framed store screenshots and the feature graphic from the raw
// captures in src/store/output/raw (see capture.mjs).
//
//   node src/store/compose/render.mjs            # every set
//   node src/store/compose/render.mjs --lang de --set play-phone --shot home
//
// Output: src/store/output/<set>/<lang>/NN_<shot>.png plus
// src/store/output/play-feature/<lang>/featureGraphic.png and the untouched
// 512 px icon as src/store/output/play-icon/icon.png.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "../lib/browser.mjs";
import { startServer } from "../lib/server.mjs";
import { CAPTIONS, featureGraphicHtml, slideHtml } from "./templates.mjs";
import { DEVICES, LANGUAGES, SHOTS } from "../capture.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const storeRoot = path.resolve(here, "..");
const webRoot = path.resolve(storeRoot, "../web");
const outDir = path.join(webRoot, "out");
const outputRoot = path.join(storeRoot, "output");
const sharp = createRequire(path.join(webRoot, "package.json"))("sharp");

/** Output sets: canvas size in pixels and the raw capture device they frame. */
export const SETS = {
    "play-phone": { width: 1080, height: 1920, device: "phone", note: "Google Play phone (9:16)" },
    "play-tablet": { width: 1440, height: 2560, device: "tablet", note: "Google Play 7-inch and 10-inch tablet (9:16)" },
    // App Store Connect names the slots by display class now; the medium Dynamic Island display is the required one.
    "ios-iphone-6.3": { width: 1206, height: 2622, device: "phone", note: "App Store iPhone with Dynamic Island (medium display), required" },
    "ios-iphone-6.9": { width: 1320, height: 2868, device: "phone", note: "App Store iPhone with Dynamic Island (large display)" },
    "ios-iphone-6.5": { width: 1284, height: 2778, device: "phone", note: "App Store iPhone with Face ID (large display)" },
    "ios-ipad-13": { width: 2064, height: 2752, device: "tablet", note: "App Store iPad 13-inch display, required" },
};

const BASE_WIDTH = 1080;

function parseArgs(argv) {
    const args = { lang: null, set: null, shot: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--")) {
            args[argv[i].slice(2)] = argv[++i];
        }
    }
    return args;
}

/** The @font-face rules of the exported build, so slides use the app's own fonts. */
function loadFontCss() {
    const cssDir = path.join(outDir, "_next/static/css");
    const rules = [];
    for (const file of readdirSync(cssDir)) {
        const css = readFileSync(path.join(cssDir, file), "utf8");
        rules.push(...(css.match(/@font-face\{[^}]*\}/g) ?? []));
    }
    if (rules.length === 0) {
        throw new Error("no @font-face rules found in src/web/out - run the build first");
    }
    return rules.join("\n");
}

/** Average colour of the top rows of a capture, used for the fake status bar. */
async function topColor(file) {
    const image = sharp(file);
    const { width } = await image.metadata();
    const { channels } = await image.extract({ left: 0, top: 0, width, height: 6 }).stats();
    const [r, g, b] = channels.map((channel) => Math.round(channel.mean));
    return `rgb(${r}, ${g}, ${b})`;
}

async function renderHtml(page, dir, name, html, width, height) {
    const file = path.join(dir, `${name}.html`);
    writeFileSync(file, html);
    await page.setDevice({ width, height, scale: 1, mobile: false });
    await page.navigate(`${page.baseUrl}/__store/output/tmp/${name}.html`);
    await page.evaluate(`Promise.all([document.fonts.ready, ...[...document.images].map((img) => img.decode().catch(() => undefined))])`);
    await page.settle(200);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
    return sharp(png).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
}

export async function renderAll({ lang, set, shot } = {}) {
    const fontCss = loadFontCss();
    const tmpDir = path.join(outputRoot, "tmp");
    mkdirSync(tmpDir, { recursive: true });
    const server = await startServer({ "/": outDir, "/__store/": storeRoot });
    const browser = await launchBrowser();
    const written = [];
    try {
        const page = await browser.newPage();
        page.baseUrl = server.url;
        for (const language of LANGUAGES.filter((item) => !lang || item === lang)) {
            for (const [setId, spec] of Object.entries(SETS).filter(([id]) => !set || id === set)) {
                const metrics = DEVICES[spec.device];
                const scale = spec.width / BASE_WIDTH;
                const baseHeight = Math.round(spec.height / scale);
                const targetDir = path.join(outputRoot, setId, language);
                mkdirSync(targetDir, { recursive: true });
                let index = 0;
                for (const item of SHOTS.filter((entry) => !shot || entry.id === shot)) {
                    index += 1;
                    const raw = path.join(outputRoot, "raw", language, spec.device, `${item.id}.png`);
                    if (!existsSync(raw)) {
                        throw new Error(`missing capture ${path.relative(storeRoot, raw)} - run capture.mjs first`);
                    }
                    const [title, subtitle] = CAPTIONS[language][item.id];
                    const html = slideHtml({
                        width: BASE_WIDTH,
                        height: baseHeight,
                        scale,
                        device: spec.device,
                        image: `/__store/output/raw/${language}/${spec.device}/${item.id}.png`,
                        imageSize: [metrics.width, metrics.height],
                        statusColor: await topColor(raw),
                        title,
                        subtitle,
                        fontCss,
                    });
                    const name = `${setId}-${language}-${item.id}`;
                    const png = await renderHtml(page, tmpDir, name, html, spec.width, spec.height);
                    const file = path.join(targetDir, `${String(index).padStart(2, "0")}_${item.id}.png`);
                    writeFileSync(file, png);
                    written.push(file);
                    console.log(`rendered ${path.relative(storeRoot, file)}`);
                }
            }
            if (!set || set === "play-feature") {
                const raw = path.join(outputRoot, "raw", language, "phone", "home.png");
                const html = featureGraphicHtml({
                    lang: language,
                    image: `/__store/output/raw/${language}/phone/home.png`,
                    imageSize: [DEVICES.phone.width, DEVICES.phone.height],
                    statusColor: await topColor(raw),
                    fontCss,
                });
                const dir = path.join(outputRoot, "play-feature", language);
                mkdirSync(dir, { recursive: true });
                const file = path.join(dir, "featureGraphic.png");
                writeFileSync(file, await renderHtml(page, tmpDir, `feature-${language}`, html, 1024, 500));
                written.push(file);
                console.log(`rendered ${path.relative(storeRoot, file)}`);
            }
        }
        if (!set || set === "play-icon") {
            // The icon is deliberately not redrawn: the owner keeps the existing one.
            const dir = path.join(outputRoot, "play-icon");
            mkdirSync(dir, { recursive: true });
            copyFileSync(path.join(webRoot, "public/android-chrome-512x512.png"), path.join(dir, "icon.png"));
            written.push(path.join(dir, "icon.png"));
            console.log("copied play-icon/icon.png (unchanged app icon)");
        }
    } finally {
        await browser.close();
        await server.close();
        rmSync(tmpDir, { recursive: true, force: true });
    }
    return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    renderAll(parseArgs(process.argv.slice(2))).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
