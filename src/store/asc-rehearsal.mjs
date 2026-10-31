// Offline rehearsal for asc-products.mjs and asc-listing.mjs: a local mock of
// the App Store Connect API that checks the ES256 token like Apple does
// (signature, key id, issuer, audience, expiry) and keeps state, so both
// scripts run with --apply against it twice - the second run must change
// nothing. Needs no credentials and no network; nothing reaches Apple.
//
//   node src/store/asc-rehearsal.mjs
//
// The mock only knows the request shapes these scripts send; passing proves
// the scripts are consistent and idempotent, not that Apple accepts every
// field - the first real `--list` and `--apply` with the owner's key do that.
import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUNDLE = "org.lebenindeutschland.app";
const KEY_ID = "KEYID98765";
const ISSUER = "11111111-2222-3333-4444-555555555555";
const APP_ID = "6800000000";
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const dir = mkdtempSync(path.join(os.tmpdir(), "asc-mock-"));
const keyFile = path.join(dir, "AuthKey_" + KEY_ID + ".p8");
writeFileSync(keyFile, privateKey.export({ type: "pkcs8", format: "pem" }));
const otherKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "pkcs8", format: "pem" });
const otherKeyFile = path.join(dir, "other.p8");
writeFileSync(otherKeyFile, otherKey);
const shot = path.join(dir, "tip-jar.png");
const shotBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(3000, 7)]);
writeFileSync(shot, shotBytes);

const log = [];
let nextId = 1;
const id = (prefix) => `${prefix}-${nextId++}`;
const state = {
    app: { contentRightsDeclaration: null },
    iaps: {},
    iapLocalizations: {},
    schedules: {},
    availabilities: {},
    screenshots: {},
    uploads: {},
    appInfo: { id: "info-1", attributes: { state: "PREPARE_FOR_SUBMISSION", contentRightsDeclaration: null }, category: null },
    infoLocalizations: { "il-1": { id: "il-1", attributes: { locale: "de-DE", name: "Leben in Deutschland", subtitle: null, privacyPolicyUrl: null } } },
    ageRating: { id: "age-1", attributes: {} },
    versions: { "ver-1": { id: "ver-1", attributes: { versionString: "1.0", appVersionState: "PREPARE_FOR_SUBMISSION", copyright: null, releaseType: "AFTER_APPROVAL" } } },
    versionLocalizations: { "vl-1": { id: "vl-1", attributes: { locale: "de-DE", description: "old", keywords: "old", promotionalText: null, supportUrl: null, marketingUrl: null } } },
};
const territories = Array.from({ length: 175 }, (_, i) => ({ type: "territories", id: `T${String(i).padStart(3, "0")}` }));
territories[0].id = "DEU";
const pricePoints = Array.from({ length: 330 }, (_, i) => ({ type: "inAppPurchasePricePoints", id: `pp-${i}`, attributes: { customerPrice: (0.29 + i * 0.5).toFixed(2), proceeds: "0" } }));
for (const [price, pid] of [["1.99", "pp-199"], ["4.99", "pp-499"], ["9.99", "pp-999"]]) {
    pricePoints.push({ type: "inAppPurchasePricePoints", id: pid, attributes: { customerPrice: price, proceeds: "0" } });
}

function iapState(iapId) {
    const locs = Object.values(state.iapLocalizations).filter((l) => l.iap === iapId);
    const ok = locs.length > 0 && state.schedules[iapId] && state.availabilities[iapId] && state.screenshots[iapId]?.attributes.uploaded;
    return ok ? "READY_TO_SUBMIT" : "MISSING_METADATA";
}

function verifyToken(req) {
    const auth = req.headers.authorization ?? "";
    const token = auth.replace(/^Bearer /, "");
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return "no token";
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    if (header.alg !== "ES256" || header.kid !== KEY_ID) return "wrong header";
    if (payload.iss !== ISSUER || payload.aud !== "appstoreconnect-v1") return "wrong claims";
    const now = Math.floor(Date.now() / 1000);
    if (!(payload.iat <= now + 5 && payload.exp > now && payload.exp - payload.iat <= 1200)) return "bad lifetime";
    const valid = createVerify("SHA256").update(`${h}.${p}`).verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    return valid ? null : "bad signature";
}

