// Minimal App Store Connect API client on Node built-ins: a short-lived JWT
// (ES256) signed with the owner's App Store Connect API key, JSON:API requests
// with pagination, asset uploads, and readable errors. Shared by
// asc-products.mjs and asc-listing.mjs.
//
// Credentials (setup in src/store/README.md, "App Store Connect from the command line"):
// ASC_KEY_ID          key id of the App Store Connect API team key (role App Manager)
// ASC_ISSUER_ID       issuer id shown above the key list
// ASC_API_KEY_PATH    path to AuthKey_<KEYID>.p8, outside the repository (laptop)
// ASC_API_KEY_BASE64  the .p8 content, base64 (GitHub Actions secret); used when ASC_API_KEY_PATH is unset
//
// ASC_BUNDLE_ID       overrides the appId read from src/web/capacitor.config.ts
// ASC_API_BASE        local mock (tests only)
//
// The key is read, never printed, and must never be committed. Ids are not
// printed either: the repository is public, so its Actions logs are public.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");
export const API = (process.env.ASC_API_BASE ?? "https://api.appstoreconnect.apple.com").replace(/\/$/, "");
/** Apple caps the token lifetime at 20 minutes; a new one is minted after 15. */
const TOKEN_LIFETIME_S = 20 * 60;
const TOKEN_REFRESH_MS = 15 * 60 * 1000;

export class ApiError extends Error {
    constructor(status, message, code, errors = []) {
        super(message);
        this.status = status;
        this.code = code;
        this.errors = errors;
    }
}

export function fail(message) {
    throw new Error(message);
}

export function relative(file) {
    return path.relative(repoRoot, file);
}

/** The bundle id: ASC_BUNDLE_ID or the Capacitor appId. */
export function readBundleId() {
    if (process.env.ASC_BUNDLE_ID) {
        return process.env.ASC_BUNDLE_ID;
    }
    const config = readFileSync(path.join(repoRoot, "src/web/capacitor.config.ts"), "utf8");
    const match = /appId:\s*["']([a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+)["']/i.exec(config);
    if (!match) {
        fail("appId not found in src/web/capacitor.config.ts; set ASC_BUNDLE_ID");
    }
    return match[1];
}

/** The marketing version every build carries (CFBundleShortVersionString): src/web/package.json. */
export function readAppVersion() {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "src/web/package.json"), "utf8"));
    if (!/^\d+\.\d+\.\d+$/.test(pkg.version ?? "")) {
        fail(`src/web/package.json version "${pkg.version}" is not MAJOR.MINOR.PATCH`);
    }
    return pkg.version;
}

function readPrivateKey() {
    const keyPath = process.env.ASC_API_KEY_PATH;
    let pem;
    if (keyPath) {
        const resolved = path.resolve(keyPath);
        if (resolved.startsWith(repoRoot + path.sep)) {
            console.warn("  ! the API key lies inside the repository - move it outside and never commit it");
        }
        try {
            pem = readFileSync(resolved, "utf8");
        } catch (error) {
            fail(`cannot read the App Store Connect API key file: ${error.code ?? error.message}`);
        }
    } else if (process.env.ASC_API_KEY_BASE64) {
        pem = Buffer.from(process.env.ASC_API_KEY_BASE64, "base64").toString("utf8");
    } else {
        fail("no App Store Connect API key: set ASC_API_KEY_PATH (laptop) or ASC_API_KEY_BASE64 (GitHub Actions)");
    }
    if (!/-----BEGIN PRIVATE KEY-----/.test(pem)) {
        // The parse error would quote the file content, so it is not repeated here.
        fail("the App Store Connect API key is not a PEM private key (.p8 downloaded from App Store Connect)");
    }
    return pem;
}

/** A signed App Store Connect API token (ES256, 20 minutes). */
export function mintToken({ keyId, issuerId, privateKey, now = Date.now() }) {
    const iat = Math.floor(now / 1000);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const input = `${encode({ alg: "ES256", kid: keyId, typ: "JWT" })}.${encode({ iss: issuerId, iat, exp: iat + TOKEN_LIFETIME_S, aud: "appstoreconnect-v1" })}`;
    const signature = createSign("SHA256").update(input).sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
    return `${input}.${signature}`;
}

function withQuery(base, query) {
    if (!query) {
        return base;
    }
    const url = new URL(base);
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}

function describe(errors) {
    return errors
        .map((error) => {
            const where = error.source?.pointer ?? error.source?.parameter;
            return `${error.title ?? error.code ?? "error"}${error.detail ? `: ${error.detail}` : ""}${where ? ` (${where})` : ""}`;
        })
        .join("; ");
}

