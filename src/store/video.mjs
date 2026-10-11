// Builds the silent promo videos from the same captures and templates as the
// store screenshots: an intro card, one scene per screenshot with a gentle
// zoom, cross-fades, and an outro card.
//
//   node src/store/video.mjs                 # de + en, landscape + portrait
//   node src/store/video.mjs --lang de --orientation landscape
//
// Output: src/store/output/video/promo-<lang>-<orientation>.mp4 (H.264, 30 fps,
// about 30 seconds, no audio). Needs ffmpeg on the PATH or at FFMPEG.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";
import { startServer } from "./lib/server.mjs";
import { CAPTIONS, slideHtml, videoCardHtml, videoLandscapeHtml } from "./compose/templates.mjs";
import { DEVICES, LANGUAGES, SHOTS } from "./capture.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../web");
const outDir = path.join(webRoot, "out");
const outputRoot = path.join(here, "output");
const sharp = createRequire(path.join(webRoot, "package.json"))("sharp");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";

export const ORIENTATIONS = {
    landscape: { width: 1920, height: 1080 },
    portrait: { width: 1080, height: 1920 },
};

const FPS = 30;
const FADE = 0.6;
const INTRO_SECONDS = 3;
const SCENE_SECONDS = 3.5;
const OUTRO_SECONDS = 3.5;

function parseArgs(argv) {
    const args = { lang: null, orientation: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--")) {
            args[argv[i].slice(2)] = argv[++i];
        }
    }
    return args;
}

function loadFontCss() {
    const cssDir = path.join(outDir, "_next/static/css");
    const rules = [];
    for (const file of readdirSync(cssDir)) {
        rules.push(...(readFileSync(path.join(cssDir, file), "utf8").match(/@font-face\{[^}]*\}/g) ?? []));
    }
    if (rules.length === 0) {
        throw new Error("no @font-face rules found in src/web/out - run the build first");
    }
    return rules.join("\n");
}

async function topColor(file) {
    const image = sharp(file);
    const { width } = await image.metadata();
    const { channels } = await image.extract({ left: 0, top: 0, width, height: 6 }).stats();
    return `rgb(${channels.map((channel) => Math.round(channel.mean)).join(", ")})`;
}

async function renderFrame(page, tmpDir, name, html, width, height) {
    writeFileSync(path.join(tmpDir, `${name}.html`), html);
    await page.setDevice({ width, height, scale: 1, mobile: false });
    await page.navigate(`${page.baseUrl}/__store/output/tmp/${name}.html`);
    await page.evaluate(`Promise.all([document.fonts.ready, ...[...document.images].map((img) => img.decode().catch(() => undefined))])`);
    await page.settle(200);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
    return sharp(png).removeAlpha().png().toBuffer();
}

/** Renders intro, scenes, and outro as stills; returns them with their durations. */
async function renderFrames(page, tmpDir, framesDir, lang, orientation, fontCss) {
    const { width, height } = ORIENTATIONS[orientation];
    const frames = [];
    const push = async (name, html, seconds) => {
        const file = path.join(framesDir, `${String(frames.length).padStart(2, "0")}_${name}.png`);
        writeFileSync(file, await renderFrame(page, tmpDir, `${lang}-${orientation}-${name}`, html, width, height));
        frames.push({ file, seconds });
    };

    await push("intro", videoCardHtml({ lang, width, height, kind: "intro", fontCss }), INTRO_SECONDS);
    for (const shot of SHOTS) {
        const raw = path.join(outputRoot, "raw", lang, "phone", `${shot.id}.png`);
        if (!existsSync(raw)) {
            throw new Error(`missing capture ${path.relative(here, raw)} - run capture.mjs first`);
        }
        const [title, subtitle] = CAPTIONS[lang][shot.id];
        const common = {
            image: `/__store/output/raw/${lang}/phone/${shot.id}.png`,
            imageSize: [DEVICES.phone.width, DEVICES.phone.height],
            statusColor: await topColor(raw),
            title,
            subtitle,
            fontCss,
        };
        const html = orientation === "landscape"
            ? videoLandscapeHtml(common)
            : slideHtml({ ...common, width, height, scale: 1, device: "phone" });
        await push(shot.id, html, SCENE_SECONDS);
    }
    await push("outro", videoCardHtml({ lang, width, height, kind: "outro", fontCss }), OUTRO_SECONDS);
    return frames;
}

/** Assembles stills into one video: slow alternating zoom per scene, cross-fades, fade in and out. */
function assemble(frames, { width, height }, target) {
    const args = ["-y", "-hide_banner", "-loglevel", "error"];
    const filters = [];
    for (const [index, frame] of frames.entries()) {
        args.push("-i", frame.file);
        const count = Math.round(frame.seconds * FPS);
        const isCard = index === 0 || index === frames.length - 1;
        // Cards stay still; scenes alternate between a slow zoom in and zoom out.
        const zoom = isCard ? "1" : index % 2 === 1 ? `1+0.06*on/${count}` : `1.06-0.06*on/${count}`;
        filters.push(
            `[${index}:v]scale=${width * 1.5}:${height * 1.5}:flags=lanczos,` +
            `zoompan=z='${zoom}':d=${count}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${FPS},` +
            `format=yuv420p,setsar=1[v${index}]`,
        );
    }
    let previous = "v0";
    let elapsed = frames[0].seconds;
    for (let index = 1; index < frames.length; index++) {
        const offset = (elapsed - FADE).toFixed(3);
        const label = index === frames.length - 1 ? "joined" : `x${index}`;
        filters.push(`[${previous}][v${index}]xfade=transition=fade:duration=${FADE}:offset=${offset}[${label}]`);
        previous = label;
        elapsed += frames[index].seconds - FADE;
    }
    filters.push(`[joined]fade=t=in:st=0:d=${FADE},fade=t=out:st=${(elapsed - FADE).toFixed(3)}:d=${FADE}[out]`);
    args.push(
        "-filter_complex", filters.join(";"),
        "-map", "[out]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.1",
        "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", "-an",
        target,
    );
    execFileSync(ffmpeg, args, { stdio: ["ignore", "inherit", "inherit"] });
    return elapsed;
}

export async function buildVideos({ lang, orientation } = {}) {
    const fontCss = loadFontCss();
    const tmpDir = path.join(outputRoot, "tmp");
    const videoDir = path.join(outputRoot, "video");
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(videoDir, { recursive: true });
    const server = await startServer({ "/": outDir, "/__store/": here });
    const browser = await launchBrowser();
    const written = [];
    try {
        const page = await browser.newPage();
        page.baseUrl = server.url;
        for (const language of LANGUAGES.filter((item) => !lang || item === lang)) {
            for (const [name, size] of Object.entries(ORIENTATIONS).filter(([id]) => !orientation || id === orientation)) {
                const framesDir = path.join(videoDir, "frames", language, name);
                rmSync(framesDir, { recursive: true, force: true });
                mkdirSync(framesDir, { recursive: true });
                const frames = await renderFrames(page, tmpDir, framesDir, language, name, fontCss);
                const target = path.join(videoDir, `promo-${language}-${name}.mp4`);
                const seconds = assemble(frames, size, target);
                written.push(target);
                console.log(`built ${path.relative(here, target)} (${seconds.toFixed(1)} s)`);
            }
        }
    } finally {
        await browser.close();
        await server.close();
        rmSync(tmpDir, { recursive: true, force: true });
    }
    return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    buildVideos(parseArgs(process.argv.slice(2))).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
