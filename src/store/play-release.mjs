// Uploads a signed Android App Bundle to a Google Play track through the Play
// Developer API (edits -> bundles.upload -> tracks.update -> commit). The
// Android release workflow calls it after the GitHub release so every main
// build reaches Internal testing by itself; promotion to production stays a
// click in the Play Console, like the manual release on the App Store.
//
//   node src/store/play-release.mjs --aab path/to/app.aab                       # dry run: inspects the bundle and prints the requests; needs no credentials
//   node src/store/play-release.mjs --aab path/to/app.aab --apply               # upload to the internal track
//   node src/store/play-release.mjs --aab path/to/app.aab --track production --apply --rollout 0.2
//
// Credentials (keyless, see lib/play-api.mjs): PLAY_SERVICE_ACCOUNT with your
// gcloud login or GitHub's Workload Identity Federation; the service account
// needs "Release to testing tracks" (internal) or "Release to production" in
// Play Console -> Users and permissions. Release notes come from
// metadata/android/<language>/whats_new.txt when present (500 characters).
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, createPlayClient, explainError, fail, readPackageName, relative } from "./lib/play-api.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const METADATA = path.join(here, "metadata/android");
const LANGUAGES = ["de-DE", "en-US"];
const TRACKS = new Set(["internal", "alpha", "beta", "production"]);
const NOTES_LIMIT = 500;

function parseArgs(argv) {
    const args = { aab: null, track: "internal", apply: false, rollout: null, help: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--aab") args.aab = argv[++i];
        else if (arg === "--track") args.track = argv[++i];
        else if (arg === "--rollout") args.rollout = Number(argv[++i]);
        else if (arg === "--apply") args.apply = true;
        else if (arg === "--dry-run") args.apply = false;
        else if (arg === "--help" || arg === "-h") args.help = true;
        else fail(`unknown argument ${arg} (see --help)`);
    }
    return args;
}

function usage() {
    console.log(`Usage: node src/store/play-release.mjs --aab <file.aab> [--track internal|alpha|beta|production] [--rollout <0-1>] [--apply]

  (no --apply)  dry run: check the bundle and print the requests
  --track       target track (default internal)
  --rollout     staged rollout fraction for production, e.g. 0.2 (default: full release)
  --apply       upload the bundle, assign it to the track, commit the edit

Environment: PLAY_SERVICE_ACCOUNT (keyless) or PLAY_ACCESS_TOKEN or PLAY_SERVICE_ACCOUNT_KEY, PLAY_PACKAGE_NAME (optional override).`);
}

/** The bundle must be the renamed, signed artifact of the workflow: leben-in-deutschland-v<versionName>-<versionCode>.aab. */
function inspectBundle(file) {
    const resolved = path.resolve(file);
    const name = path.basename(resolved);
    const match = /^leben-in-deutschland-v(\d+\.\d+\.\d+)-(\d+)\.aab$/.exec(name);
    if (!match) {
        fail(`${name}: expected the signed workflow artifact leben-in-deutschland-v<versionName>-<versionCode>.aab (never app-release.aab or app-release-temp.aab)`);
    }
    let size;
    try {
        size = statSync(resolved).size;
    } catch (error) {
        fail(`cannot read the bundle: ${error.code ?? error.message}`);
    }
    const bytes = readFileSync(resolved);
    if (bytes.subarray(0, 2).toString("latin1") !== "PK") {
        fail(`${name} is not a zip container, so not an App Bundle`);
    }
    return { path: resolved, name, size, versionName: match[1], versionCode: Number(match[2]), bytes };
}

function releaseNotes() {
    const notes = [];
    for (const language of LANGUAGES) {
        const file = path.join(METADATA, language, "whats_new.txt");
        try {
            const text = readFileSync(file, "utf8").trim();
            if (text.length > NOTES_LIMIT) {
                fail(`${relative(file)} has ${text.length} characters, Play allows ${NOTES_LIMIT}`);
            }
            if (text) {
                notes.push({ language, text });
            }
        } catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }
    }
    return notes;
}