/**
 * A client bound to the owner's API key. `request` returns the parsed JSON:API
 * document (`data`, `included`, `links`), `list` follows `links.next` and
 * returns every `data` item, `upload` performs the upload operations of a
 * reserved asset.
 */
export async function createAscClient() {
    const keyId = process.env.ASC_KEY_ID;
    const issuerId = process.env.ASC_ISSUER_ID;
    if (!keyId || !issuerId) {
        fail("set ASC_KEY_ID and ASC_ISSUER_ID (App Store Connect -> Users and Access -> Integrations -> App Store Connect API)");
    }
    const privateKey = readPrivateKey();
    console.log(`authenticating with the App Store Connect API key from ${process.env.ASC_API_KEY_PATH ? "ASC_API_KEY_PATH" : "ASC_API_KEY_BASE64"}`);

    let token = null;
    let mintedAt = 0;
    function bearer() {
        if (!token || Date.now() - mintedAt > TOKEN_REFRESH_MS) {
            token = mintToken({ keyId, issuerId, privateKey });
            mintedAt = Date.now();
        }
        return token;
    }

    async function request(method, pathname, { query, body, allow404 = false } = {}) {
        const url = withQuery(pathname.startsWith("http") ? pathname : `${API}${pathname}`, query);
        const response = await fetch(url, {
            method,
            headers: {
                authorization: `Bearer ${bearer()}`,
                accept: "application/json",
                ...(body ? { "content-type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (response.status === 204) {
            return null;
        }
        const text = await response.text();
        let document = {};
        if (text) {
            try {
                document = JSON.parse(text);
            } catch {
                document = { raw: text.slice(0, 200) };
            }
        }
        if (response.status === 404 && allow404) {
            return null;
        }
        if (!response.ok) {
            const errors = Array.isArray(document.errors) ? document.errors : [];
            const message = errors.length > 0 ? describe(errors) : document.raw ?? response.statusText;
            throw new ApiError(response.status, `${method} ${pathname.replace(API, "")}: ${message}`, errors[0]?.code, errors);
        }
        return document;
    }

    async function list(pathname, { query } = {}) {
        const items = [];
        let document = await request("GET", pathname, { query: { limit: 200, ...query } });
        while (document) {
            items.push(...(document.data ?? []));
            document = document.links?.next ? await request("GET", document.links.next) : null;
        }
        return items;
    }

    /** Sends the bytes of a reserved asset through its upload operations (chunked PUTs). */
    async function upload(reservation, bytes) {
        const operations = reservation.attributes?.uploadOperations ?? [];
        if (operations.length === 0) {
            fail("the reservation has no upload operations");
        }
        for (const operation of operations) {
            const headers = Object.fromEntries((operation.requestHeaders ?? []).map((header) => [header.name, header.value]));
            const response = await fetch(operation.url, {
                method: operation.method ?? "PUT",
                headers,
                body: bytes.subarray(operation.offset ?? 0, (operation.offset ?? 0) + (operation.length ?? bytes.length)),
            });
            if (!response.ok) {
                throw new ApiError(response.status, `upload of ${reservation.attributes?.fileName ?? "asset"} failed (${response.status})`, "UPLOAD_FAILED");
            }
        }
    }

    return { request, list, upload };
}

/** Finds the app record for the bundle id; fails with a hint when it does not exist yet. */
export async function findApp(client, bundleId) {
    const apps = await client.list("/v1/apps", { query: { "filter[bundleId]": bundleId } });
    const app = apps.find((candidate) => candidate.attributes?.bundleId === bundleId);
    if (!app) {
        fail(`no app with bundle id ${bundleId} in this App Store Connect team - create the app record first (src/store/README.md, App Store Connect, step 3)`);
    }
    return app;
}

export function explainError(error) {
    if (!(error instanceof ApiError)) {
        console.error(`✗ ${error.message}`);
        return;
    }
    console.error(`✗ App Store Connect API ${error.status}${error.code ? ` ${error.code}` : ""}: ${error.message}`);
    if (error.status === 401) {
        console.error("  The token was refused: check ASC_KEY_ID and ASC_ISSUER_ID against the key list in App Store Connect, and that the .p8 belongs to that key id and is not revoked.");
    } else if (error.status === 403) {
        console.error(
            "  Not allowed: the key needs the App Manager role, the Paid Apps Agreement must be active for in-app purchases, and some writes are refused while a version is in review.",
        );
    } else if (error.status === 404) {
        console.error("  Not found: the app record, version or product does not exist yet, or the key belongs to another team.");
    } else if (error.status === 409) {
        console.error("  Conflict: the record is not editable in its current state, or a value is already taken (App Store names must be unique).");
    }
}
