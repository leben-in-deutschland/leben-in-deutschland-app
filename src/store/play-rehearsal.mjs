// Offline rehearsal for play-products.mjs, play-listing.mjs and play-release.mjs: a local mock
// of GitHub's OIDC endpoint, Google's STS, IAM Credentials and OAuth token
// endpoints and the Play Developer API. It exercises every credential mode
// (Workload Identity Federation, gcloud impersonation, PLAY_ACCESS_TOKEN,
// key file with a throwaway RSA key), then runs the scripts with --apply
// against the mock (products, listing, a fake App Bundle on the internal
// track) and asserts the call sequence. Needs no credentials and no network;
// nothing reaches Google.
//
//   node src/store/play-rehearsal.mjs
//
// The listing checks need the rendered Play sets under src/store/output/
// (see README.md); without them only the product checks run.
import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PKG = "org.lebenindeutschland.app";
const SA = "play-publisher@example-project.iam.gserviceaccount.com";
const PROVIDER = "projects/123456789/locations/global/workloadIdentityPools/github/providers/github";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keyDir = mkdtempSync(path.join(os.tmpdir(), "play-mock-"));
const keyFile = path.join(keyDir, "key.json");
const fakeGcloud = path.join(keyDir, "gcloud");
const wrongGcloud = path.join(keyDir, "gcloud-wrong");
writeFileSync(fakeGcloud, '#!/bin/sh\n[ "$1 $2" = "auth print-access-token" ] && echo gcloud-user-token || { echo "unexpected gcloud args: $*" >&2; exit 2; }\n', { mode: 0o755 });
writeFileSync(wrongGcloud, "#!/bin/sh\necho someone-elses-token\n", { mode: 0o755 });

const log = [];
const state = { products: {}, listings: { "de-DE": { language: "de-DE", title: "Old title", shortDescription: "old", fullDescription: "old", video: "https://youtu.be/keepme" } }, images: {}, editDeleted: false, committed: null, bundles: [], tracks: {}, commitNeedsReview: true };
let tokenOk = false;
let commitAttempts = 0;

// A fake signed App Bundle: Play only sees a zip container here, the mock reads the version code from the name like the script does.
const FAKE_VERSION_CODE = 424;
const fakeAab = path.join(keyDir, `leben-in-deutschland-v9.9.9-${FAKE_VERSION_CODE}.aab`);
writeFileSync(fakeAab, Buffer.concat([Buffer.from("PK\u0003\u0004", "latin1"), Buffer.alloc(2048, 7)]));

// de-DE phone screenshots are "already in Play" with the same bytes -> must be skipped.
const dePhone = path.join(repo, "src/store/output/play-phone/de");
const haveSets = existsSync(dePhone) && existsSync(path.join(repo, "src/store/output/play-feature/en/featureGraphic.png"));
if (haveSets) {
    state.images["de-DE/phoneScreenshots"] = readdirSync(dePhone)
        .filter((n) => n.endsWith(".png"))
        .sort()
        .map((n, i) => ({ id: `img${i}`, sha256: createHash("sha256").update(readFileSync(path.join(dePhone, n))).digest("hex") }));
}