function json(res, status, body) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
}
function apiError(res, status, code, detail) {
    json(res, status, { errors: [{ status: String(status), code, title: code, detail }] });
}
function readBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
    });
}
function page(res, url, items, pathname) {
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const slice = items.slice(offset, offset + limit);
    const body = { data: slice, links: {} };
    if (offset + limit < items.length) {
        const next = new URL(url);
        next.searchParams.set("offset", String(offset + limit));
        body.links.next = `${base}${pathname}${next.search}`;
    }
    json(res, 200, body);
}

let base = "";
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname;
    const method = req.method;
    log.push(`${method} ${p}${url.search}`);
    const raw = await readBody(req);
    if (p.startsWith("/upload/")) {
        const [, , uploadId, part] = p.split("/");
        state.uploads[uploadId] ??= [];
        state.uploads[uploadId][Number(part)] = raw;
        res.writeHead(200);
        res.end();
        return;
    }
    const authProblem = verifyToken(req);
    if (authProblem) {
        return apiError(res, 401, "NOT_AUTHORIZED", `Authentication credentials are missing or invalid. (${authProblem})`);
    }
    const body = raw.length > 0 ? JSON.parse(raw.toString()) : null;
    let m;

    if (method === "GET" && p === "/v1/apps") {
        const wanted = url.searchParams.get("filter[bundleId]");
        return json(res, 200, { data: wanted === BUNDLE ? [{ type: "apps", id: APP_ID, attributes: { bundleId: BUNDLE, name: "Einbürgerungstest – LiD", contentRightsDeclaration: state.app.contentRightsDeclaration } }] : [] });
    }
    if (method === "PATCH" && p === `/v1/apps/${APP_ID}`) {
        if (body.data.attributes?.contentRightsDeclaration) state.app.contentRightsDeclaration = body.data.attributes.contentRightsDeclaration;
        return json(res, 200, { data: { type: "apps", id: APP_ID, attributes: { bundleId: BUNDLE, contentRightsDeclaration: state.app.contentRightsDeclaration } } });
    }
    // --- in-app purchases ---
    if (method === "GET" && p === `/v1/apps/${APP_ID}/inAppPurchasesV2`) {
        return json(res, 200, { data: Object.values(state.iaps).map((iap) => ({ ...iap, attributes: { ...iap.attributes, state: iapState(iap.id) } })) });
    }
    if (method === "POST" && p === "/v2/inAppPurchases") {
        const a = body.data.attributes;
        if (body.data.relationships?.app?.data?.id !== APP_ID) return apiError(res, 409, "ENTITY_ERROR", "app relationship missing");
        if (Object.values(state.iaps).some((i) => i.attributes.productId === a.productId)) return apiError(res, 409, "ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE", "productId exists");
        const iap = { type: "inAppPurchases", id: id("iap"), attributes: { ...a } };
        state.iaps[iap.id] = iap;
        return json(res, 201, { data: { ...iap, attributes: { ...iap.attributes, state: iapState(iap.id) } } });
    }
    if ((m = /^\/v2\/inAppPurchases\/([^/]+)$/.exec(p))) {
        const iap = state.iaps[m[1]];
        if (!iap) return apiError(res, 404, "NOT_FOUND", "no such in-app purchase");
        if (method === "PATCH") Object.assign(iap.attributes, body.data.attributes);
        return json(res, 200, { data: { ...iap, attributes: { ...iap.attributes, state: iapState(iap.id) } } });
    }
    if ((m = /^\/v2\/inAppPurchases\/([^/]+)\/inAppPurchaseLocalizations$/.exec(p)) && method === "GET") {
        return json(res, 200, { data: Object.values(state.iapLocalizations).filter((l) => l.iap === m[1]).map(({ iap, ...rest }) => rest) });
    }
    if (method === "POST" && p === "/v1/inAppPurchaseLocalizations") {
        const iap = body.data.relationships?.inAppPurchaseV2?.data?.id;
        if (!state.iaps[iap]) return apiError(res, 409, "ENTITY_ERROR", "inAppPurchaseV2 relationship missing");
        if (body.data.attributes.name.length > 30 || body.data.attributes.description.length > 45) return apiError(res, 409, "ENTITY_ERROR.ATTRIBUTE.INVALID", "too long");
        const loc = { type: "inAppPurchaseLocalizations", id: id("ipl"), attributes: { ...body.data.attributes }, iap };
        state.iapLocalizations[loc.id] = loc;
        return json(res, 201, { data: { ...loc, iap: undefined } });
    }
    if ((m = /^\/v1\/inAppPurchaseLocalizations\/([^/]+)$/.exec(p)) && method === "PATCH") {
        Object.assign(state.iapLocalizations[m[1]].attributes, body.data.attributes);
        return json(res, 200, { data: state.iapLocalizations[m[1]] });
    }
    if ((m = /^\/v2\/inAppPurchases\/([^/]+)\/pricePoints$/.exec(p)) && method === "GET") {
        if (url.searchParams.get("filter[territory]") !== "DEU") return apiError(res, 400, "PARAMETER_ERROR.INVALID", "filter[territory] required");
        return page(res, url, pricePoints, p);
    }
    if ((m = /^\/v2\/inAppPurchases\/([^/]+)\/priceSchedule$/.exec(p)) && method === "GET") {
        const schedule = state.schedules[m[1]];
        if (!schedule) return apiError(res, 404, "NOT_FOUND", "no price schedule");
        return json(res, 200, {
            data: { type: "inAppPurchasePriceSchedules", id: schedule.id, relationships: { baseTerritory: { data: { type: "territories", id: schedule.baseTerritory } } } },
            included: [{ type: "inAppPurchasePrices", id: "price-1", attributes: { startDate: null, endDate: null, manual: true }, relationships: { inAppPurchasePricePoint: { data: { type: "inAppPurchasePricePoints", id: schedule.pricePointId } } } }],
        });
    }
    if (method === "POST" && p === "/v1/inAppPurchasePriceSchedules") {
        const rel = body.data.relationships;
        const iap = rel?.inAppPurchase?.data?.id;
        const manual = rel?.manualPrices?.data?.[0]?.id;
        const included = (body.included ?? []).find((item) => item.type === "inAppPurchasePrices" && item.id === manual);
        const pointId = included?.relationships?.inAppPurchasePricePoint?.data?.id;
        if (!state.iaps[iap] || !included || !pricePoints.some((pp) => pp.id === pointId) || included.attributes?.startDate !== null) {
            return apiError(res, 409, "ENTITY_ERROR", "price schedule needs an inAppPurchase, a base territory and an included manual price with startDate null");
        }
        state.schedules[iap] = { id: id("sched"), baseTerritory: rel.baseTerritory.data.id, pricePointId: pointId };
        return json(res, 201, { data: { type: "inAppPurchasePriceSchedules", id: state.schedules[iap].id } });
    }
    if (method === "GET" && p === "/v1/territories") return page(res, url, territories, p);
    if ((m = /^\/v2\/inAppPurchases\/([^/]+)\/inAppPurchaseAvailability$/.exec(p)) && method === "GET") {
        const availability = state.availabilities[m[1]];
        return availability ? json(res, 200, { data: availability }) : apiError(res, 404, "NOT_FOUND", "no availability");
    }
    if (method === "POST" && p === "/v1/inAppPurchaseAvailabilities") {
        const iap = body.data.relationships?.inAppPurchase?.data?.id;
        const count = body.data.relationships?.availableTerritories?.data?.length ?? 0;
        if (!state.iaps[iap] || count !== territories.length || body.data.attributes?.availableInNewTerritories !== true) return apiError(res, 409, "ENTITY_ERROR", "availability incomplete");
        state.availabilities[iap] = { type: "inAppPurchaseAvailabilities", id: id("avail"), attributes: { availableInNewTerritories: true }, count };
        return json(res, 201, { data: state.availabilities[iap] });
    }
    if ((m = /^\/v2\/inAppPurchases\/([^/]+)\/appStoreReviewScreenshot$/.exec(p)) && method === "GET") {
        const s = state.screenshots[m[1]];
        return s ? json(res, 200, { data: s }) : apiError(res, 404, "NOT_FOUND", "no screenshot");
    }
    if (method === "POST" && p === "/v1/inAppPurchaseAppStoreReviewScreenshots") {
        const iap = body.data.relationships?.inAppPurchaseV2?.data?.id;
        const { fileName, fileSize } = body.data.attributes;
        if (!state.iaps[iap] || !fileName || !fileSize) return apiError(res, 409, "ENTITY_ERROR", "screenshot reservation incomplete");
        const sid = id("shot");
        const half = Math.ceil(fileSize / 2);
        const s = {
            type: "inAppPurchaseAppStoreReviewScreenshots",
            id: sid,
            attributes: {
                fileName,
                fileSize,
                uploaded: false,
                sourceFileChecksum: null,
                uploadOperations: [
                    { method: "PUT", url: `${base}/upload/${sid}/0`, length: half, offset: 0, requestHeaders: [{ name: "Content-Type", value: "image/png" }] },
                    { method: "PUT", url: `${base}/upload/${sid}/1`, length: fileSize - half, offset: half, requestHeaders: [{ name: "Content-Type", value: "image/png" }] },
                ],
            },
            iap,
        };
        state.screenshots[iap] = s;
        return json(res, 201, { data: s });
    }
    if ((m = /^\/v1\/inAppPurchaseAppStoreReviewScreenshots\/([^/]+)$/.exec(p))) {
        const entry = Object.entries(state.screenshots).find(([, s]) => s.id === m[1]);
        if (!entry) return apiError(res, 404, "NOT_FOUND", "no screenshot");
        const [iap, s] = entry;
        if (method === "DELETE") {
            delete state.screenshots[iap];
            return json(res, 204);
        }
        const parts = state.uploads[s.id] ?? [];
        const md5 = createHash("md5").update(Buffer.concat(parts.filter(Boolean))).digest("hex");
        if (body.data.attributes.uploaded !== true || body.data.attributes.sourceFileChecksum !== md5) return apiError(res, 409, "ENTITY_ERROR", "upload incomplete or checksum mismatch");
        s.attributes.uploaded = true;
        s.attributes.sourceFileChecksum = md5;
        return json(res, 200, { data: s });
    }
    // --- listing ---
    if (method === "GET" && p === `/v1/apps/${APP_ID}/appInfos`) return json(res, 200, { data: [{ type: "appInfos", id: state.appInfo.id, attributes: state.appInfo.attributes }] });
    if ((m = /^\/v1\/appInfos\/([^/]+)$/.exec(p)) && method === "PATCH") {
        if (body.data.attributes) return apiError(res, 409, "ENTITY_ERROR.ATTRIBUTE.UNKNOWN", "appInfos has no writable attributes here");
        state.appInfo.category = body.data.relationships?.primaryCategory?.data?.id ?? state.appInfo.category;
        return json(res, 200, { data: { type: "appInfos", id: m[1], attributes: state.appInfo.attributes } });
    }
    if ((m = /^\/v1\/appInfos\/([^/]+)\/appInfoLocalizations$/.exec(p)) && method === "GET") return json(res, 200, { data: Object.values(state.infoLocalizations) });
    if (method === "POST" && p === "/v1/appInfoLocalizations") {
        if (body.data.relationships?.appInfo?.data?.id !== state.appInfo.id) return apiError(res, 409, "ENTITY_ERROR", "appInfo relationship missing");
        if (body.data.attributes.name.length > 30 || (body.data.attributes.subtitle ?? "").length > 30) return apiError(res, 409, "ENTITY_ERROR.ATTRIBUTE.INVALID", "too long");
        const loc = { type: "appInfoLocalizations", id: id("il"), attributes: { ...body.data.attributes } };
        state.infoLocalizations[loc.id] = loc;
        return json(res, 201, { data: loc });
    }
    if ((m = /^\/v1\/appInfoLocalizations\/([^/]+)$/.exec(p)) && method === "PATCH") {
        Object.assign(state.infoLocalizations[m[1]].attributes, body.data.attributes);
        return json(res, 200, { data: state.infoLocalizations[m[1]] });
    }
    if ((m = /^\/v1\/appInfos\/([^/]+)\/ageRatingDeclaration$/.exec(p)) && method === "GET") return json(res, 200, { data: { type: "ageRatingDeclarations", ...state.ageRating } });
    if ((m = /^\/v1\/ageRatingDeclarations\/([^/]+)$/.exec(p)) && method === "PATCH") {
        Object.assign(state.ageRating.attributes, body.data.attributes);
        return json(res, 200, { data: { type: "ageRatingDeclarations", ...state.ageRating } });
    }
    if (method === "GET" && p === `/v1/apps/${APP_ID}/appStoreVersions`) return json(res, 200, { data: Object.values(state.versions) });
    if ((m = /^\/v1\/appStoreVersions\/([^/]+)$/.exec(p)) && method === "PATCH") {
        Object.assign(state.versions[m[1]].attributes, body.data.attributes);
        return json(res, 200, { data: state.versions[m[1]] });
    }
    if ((m = /^\/v1\/appStoreVersions\/([^/]+)\/appStoreVersionLocalizations$/.exec(p)) && method === "GET") return json(res, 200, { data: Object.values(state.versionLocalizations) });
    if (method === "POST" && p === "/v1/appStoreVersionLocalizations") {
        if (body.data.relationships?.appStoreVersion?.data?.id !== "ver-1") return apiError(res, 409, "ENTITY_ERROR", "appStoreVersion relationship missing");
        const loc = { type: "appStoreVersionLocalizations", id: id("vl"), attributes: { ...body.data.attributes } };
        state.versionLocalizations[loc.id] = loc;
        return json(res, 201, { data: loc });
    }
    if ((m = /^\/v1\/appStoreVersionLocalizations\/([^/]+)$/.exec(p)) && method === "PATCH") {
        Object.assign(state.versionLocalizations[m[1]].attributes, body.data.attributes);
        return json(res, 200, { data: state.versionLocalizations[m[1]] });
    }
    apiError(res, 404, "NOT_FOUND", `mock has no route for ${method} ${p}`);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
