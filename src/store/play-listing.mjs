// Pushes the Google Play store listing through the Play Developer API: the
// texts from metadata/android/<language>/ and the rendered screenshots and
// feature graphic from output/ go into a draft edit, Google validates it, and
// --apply commits it (edits -> listings + images -> validate -> commit).
//
//   node src/store/play-listing.mjs                     # dry run: what would be sent; needs no credentials
//   node src/store/play-listing.mjs --validate          # upload into a draft edit, let Google validate it, discard it; nothing is published
//   node src/store/play-listing.mjs --apply             # upload, validate, commit (publishes the listing change)
//   node src/store/play-listing.mjs --apply --lang de --text-only
//
// Run `node src/store/check.mjs` first; this script checks presence and
// counts, not pixels. Unchanged texts and byte-identical image sets are
// skipped. The app icon is never uploaded (README "Rules"). A promo video is
// taken from an optional metadata/android/<language>/video.txt (YouTube URL);
// without the file the video already in the listing is kept.
// Credentials: PLAY_SERVICE_ACCOUNT_KEY as in lib/play-api.mjs.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, createPlayClient, explainError, fail, readPackageName, relative } from "./lib/play-api.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const metadataRoot = path.join(here, "metadata/android");
const outputRoot = path.join(here, "output");

// Listing language -> folder of the rendered sets.
const LANGUAGES = { "de-DE": "de", "en-US": "en" };
const TEXT_LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 };
const TEXT_FILES = { title: "title.txt", shortDescription: "short_description.txt", fullDescription: "full_description.txt" };
const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const IMAGE_SETS = [
    { imageType: "phoneScreenshots", set: "play-phone", max: 8 },
    { imageType: "sevenInchScreenshots", set: "play-tablet", max: 8 },
    { imageType: "tenInchScreenshots", set: "play-tablet", max: 8 },
    { imageType: "featureGraphic", set: "play-feature", max: 1, file: "featureGraphic.png" },
];

function parseArgs(argv) {
    const args = { mode: "dry-run", languages: [], textOnly: false, imagesOnly: false, help: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--apply") args.mode = "apply";
        else if (arg === "--validate") args.mode = "validate";
        else if (arg === "--dry-run") args.mode = "dry-run";
        else if (arg === "--text-only") args.textOnly = true;
        else if (arg === "--images-only") args.imagesOnly = true;
        else if (arg === "--help" || arg === "-h") args.help = true;
        else if (arg === "--lang") args.languages.push(resolveLanguage(argv[++i]));
        else fail(`unknown argument ${arg} (see --help)`);
    }
    if (args.textOnly && args.imagesOnly) {
        fail("--text-only and --images-only exclude each other");
    }
    if (args.languages.length === 0) {
        args.languages = Object.keys(LANGUAGES);
    }
    return args;
}

function resolveLanguage(value) {
    const match = Object.entries(LANGUAGES).find(([language, short]) => language === value || short === value);
    if (!match) {
        fail(`unknown language "${value}"; known: ${Object.keys(LANGUAGES).join(", ")}`);
    }
    return match[0];
}

function usage() {
    console.log(`Usage: node src/store/play-listing.mjs [--validate | --apply] [--lang de|en]... [--text-only | --images-only]

  (no flag)     dry run: show what would be sent, needs no credentials
  --validate    upload into a draft edit and let Google validate it, then discard the edit
  --apply       upload, validate and commit the edit (publishes the listing change)
  --lang        limit to one listing language (repeatable); default both
  --text-only   texts only; --images-only screenshots and feature graphic only

Environment: PLAY_SERVICE_ACCOUNT_KEY (path to the service-account JSON key),
PLAY_PACKAGE_NAME (optional override of the Capacitor appId).`);
}

function readText(dir, name, required) {
    const file = path.join(dir, name);
    if (!existsSync(file)) {
        if (required) {
            fail(`missing ${relative(file)}`);
        }
        return undefined;
    }
    return readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim();
}

function loadTexts(language) {
    const dir = path.join(metadataRoot, language);
    const texts = { language };
    for (const [field, name] of Object.entries(TEXT_FILES)) {
        texts[field] = readText(dir, name, true);
    }
    const video = readText(dir, "video.txt", false);
    if (video) {
        texts.video = video;
    }
    return texts;
}

function loadImages(language) {
    const short = LANGUAGES[language];
    return IMAGE_SETS.map((spec) => {
        const dir = path.join(outputRoot, spec.set, short);
        let files = [];
        if (spec.file) {
            files = existsSync(path.join(dir, spec.file)) ? [path.join(dir, spec.file)] : [];
        } else if (existsSync(dir)) {
            files = readdirSync(dir)
                .filter((name) => /\.(png|jpe?g)$/i.test(name))
                .sort()
                .map((name) => path.join(dir, name));
        }
        return { ...spec, dir, files };
    });
}

function validateLocal(texts, images, { textOnly, imagesOnly }) {
    const problems = [];
    if (!imagesOnly) {
        for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
            const length = [...(texts[field] ?? "")].length;
            if (length === 0 || length > limit) {
                problems.push(`${texts.language} ${field}: ${length} characters, allowed 1-${limit}`);
            }
        }
        if (texts.video && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(texts.video)) {
            problems.push(`${texts.language} video.txt must hold a YouTube URL`);
        }
    }
    if (!textOnly) {
        for (const spec of images) {
            if (spec.files.length === 0) {
                problems.push(`${texts.language} ${spec.imageType}: no files in ${relative(spec.dir)} - run capture.mjs and compose/render.mjs first`);
            }
            if (spec.files.length > spec.max) {
                problems.push(`${texts.language} ${spec.imageType}: ${spec.files.length} files, Play allows ${spec.max}`);
            }
            for (const file of spec.files) {
                if (statSync(file).size > UPLOAD_MAX_BYTES) {
                    problems.push(`${relative(file)} is larger than ${UPLOAD_MAX_BYTES} bytes`);
                }
            }
        }
    }
    return problems;
}