function releaseBody(bundle, track, rollout, notes) {
    const release = { name: bundle.versionName, versionCodes: [String(bundle.versionCode)], status: "completed" };
    if (track === "production" && rollout !== null) {
        release.status = "inProgress";
        release.userFraction = rollout;
    }
    if (notes.length > 0) {
        release.releaseNotes = notes;
    }
    return { track, releases: [release] };
}

async function currentTrack(client, packageName, editPath, track) {
    try {
        const current = await client.request("GET", `${editPath}/tracks/${track}`);
        const codes = (current.releases ?? []).flatMap((release) => release.versionCodes ?? []);
        return codes.map(Number);
    } catch (error) {
        if (error.status === 404) {
            return [];
        }
        throw error;
    }
}

async function apply(client, packageName, bundle, track, rollout, notes) {
    const edit = await client.request("POST", `/applications/${packageName}/edits`, { body: {} });
    const editPath = `/applications/${packageName}/edits/${edit.id}`;
    try {
        const already = await currentTrack(client, packageName, editPath, track);
        if (already.includes(bundle.versionCode)) {
            await client.request("DELETE", editPath);
            console.log(`${track}: version code ${bundle.versionCode} is already on this track; nothing to do`);
            return;
        }
        const uploaded = await client.upload(`${editPath}/bundles`, { contentType: "application/octet-stream", bytes: bundle.bytes });
        if (Number(uploaded.versionCode) !== bundle.versionCode) {
            fail(`Play read version code ${uploaded.versionCode} from the bundle, the file name says ${bundle.versionCode}; refusing to continue`);
        }
        console.log(`uploaded ${bundle.name} (${(bundle.size / 1024 / 1024).toFixed(1)} MB), version code ${uploaded.versionCode}`);
        await client.request("PUT", `${editPath}/tracks/${track}`, { body: releaseBody(bundle, track, rollout, notes) });
        console.log(`${track}: release ${bundle.versionName} (${bundle.versionCode}) ${rollout !== null && track === "production" ? `staged at ${Math.round(rollout * 100)} %` : "completed"}${notes.length ? `, release notes in ${notes.map((n) => n.language).join(", ")}` : ""}`);
        try {
            await client.request("POST", `${editPath}:commit`);
            console.log("edit committed; Play is processing the bundle");
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

function dryRun(packageName, bundle, track, rollout, notes) {
    console.log(`dry run for ${packageName} - nothing is sent\n`);
    console.log(`bundle ${bundle.name}: versionName ${bundle.versionName}, versionCode ${bundle.versionCode}, ${(bundle.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`POST ${API}/applications/${packageName}/edits`);
    console.log(`POST ${API.replace("/androidpublisher/v3", "/upload/androidpublisher/v3")}/applications/${packageName}/edits/<id>/bundles?uploadType=media  (application/octet-stream)`);
    console.log(`PUT ${API}/applications/${packageName}/edits/<id>/tracks/${track}`);
    console.log(JSON.stringify(releaseBody(bundle, track, rollout, notes), null, 2));
    console.log(`POST ${API}/applications/${packageName}/edits/<id>:commit`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }
    if (!args.aab) {
        fail("--aab <file> is required (see --help)");
    }
    if (!TRACKS.has(args.track)) {
        fail(`--track must be one of ${[...TRACKS].join(", ")}`);
    }
    if (args.rollout !== null && !(args.rollout > 0 && args.rollout < 1)) {
        fail("--rollout must be a fraction between 0 and 1 (exclusive), e.g. 0.2");
    }
    const packageName = readPackageName();
    const bundle = inspectBundle(args.aab);
    const notes = releaseNotes();
    if (!args.apply) {
        dryRun(packageName, bundle, args.track, args.rollout, notes);
        console.log(`\nBundle valid. Run with --apply to upload it to the ${args.track} track.`);
        return;
    }
    const client = await createPlayClient();
    await apply(client, packageName, bundle, args.track, args.rollout, notes);
    console.log(`\nDone. ${args.track === "production" ? "The release is live once Play finishes processing." : `Testers of the ${args.track} track get the build after processing; promote to production in Play Console -> Release -> ${args.track} testing -> Promote release.`}`);
}

main().catch((error) => {
    explainError(error);
    process.exit(1);
});