function expect(condition, label) {
    console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
    if (!condition) failures.push(label);
}
function run(script, args, env = {}) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(repo, "src/store", script), ...args], {
            env: { ...process.env, ASC_API_BASE: base, ASC_KEY_ID: KEY_ID, ASC_ISSUER_ID: ISSUER, ASC_API_KEY_PATH: keyFile, ASC_API_KEY_BASE64: "", ...env },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d));
        child.stderr.on("data", (d) => (stderr += d));
        child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
}
const secretFree = (r) => ![KEY_ID, ISSUER].some((value) => r.stdout.includes(value) || r.stderr.includes(value));

// 1. dry runs need no credentials
let r = await run("asc-products.mjs", [], { ASC_KEY_ID: "", ASC_ISSUER_ID: "", ASC_API_KEY_PATH: "" });
expect(r.status === 0 && /Definition valid: 3 product/.test(r.stdout) && log.length === 0, "products dry run validates without credentials and sends nothing");
r = await run("asc-listing.mjs", [], { ASC_KEY_ID: "", ASC_ISSUER_ID: "", ASC_API_KEY_PATH: "" });
expect(r.status === 0 && /Listing valid for de-DE, en-US/.test(r.stdout) && log.length === 0, "listing dry run validates without credentials and sends nothing");