function json(res, status, body) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
}
function error(res, status, message) {
    json(res, status, { error: { code: status, message, status: status === 400 ? "INVALID_ARGUMENT" : "PERMISSION_DENIED" } });
}
function body(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const raw = await body(req);
    log.push(`${req.method} ${url.pathname}${url.search}`);

    if (url.pathname === "/token") {
        const params = new URLSearchParams(raw.toString());
        const [h, c, s] = params.get("assertion").split(".");
        const header = JSON.parse(Buffer.from(h, "base64url"));
        const claims = JSON.parse(Buffer.from(c, "base64url"));
        const valid = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"));
        const now = Math.floor(Date.now() / 1000);
        tokenOk =
            valid &&
            header.alg === "RS256" &&
            params.get("grant_type") === "urn:ietf:params:oauth:grant-type:jwt-bearer" &&
            claims.iss === "mock@example.iam.gserviceaccount.com" &&
            claims.scope === "https://www.googleapis.com/auth/androidpublisher" &&
            claims.aud === `http://127.0.0.1:${server.address().port}/token` &&
            claims.exp > now &&
            claims.exp <= now + 3600 &&
            claims.iat <= now;
        return tokenOk ? json(res, 200, { access_token: "mock-token", expires_in: 3600 }) : error(res, 400, "invalid_grant");
    }
    // --- keyless credential endpoints
    if (url.pathname === "/oidc") {
        if (req.headers.authorization !== "bearer gh-request-token") return error(res, 401, "bad OIDC request token");
        if (url.searchParams.get("api-version") !== "2.0") return error(res, 400, "GitHub's query string was lost");
        if (url.searchParams.get("audience") !== `https://iam.googleapis.com/${PROVIDER}`) return error(res, 400, `bad audience ${url.searchParams.get("audience")}`);
        return json(res, 200, { value: "github-oidc-jwt" });
    }
    if (url.pathname === "/sts") {
        const b = JSON.parse(raw.toString());
        const ok =
            b.audience === `//iam.googleapis.com/${PROVIDER}` &&
            b.grantType === "urn:ietf:params:oauth:grant-type:token-exchange" &&
            b.requestedTokenType === "urn:ietf:params:oauth:token-type:access_token" &&
            b.scope === "https://www.googleapis.com/auth/cloud-platform" &&
            b.subjectTokenType === "urn:ietf:params:oauth:token-type:jwt" &&
            b.subjectToken === "github-oidc-jwt";
        return ok ? json(res, 200, { access_token: "federated-token", token_type: "Bearer", expires_in: 3600 }) : json(res, 400, { error: "invalid_request", error_description: "token exchange fields wrong" });
    }
    const generate = /^\/v1\/projects\/-\/serviceAccounts\/([^:]+):generateAccessToken$/.exec(url.pathname);
    if (generate) {
        if (decodeURIComponent(generate[1]) !== SA) return error(res, 404, "unknown service account");
        const caller = req.headers.authorization;
        if (caller !== "Bearer federated-token" && caller !== "Bearer gcloud-user-token") {
            return error(res, 403, "Permission 'iam.serviceAccounts.getAccessToken' denied on resource (or it may not exist).");
        }
        const b = JSON.parse(raw.toString());
        if (!Array.isArray(b.scope) || b.scope[0] !== "https://www.googleapis.com/auth/androidpublisher" || b.lifetime !== "3600s") return error(res, 400, "bad generateAccessToken body");
        return json(res, 200, { accessToken: "mock-token", expireTime: "2099-01-01T00:00:00Z" });
    }
    if (req.headers.authorization !== "Bearer mock-token") {
        return error(res, 401, "Request had invalid authentication credentials.");
    }
    const p = url.pathname;
    const base = `/androidpublisher/v3/applications/${PKG}`;
    const upload = `/upload/androidpublisher/v3/applications/${PKG}`;
    let m;

    // --- one-time products
    if (p === `${base}/pricing:convertRegionPrices`) {
        const { price } = JSON.parse(raw.toString());
        const net = Number(price.units) + price.nanos / 1e9;
        const gross = (rate, fx) => {
            const v = net * (1 + rate) * fx;
            return { units: String(Math.floor(v)), nanos: Math.round((v - Math.floor(v)) * 1e9) };
        };
        return json(res, 200, {
            regionVersion: { version: "2025/01" },
            convertedRegionPrices: {
                DE: { regionCode: "DE", price: { currencyCode: "EUR", ...gross(0.19, 1) } },
                AT: { regionCode: "AT", price: { currencyCode: "EUR", ...gross(0.2, 1) } },
                US: { regionCode: "US", price: { currencyCode: "USD", ...gross(0, 1.08) } },
                TR: { regionCode: "TR", price: { currencyCode: "TRY", ...gross(0.2, 37.5) } },
            },
            convertedOtherRegionsPrice: { usdPrice: { currencyCode: "USD", ...gross(0, 1.08) }, eurPrice: { currencyCode: "EUR", units: price.units, nanos: price.nanos } },
        });
    }
    if ((m = new RegExp(`^${base}/onetimeproducts/([a-z_]+)$`).exec(p)) && req.method === "PATCH") {
        if (url.searchParams.get("allowMissing") !== "true") return error(res, 404, "product not found");
        if (url.searchParams.get("regionsVersion.version") !== "2025/01") return error(res, 400, "regionsVersion.version must be 2025/01");
        const product = JSON.parse(raw.toString());
        // Google rejects "new regions" fallback prices that are not rounded to its
        // price pattern (whole cents ending in 9), while convertRegionPrices returns them raw.
        for (const o of product.purchaseOptions) {
            for (const [name, money] of Object.entries({ eurPrice: o.newRegionsConfig?.eurPrice, usdPrice: o.newRegionsConfig?.usdPrice })) {
                if (!money) continue;
                const cents = Number(money.units) * 100 + (money.nanos ?? 0) / 1e7;
                if (!Number.isInteger(cents) || cents % 10 !== 9) {
                    return error(res, 400, `Product "${m[1]}", purchase option "${o.purchaseOptionId}": The price ${(cents / 100).toFixed(2)} ${money.currencyCode} for New Regions must be rounded (${name})`);
                }
            }
        }
        for (const o of product.purchaseOptions) o.state = state.products[m[1]]?.purchaseOptions?.[0]?.state ?? "DRAFT";
        state.products[m[1]] = product;
        return json(res, 200, product);
    }
    if ((m = new RegExp(`^${base}/oneTimeProducts/([a-z_]+)/purchaseOptions:batchUpdateStates$`).exec(p))) {
        const { requests } = JSON.parse(raw.toString());
        for (const r of requests) {
            const a = r.activatePurchaseOptionRequest;
            if (a.packageName !== PKG || a.productId !== m[1]) return error(res, 400, "bad activate request");
            const option = state.products[m[1]].purchaseOptions.find((o) => o.purchaseOptionId === a.purchaseOptionId);
            option.state = "ACTIVE";
        }
        return json(res, 200, {});
    }
    if ((m = new RegExp(`^${base}/oneTimeProducts/([a-z_]+)$`).exec(p)) && req.method === "GET") {
        return state.products[m[1]] ? json(res, 200, state.products[m[1]]) : error(res, 404, "not found");
    }
    if (p === `${base}/oneTimeProducts` && req.method === "GET") {
        return json(res, 200, { oneTimeProducts: Object.values(state.products) });
    }

    // --- edits
    if (p === `${base}/edits` && req.method === "POST") return json(res, 200, { id: "edit-1", expiryTimeSeconds: "9999999999" });
    if ((m = new RegExp(`^${base}/edits/edit-1/listings/([a-zA-Z-]+)$`).exec(p))) {
        if (req.method === "GET") return state.listings[m[1]] ? json(res, 200, state.listings[m[1]]) : error(res, 404, "Listing not found");
        if (req.method === "PUT") {
            state.listings[m[1]] = JSON.parse(raw.toString());
            return json(res, 200, state.listings[m[1]]);
        }
    }
    if ((m = new RegExp(`^${base}/edits/edit-1/listings/([a-zA-Z-]+)/([a-zA-Z]+)$`).exec(p))) {
        const key = `${m[1]}/${m[2]}`;
        if (req.method === "GET") return json(res, 200, { images: state.images[key] ?? [] });
        if (req.method === "DELETE") {
            const deleted = state.images[key] ?? [];
            state.images[key] = [];
            return json(res, 200, { deleted });
        }
    }
    if ((m = new RegExp(`^${upload}/edits/edit-1/listings/([a-zA-Z-]+)/([a-zA-Z]+)$`).exec(p)) && req.method === "POST") {
        if (url.searchParams.get("uploadType") !== "media") return error(res, 400, "uploadType=media expected");
        if (url.searchParams.get("aiGeneratedState") !== "aiGeneratedStateNotAiGenerated") return error(res, 400, "aiGeneratedState expected");
        if (!/^image\/(png|jpeg)$/.test(req.headers["content-type"])) return error(res, 400, `bad content type ${req.headers["content-type"]}`);
        if (!raw.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return error(res, 400, "not a PNG body");
        const key = `${m[1]}/${m[2]}`;
        const image = { id: `up${(state.images[key] ?? []).length}`, sha256: createHash("sha256").update(raw).digest("hex") };
        (state.images[key] ??= []).push(image);
        return json(res, 200, { image });
    }
    if (p === `${upload}/edits/edit-1/bundles` && req.method === "POST") {
        if (url.searchParams.get("uploadType") !== "media") return error(res, 400, "uploadType=media expected");
        if (req.headers["content-type"] !== "application/octet-stream") return error(res, 400, `bad content type ${req.headers["content-type"]}`);
        if (raw.subarray(0, 2).toString("latin1") !== "PK") return error(res, 400, "not an App Bundle");
        const bundle = { versionCode: FAKE_VERSION_CODE, sha256: createHash("sha256").update(raw).digest("hex"), bytes: raw.length };
        state.bundles.push(bundle);
        return json(res, 200, bundle);
    }
    if ((m = new RegExp(`^${base}/edits/edit-1/tracks/([a-z]+)$`).exec(p))) {
        if (req.method === "GET") return state.tracks[m[1]] ? json(res, 200, state.tracks[m[1]]) : error(res, 404, "Track not found");
        if (req.method === "PUT") {
            const track = JSON.parse(raw.toString());
            if (track.track !== m[1]) return error(res, 400, "track name mismatch");
            for (const code of track.releases.flatMap((r) => r.versionCodes)) {
                if (!state.bundles.some((b) => String(b.versionCode) === code)) return error(res, 400, `Version code ${code} has not been uploaded`);
            }
            state.tracks[m[1]] = track;
            return json(res, 200, track);
        }
    }
    if (p === `${base}/edits/edit-1:validate`) return json(res, 200, { id: "edit-1" });
    if (p === `${base}/edits/edit-1:commit`) {
        commitAttempts += 1;
        if (state.commitNeedsReview && url.searchParams.get("changesNotSentForReview") !== "true") {
            return error(res, 400, "Changes cannot be sent for review automatically. Please set the query parameter changesNotSentForReview to true. Once committed, the changes in this edit can be sent for review from the Google Play Console UI.");
        }
        state.committed = url.searchParams.get("changesNotSentForReview") === "true" ? "not-sent-for-review" : "committed";
        return json(res, 200, { id: "edit-1" });
    }
    if (p === `${base}/edits/edit-1` && req.method === "DELETE") {
        state.editDeleted = true;
        return json(res, 200, {});
    }
    return error(res, 404, `unhandled ${req.method} ${p}`);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
writeFileSync(
    keyFile,
    JSON.stringify({
        type: "service_account",
        client_email: "mock@example.iam.gserviceaccount.com",
        private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
        token_uri: `http://127.0.0.1:${port}/token`,
    }),
);

const env = {
    ...process.env,
    PLAY_API_BASE: `http://127.0.0.1:${port}`,
    PLAY_STS_URL: `http://127.0.0.1:${port}/sts`,
    PLAY_IAM_CREDENTIALS_BASE: `http://127.0.0.1:${port}`,
    PLAY_SERVICE_ACCOUNT_KEY: keyFile,
    PLAY_ACCESS_TOKEN: "",
    PLAY_SERVICE_ACCOUNT: "",
    PLAY_WIF_PROVIDER: "",
};
function run(script, args, overrides = {}) {
    return new Promise((resolve) => {
        const child = spawn("node", [path.join(repo, "src/store", script), ...args], { env: { ...env, ...overrides }, cwd: repo });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (c) => (stdout += c));
        child.stderr.on("data", (c) => (stderr += c));
        child.on("close", (status) => {
            console.log(`\n$ node src/store/${script} ${args.join(" ")}  (exit ${status})`);
            console.log(stdout.trim());
            if (stderr.trim()) console.log("stderr:", stderr.trim());
            resolve({ status, stdout, stderr });
        });
    });
}

const failures = [];
const expect = (cond, message) => (cond ? null : failures.push(message));

// 1. products
let r = await run("play-products.mjs", ["--apply"]);
expect(r.status === 0, "products --apply exits 0");
expect(tokenOk, "JWT verified by the mock token endpoint");
for (const id of ["tip_small", "tip_medium", "tip_large"]) {
    const product = state.products[id];
    expect(product?.purchaseOptions[0].state === "ACTIVE", `${id} active`);
    expect(product?.purchaseOptions[0].buyOption.legacyCompatible === true, `${id} legacy compatible`);
    const configs = product?.purchaseOptions[0].regionalPricingAndAvailabilityConfigs ?? [];
    const de = configs.find((c) => c.regionCode === "DE");
    const at = configs.find((c) => c.regionCode === "AT");
    const us = configs.find((c) => c.regionCode === "US");
    expect(de && at && us && configs.length === 4, `${id} has DE/AT/US/TR configs`);
    expect(product?.listings.length === 2 && product.listings.every((l) => l.title && l.description.length <= 200), `${id} listings`);
    if (id === "tip_small") {
        expect(de?.price.units === "1" && de?.price.nanos === 990000000, "DE keeps exactly 1.99 EUR");
        expect(at?.price.units === "1" && at?.price.nanos === 990000000, "AT (euro) keeps exactly 1.99 EUR");
        expect(us?.price.currencyCode === "USD" && Number(us.price.units) + us.price.nanos / 1e9 > 1.7, "US price converted from the net 1.67 EUR");
        expect(product?.purchaseOptions[0].newRegionsConfig?.availability === "AVAILABLE", "newRegionsConfig set");
        const fallback = product?.purchaseOptions[0].newRegionsConfig;
        expect(fallback?.eurPrice.units === "1" && fallback?.eurPrice.nanos === 690000000, "new regions EUR fallback rounded 1.6722... -> 1.69");
        expect(fallback?.usdPrice.currencyCode === "USD" && fallback?.usdPrice.nanos % 100000000 === 90000000, "new regions USD fallback ends in 9 cents");
    }
}
expect(log.filter((l) => l.includes("batchUpdateStates")).length === 3, "three activations");
expect(!log.some((l) => /key|private/i.test(l)), "no key material in requests");

// 2. products --apply again is idempotent: already ACTIVE -> no activation call
const before = log.length;
r = await run("play-products.mjs", ["--apply", "--product", "tip_small"]);
expect(r.status === 0, "second apply exits 0");
expect(!log.slice(before).some((l) => l.includes("batchUpdateStates")), "no activation when already active");

// 3. --list
r = await run("play-products.mjs", ["--list"]);
expect(r.status === 0 && /3 one-time product/.test(r.stdout) && !/missing:/.test(r.stdout), "--list shows the three products");

if (haveSets) {
    // 3b. keyless credential modes (the key file is blanked for these runs)
const keyless = { PLAY_SERVICE_ACCOUNT_KEY: "", PLAY_SERVICE_ACCOUNT: SA };
let from = log.length;
r = await run("play-products.mjs", ["--list"], {
    ...keyless,
    PLAY_WIF_PROVIDER: `https://iam.googleapis.com/${PROVIDER}`,
    ACTIONS_ID_TOKEN_REQUEST_URL: `http://127.0.0.1:${port}/oidc?api-version=2.0`,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "gh-request-token",
});
let calls = log.slice(from);
expect(r.status === 0 && /authenticating with Workload Identity Federation for PLAY_SERVICE_ACCOUNT, no key/.test(r.stdout), "WIF mode lists products");
expect(!r.stdout.includes(SA) && !r.stderr.includes(SA) && !r.stdout.includes(PROVIDER), "WIF mode prints neither the service account nor the provider (public Actions logs)");
expect(calls[0]?.startsWith("GET /oidc?") && calls[1] === "POST /sts" && calls[2]?.includes(":generateAccessToken") && calls[3]?.includes("/oneTimeProducts"), "WIF order: OIDC -> STS -> impersonate -> Play");
from = log.length;
r = await run("play-products.mjs", ["--list"], { ...keyless, PLAY_GCLOUD: fakeGcloud });
calls = log.slice(from);
expect(r.status === 0 && /authenticating with impersonation of PLAY_SERVICE_ACCOUNT through your gcloud login, no key/.test(r.stdout), "gcloud impersonation mode lists products");
expect(!r.stdout.includes(SA) && !r.stderr.includes(SA), "gcloud impersonation mode does not print the service account");
expect(calls[0]?.includes(":generateAccessToken") && calls[1]?.includes("/oneTimeProducts"), "impersonation order: impersonate -> Play");
from = log.length;
r = await run("play-products.mjs", ["--list"], { PLAY_SERVICE_ACCOUNT_KEY: "", PLAY_ACCESS_TOKEN: "mock-token" });
expect(r.status === 0 && /PLAY_ACCESS_TOKEN/.test(r.stdout) && log.slice(from)[0]?.includes("/oneTimeProducts"), "PLAY_ACCESS_TOKEN used directly");
r = await run("play-products.mjs", ["--list"], { ...keyless, PLAY_GCLOUD: wrongGcloud });
expect(r.status === 1 && /impersonation of PLAY_SERVICE_ACCOUNT failed \(403\)/.test(r.stderr) && /roles\/iam\.serviceAccountTokenCreator/.test(r.stderr), "impersonation denial explains the missing role");
expect(!r.stderr.includes(SA), "impersonation denial does not print the service account");
expect(!log.some((l) => /gcloud-user-token|federated-token|someone-elses/.test(l)), "no caller tokens in URLs");

// 4. listing --validate: uploads, validates, discards
    r = await run("play-listing.mjs", ["--validate"]);
    expect(r.status === 0, "listing --validate exits 0");
    expect(state.editDeleted && state.committed === null, "validate mode discards the edit without committing");
    expect(/phoneScreenshots: unchanged \(8\)/.test(r.stdout), "identical de-DE phone screenshots skipped");
    expect(/en-US[\s\S]*texts: created/.test(r.stdout), "en-US listing created");
    expect(/de-DE[\s\S]*texts: updated/.test(r.stdout), "de-DE listing updated");
    expect(state.listings["de-DE"].video === "https://youtu.be/keepme", "existing video kept when no video.txt");
    expect(state.listings["de-DE"].title === "Leben in Deutschland", "title updated from metadata");
    expect((state.images["en-US/phoneScreenshots"] ?? []).length === 8, "8 en-US phone screenshots uploaded");
    expect((state.images["de-DE/featureGraphic"] ?? []).length === 1, "feature graphic uploaded");
    expect((state.images["de-DE/tenInchScreenshots"] ?? []).length === 8, "ten-inch set uploaded");
    expect(!log.some((l) => l.includes("/icon")), "icon never touched");
    const uploadIndex = log.findIndex((l) => l.startsWith("POST /upload/"));
    const validateIndex = log.findIndex((l) => l.includes(":validate"));
    expect(uploadIndex > -1 && validateIndex > uploadIndex, "validate after uploads");

    // 5. listing --apply with Google demanding manual review -> commit retried with changesNotSentForReview
    state.editDeleted = false;
    r = await run("play-listing.mjs", ["--apply", "--lang", "en", "--text-only"]);
    // texts are unchanged now (already stored by the validate run) -> nothing to change
    expect(r.status === 0 && /nothing to change/.test(r.stdout), "apply with no differences discards the edit");
    state.listings["en-US"].title = "Different";
    r = await run("play-listing.mjs", ["--apply", "--lang", "en", "--text-only"]);
    expect(r.status === 0, "listing --apply exits 0");
    expect(commitAttempts === 2 && state.committed === "not-sent-for-review", "commit retried with changesNotSentForReview");
    expect(/not sent for review/.test(r.stdout), "owner told to send for review in the Console");
} else {
    console.log("\nListing checks skipped: no rendered Play sets under src/store/output/ (see src/store/README.md).");
}

// 6. release: dry run touches nothing, --apply uploads the bundle to the internal track and commits
let from6 = log.length;
r = await run("play-release.mjs", ["--aab", fakeAab]);
expect(r.status === 0 && /dry run/.test(r.stdout) && /versionCode 424/.test(r.stdout) && log.length === from6, "release dry run makes no API calls");
r = await run("play-release.mjs", ["--aab", path.join(keyDir, "app-release.aab")]);
expect(r.status === 1 && /expected the signed workflow artifact/.test(r.stderr), "unsigned/unrenamed bundle names are refused");
state.commitNeedsReview = false;
state.editDeleted = false;
from6 = log.length;
r = await run("play-release.mjs", ["--aab", fakeAab, "--apply"]);
let calls6 = log.slice(from6).filter((l) => !/\/token$/.test(l));
expect(r.status === 0, "release --apply exits 0");
expect(calls6[0]?.endsWith("/edits") && calls6[1]?.includes("/tracks/internal") && calls6[2]?.startsWith("POST /upload/") && calls6[2]?.includes("/bundles?uploadType=media") && calls6[3]?.startsWith("PUT ") && calls6[3]?.includes("/tracks/internal") && calls6[4]?.includes(":commit"), `release order: edit -> read track -> upload -> set track -> commit (got ${calls6.join(" | ")})`);
expect(state.bundles.length === 1 && state.bundles[0].bytes === 2052, "the bundle bytes were uploaded once");
const internal = state.tracks.internal?.releases?.[0];
expect(internal?.status === "completed" && internal?.versionCodes?.[0] === "424" && internal?.name === "9.9.9", "internal track release completed for version code 424");
expect(Array.isArray(internal?.releaseNotes) && internal.releaseNotes.some((n) => n.language === "de-DE"), "release notes taken from metadata/android/<lang>/whats_new.txt");
expect(state.committed === "committed" && !state.editDeleted, "release edit committed without the review workaround");
expect(/promote to production in Play Console/.test(r.stdout), "owner told how to promote");
// 6b. same bundle again -> already on the track, edit discarded, no upload
from6 = log.length;
r = await run("play-release.mjs", ["--aab", fakeAab, "--apply"]);
calls6 = log.slice(from6);
expect(r.status === 0 && /already on this track; nothing to do/.test(r.stdout), "re-running with the same version code is a no-op");
expect(!calls6.some((l) => l.includes("/bundles")) && state.editDeleted, "no second upload; the edit was deleted");
// 6c. production with a staged rollout -> inProgress + userFraction, commit falls back to changesNotSentForReview
state.commitNeedsReview = true;
r = await run("play-release.mjs", ["--aab", fakeAab, "--apply", "--track", "production", "--rollout", "0.2"]);
const production = state.tracks.production?.releases?.[0];
expect(r.status === 0 && production?.status === "inProgress" && production?.userFraction === 0.2, "production staged rollout at 20 %");
expect(state.committed === "not-sent-for-review" && /not sent for review/.test(r.stdout), "release commit retried with changesNotSentForReview when Play demands it");
expect(state.bundles.length === 2, "production run uploaded the bundle again (new edit, no prior production release)");

// 7. permission error path: break the token
writeFileSync(keyFile, JSON.stringify({ client_email: "other@example.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: `http://127.0.0.1:${port}/token` }));
r = await run("play-products.mjs", ["--list"]);
expect(r.status === 1 && /token request failed \(400\): invalid_grant/.test(r.stderr), "token failure reported without secrets");

server.close();
const verdict = haveSets ? "ALL CHECKS PASSED" : "PRODUCT AND RELEASE CHECKS PASSED (listing checks skipped)";
console.log(`\n${failures.length === 0 ? verdict : "FAILURES:\n  " + failures.join("\n  ")}`);
console.log(`${log.length} API calls recorded`);
process.exit(failures.length === 0 ? 0 : 1);