function sha256(file) {
    return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function contentType(file) {
    return /\.jpe?g$/i.test(file) ? "image/jpeg" : "image/png";
}

function sameImages(localHashes, remoteImages) {
    const remoteHashes = remoteImages.map((image) => (image.sha256 ?? "").toLowerCase());
    return localHashes.length === remoteHashes.length && localHashes.every((hash, index) => hash === remoteHashes[index]);
}

function describeTexts(texts) {
    const parts = Object.keys(TEXT_LIMITS).map((field) => `${field} ${[...texts[field]].length}/${TEXT_LIMITS[field]}`);
    parts.push(texts.video ? `video ${texts.video}` : "video kept as is");
    return parts.join(", ");
}

function dryRun(packageName, plan) {
    console.log(`dry run for ${packageName} - nothing is sent\n`);
    console.log(`POST ${API}/applications/${packageName}/edits`);
    for (const { language, texts, images } of plan) {
        console.log(`\n${language}`);
        if (texts) {
            console.log(`  PUT .../listings/${language}  (${describeTexts(texts)})`);
            console.log(`    title: ${texts.title}`);
            console.log(`    short: ${texts.shortDescription}`);
        }
        for (const spec of images) {
            console.log(`  DELETE + POST .../listings/${language}/${spec.imageType}  (${spec.files.length} file(s) from ${relative(spec.dir)}, skipped when Play already has the same bytes)`);
        }
    }
    console.log(`\nPOST .../edits/<id>:validate, then :commit with --apply or DELETE with --validate`);
}

async function pushListing(client, packageName, plan, mode) {
    const edit = await client.request("POST", `/applications/${packageName}/edits`, { body: {} });
    const editPath = `/applications/${packageName}/edits/${edit.id}`;
    console.log(`edit ${edit.id} opened`);
    let changes = 0;
    try {
        for (const { language, texts, images } of plan) {
            console.log(`\n${language}`);
            if (texts) {
                const current = await client.request("GET", `${editPath}/listings/${language}`).catch((error) => {
                    if (error.status === 404) {
                        return null;
                    }
                    throw error;
                });
                const next = { ...texts };
                if (!next.video && current?.video) {
                    next.video = current.video;
                }
                const changed = ["title", "shortDescription", "fullDescription", "video"].filter((field) => (current?.[field] ?? "") !== (next[field] ?? ""));
                if (changed.length === 0) {
                    console.log("  texts: unchanged");
                } else {
                    await client.request("PUT", `${editPath}/listings/${language}`, { body: next });
                    changes += 1;
                    console.log(`  texts: ${current ? "updated" : "created"} (${changed.join(", ")})`);
                }
            }
            for (const spec of images) {
                const localHashes = spec.files.map(sha256);
                const remote = await client.request("GET", `${editPath}/listings/${language}/${spec.imageType}`);
                const remoteImages = remote.images ?? [];
                if (sameImages(localHashes, remoteImages)) {
                    console.log(`  ${spec.imageType}: unchanged (${spec.files.length})`);
                    continue;
                }
                if (remoteImages.length > 0) {
                    await client.request("DELETE", `${editPath}/listings/${language}/${spec.imageType}`);
                }
                for (const file of spec.files) {
                    await client.upload(`${editPath}/listings/${language}/${spec.imageType}`, {
                        // Rendered from real app screens, so the images are declared as not AI-generated.
                        query: { aiGeneratedState: "aiGeneratedStateNotAiGenerated" },
                        contentType: contentType(file),
                        bytes: readFileSync(file),
                    });
                }
                changes += 1;
                console.log(`  ${spec.imageType}: replaced ${remoteImages.length} with ${spec.files.length}`);
            }
        }
        if (changes === 0) {
            await client.request("DELETE", editPath);
            console.log("\nnothing to change; edit discarded");
            return;
        }
        await client.request("POST", `${editPath}:validate`);
        console.log(`\n${changes} change(s) validated by Google`);
        if (mode !== "apply") {
            await client.request("DELETE", editPath);
            console.log("edit discarded (--validate); nothing was published");
            return;
        }
        try {
            await client.request("POST", `${editPath}:commit`);
            console.log("edit committed; the listing update is being published (Google may review it first)");
        } catch (error) {
            if (error.status !== 400 || !/review/i.test(error.message)) {
                throw error;
            }
            await client.request("POST", `${editPath}:commit`, { query: { changesNotSentForReview: "true" } });
            console.log("edit committed but not sent for review: open Play Console -> Publishing overview and send the changes for review");
        }
    } catch (error) {
        await client.request("DELETE", editPath).catch(() => {});
        throw error;
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }
    const packageName = readPackageName();
    const plan = [];
    const problems = [];
    for (const language of args.languages) {
        const texts = args.imagesOnly ? null : loadTexts(language);
        const images = args.textOnly ? [] : loadImages(language);
        problems.push(...validateLocal(texts ?? { language }, images, args));
        plan.push({ language, texts, images });
    }
    if (problems.length > 0) {
        for (const problem of problems) {
            console.error(`  ✗ ${problem}`);
        }
        fail(`${problems.length} problem(s) found before upload`);
    }
    if (args.mode === "dry-run") {
        dryRun(packageName, plan);
        return;
    }
    const client = await createPlayClient();
    await pushListing(client, packageName, plan, args.mode);
}

main().catch((error) => {
    explainError(error);
    process.exit(1);
});