// 2. products: list, apply with screenshot, second apply is a no-op
r = await run("asc-products.mjs", ["--list"]);
expect(r.status === 0 && /0 in-app purchase\(s\)/.test(r.stdout) && /missing: tip_small/.test(r.stdout), "--list shows the missing products");
expect(secretFree(r), "--list prints neither the key id nor the issuer id");
let from = log.length;
r = await run("asc-products.mjs", ["--apply", "--review-screenshot", shot]);
expect(r.status === 0, `products --apply exits 0${r.status === 0 ? "" : `\n${r.stdout}\n${r.stderr}`}`);
expect(Object.keys(state.iaps).length === 3 && Object.values(state.iaps).every((i) => i.attributes.inAppPurchaseType === "CONSUMABLE" && i.attributes.familySharable === false), "three consumables created");
expect(Object.values(state.iapLocalizations).length === 6, "de-DE and en-US localizations for every product");
expect(["pp-199", "pp-499", "pp-999"].every((pp) => Object.values(state.schedules).some((s) => s.pricePointId === pp && s.baseTerritory === "DEU")), "price schedules use the DEU price points for 1.99, 4.99 and 9.99 (found behind pagination)");
expect(Object.values(state.availabilities).length === 3 && Object.values(state.availabilities).every((a) => a.count === 175), "availability covers all 175 territories (two pages)");
expect(Object.values(state.screenshots).length === 3 && Object.values(state.screenshots).every((s) => s.attributes.uploaded && s.attributes.sourceFileChecksum === createHash("md5").update(shotBytes).digest("hex")), "review screenshots uploaded in chunks and committed with the md5");
expect(/READY_TO_SUBMIT/.test(r.stdout) && !/add the App Review screenshot/.test(r.stdout), "products end READY_TO_SUBMIT");
expect(secretFree(r), "apply prints neither the key id nor the issuer id");
from = log.length;
r = await run("asc-products.mjs", ["--apply", "--review-screenshot", shot]);
const writes = log.slice(from).filter((l) => /^(POST|PATCH|DELETE) /.test(l) && !/\/v2\/inAppPurchases\/iap-\d+$/.test(l));
expect(r.status === 0 && writes.length === 0 && /unchanged/.test(r.stdout), `second products --apply changes nothing (${writes.length} write(s))`);
r = await run("asc-products.mjs", ["--apply", "--product", "tip_small"]);
expect(r.status === 0 && /tip_small/.test(r.stdout) && !/tip_large/.test(r.stdout), "--product limits the run");
r = await run("asc-products.mjs", ["--apply", "--product", "nope"]);
expect(r.status === 1 && /unknown product/.test(r.stderr), "unknown --product is refused");

