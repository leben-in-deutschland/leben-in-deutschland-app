// Validates the generated store assets against the Google Play and App Store
// size rules before anything is uploaded.
//
//   node src/store/check.mjs
//
// Exits non-zero when a set is missing, has the wrong size, keeps an alpha
// channel, or when the app icon differs from the committed one.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SETS } from "./compose/render.mjs";
import { LANGUAGES, SHOTS } from "./capture.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../web");
const outputRoot = path.join(here, "output");
const sharp = createRequire(path.join(webRoot, "package.json"))("sharp");

const PLAY_MAX_BYTES = 8 * 1024 * 1024;
const problems = [];

function problem(message) {
    problems.push(message);
    console.log(`  ✗ ${message}`);
}

async function checkImage(file, { width, height, maxBytes = PLAY_MAX_BYTES }) {
    const relative = path.relative(here, file);
    if (!existsSync(file)) {
        problem(`${relative} is missing`);
        return;
    }
    const meta = await sharp(file).metadata();
    if (meta.width !== width || meta.height !== height) {
        problem(`${relative} is ${meta.width}x${meta.height}, expected ${width}x${height}`);
    }
    if (meta.hasAlpha) {
        problem(`${relative} has an alpha channel`);
    }
    if (meta.format !== "png") {
        problem(`${relative} is ${meta.format}, expected png`);
    }
    if (statSync(file).size > maxBytes) {
        problem(`${relative} is larger than ${maxBytes} bytes`);
    }
}

async function main() {
    for (const [setId, spec] of Object.entries(SETS)) {
        for (const lang of LANGUAGES) {
            const dir = path.join(outputRoot, setId, lang);
            console.log(`${setId}/${lang} (${spec.width}x${spec.height})`);
            const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".png")) : [];
            if (files.length !== SHOTS.length) {
                problem(`${setId}/${lang} has ${files.length} screenshots, expected ${SHOTS.length}`);
            }
            if (setId.startsWith("play-") && files.length > 8) {
                problem(`${setId}/${lang} exceeds the Play limit of 8 screenshots`);
            }
            if (setId.startsWith("ios-") && files.length > 10) {
                problem(`${setId}/${lang} exceeds the App Store limit of 10 screenshots`);
            }
            for (const [index, shot] of SHOTS.entries()) {
                await checkImage(path.join(dir, `${String(index + 1).padStart(2, "0")}_${shot.id}.png`), spec);
            }
        }
    }

    for (const lang of LANGUAGES) {
        console.log(`play-feature/${lang} (1024x500)`);
        await checkImage(path.join(outputRoot, "play-feature", lang, "featureGraphic.png"), { width: 1024, height: 500, maxBytes: 15 * 1024 * 1024 });
    }

    console.log("play-icon (512x512, unchanged)");
    const icon = path.join(outputRoot, "play-icon", "icon.png");
    const source = path.join(webRoot, "public/android-chrome-512x512.png");
    if (!existsSync(icon)) {
        problem("play-icon/icon.png is missing");
    } else {
        const meta = await sharp(icon).metadata();
        if (meta.width !== 512 || meta.height !== 512) {
            problem(`play-icon/icon.png is ${meta.width}x${meta.height}, expected 512x512`);
        }
        const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
        if (hash(icon) !== hash(source)) {
            problem("play-icon/icon.png differs from src/web/public/android-chrome-512x512.png");
        }
    }

    const videoDir = path.join(outputRoot, "video");
    if (existsSync(videoDir)) {
        const videos = readdirSync(videoDir).filter((name) => name.endsWith(".mp4"));
        console.log(`video (${videos.length} files)`);
        for (const name of videos) {
            const size = statSync(path.join(videoDir, name)).size;
            if (size === 0) {
                problem(`video/${name} is empty`);
            }
        }
    }

    if (problems.length > 0) {
        console.log(`\n${problems.length} problem(s) found`);
        process.exit(1);
    }
    console.log("\nAll store assets pass the size and format checks.");
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