// 3. listing: apply, then a no-op
from = log.length;
r = await run("asc-listing.mjs", ["--apply"]);
expect(r.status === 0, `listing --apply exits 0${r.status === 0 ? "" : `\n${r.stdout}\n${r.stderr}`}`);
expect(state.appInfo.category === "EDUCATION" && state.app.contentRightsDeclaration === "USES_THIRD_PARTY_CONTENT", "category on the app info and content rights on the app");
const infoLocs = Object.values(state.infoLocalizations);
expect(infoLocs.length === 2 && infoLocs.every((l) => l.attributes.name === "Einbürgerungstest – LiD" && l.attributes.privacyPolicyUrl.endsWith("/privacy-policy")), "name, subtitle and privacy URL for de-DE (updated) and en-US (created)");
expect(Object.keys(state.ageRating.attributes).length === 23 && state.ageRating.attributes.gambling === false && state.ageRating.attributes.gunsOrOtherWeapons === "NONE", "age rating answers written (23, incl. the 2025 questions)");
expect(state.versions["ver-1"].attributes.versionString === JSON.parse(readFileSync(path.join(repo, "src/web/package.json"), "utf8")).version && state.versions["ver-1"].attributes.releaseType === "MANUAL" && /^\d{4} /.test(state.versions["ver-1"].attributes.copyright), "version string from package.json, manual release, copyright with the year");
const verLocs = Object.values(state.versionLocalizations);
expect(verLocs.length === 2 && verLocs.every((l) => l.attributes.description.length > 1000 && l.attributes.keywords.length <= 100 && l.attributes.supportUrl && l.attributes.promotionalText), "description, keywords, promotional text and URLs for both locales");
expect(secretFree(r), "listing apply prints neither the key id nor the issuer id");
from = log.length;
r = await run("asc-listing.mjs", ["--apply"]);
const listingWrites = log.slice(from).filter((l) => /^(POST|PATCH) /.test(l) && !l.startsWith("PATCH /v1/appInfos/") && !l.startsWith("PATCH /v1/apps/"));
expect(r.status === 0 && listingWrites.length === 0 && /texts: unchanged/.test(r.stdout), `second listing --apply changes nothing (${listingWrites.length} write(s))`);

// 4. credential modes and failures
r = await run("asc-products.mjs", ["--list"], { ASC_API_KEY_PATH: "", ASC_API_KEY_BASE64: Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" })).toString("base64") });
expect(r.status === 0 && /from ASC_API_KEY_BASE64/.test(r.stdout), "ASC_API_KEY_BASE64 mode works (GitHub Actions)");
r = await run("asc-products.mjs", ["--list"], { ASC_API_KEY_PATH: otherKeyFile });
expect(r.status === 1 && /API 401/.test(r.stderr) && /check ASC_KEY_ID and ASC_ISSUER_ID/.test(r.stderr) && secretFree(r), "a key of another team is refused with a hint and without ids");
r = await run("asc-products.mjs", ["--list"], { ASC_API_KEY_PATH: "", ASC_API_KEY_BASE64: "" });
expect(r.status === 1 && /no App Store Connect API key/.test(r.stderr), "missing key explained");
r = await run("asc-products.mjs", ["--list"], { ASC_BUNDLE_ID: "org.example.other" });
expect(r.status === 1 && /no app with bundle id org.example.other/.test(r.stderr), "unknown bundle id explained");
expect(!log.some((l) => /KEYID|1111/.test(l)), "no ids in request URLs");

server.close();
console.log(`\n${failures.length === 0 ? "ALL CHECKS PASSED" : "FAILURES:\n  " + failures.join("\n  ")}`);
console.log(`${log.length} API calls recorded`);
process.exit(failures.length === 0 ? 0 : 1);
