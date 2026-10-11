// Minimal Google Play Developer API client on Node built-ins: service-account
// key -> signed JWT -> access token, JSON requests, media uploads, and
// readable errors. Shared by play-products.mjs and play-listing.mjs.
//
// PLAY_SERVICE_ACCOUNT_KEY   path to the service-account JSON key, kept outside the repository
// PLAY_PACKAGE_NAME          overrides the appId read from src/web/capacitor.config.ts
// PLAY_API_BASE              points the scripts at a local mock of the API (tests only)
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");
export const API_BASE = (process.env.PLAY_API_BASE ?? "https://androidpublisher.googleapis.com").replace(/\/$/, "");
export const API = `${API_BASE}/androidpublisher/v3`;
const UPLOAD_API = `${API_BASE}/upload/androidpublisher/v3`;
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export class ApiError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function fail(message) {
    throw new Error(message);
}

export function relative(file) {
    return path.relative(repoRoot, file);
}

/** The Play package name: PLAY_PACKAGE_NAME or the Capacitor appId. */
export function readPackageName() {
    if (process.env.PLAY_PACKAGE_NAME) {
        return process.env.PLAY_PACKAGE_NAME;
    }
    const config = readFileSync(path.join(repoRoot, "src/web/capacitor.config.ts"), "utf8");
    const match = /appId:\s*["']([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)["']/i.exec(config);
    if (!match) {
        fail("appId not found in src/web/capacitor.config.ts; set PLAY_PACKAGE_NAME");
    }
    return match[1];
}

function readKey() {
    const keyPath = process.env.PLAY_SERVICE_ACCOUNT_KEY;
    if (!keyPath) {
        fail("PLAY_SERVICE_ACCOUNT_KEY is not set; point it at the service-account JSON key (kept outside the repository)");
    }
    const resolved = path.resolve(keyPath);
    if (resolved.startsWith(repoRoot + path.sep)) {
        console.warn("  ! the key file lies inside the repository - move it outside and never commit it");
    }
    let text;
    try {
        text = readFileSync(resolved, "utf8");
    } catch (error) {
        fail(`cannot read the service-account key file: ${error.code ?? error.message}`);
    }
    let key;
    try {
        key = JSON.parse(text);
    } catch {
        // The parse error would quote the file content, so it is not repeated here.
        fail("the service-account key file is not valid JSON");
    }
    if (!key.client_email || !key.private_key) {
        fail("the key file has no client_email/private_key; download a JSON key for the service account in Google Cloud -> IAM -> Service accounts");
    }
    return key;
}

async function fetchToken(key) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const tokenUrl = key.token_uri ?? TOKEN_URL;
    const input = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
        iss: key.client_email,
        scope: SCOPE,
        aud: tokenUrl,
        iat: now,
        exp: now + 3600,
    })}`;
    const signature = createSign("RSA-SHA256").update(input).sign(key.private_key).toString("base64url");
    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${input}.${signature}` }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
        const reason = body.error_description ?? (typeof body.error === "object" ? body.error?.message : body.error) ?? "no access token";
        fail(`token request failed (${response.status}): ${reason}`);
    }
    return body.access_token;
}

function withQuery(base, query) {
    const url = new URL(base);
    for (const [name, value] of Object.entries(query ?? {})) {
        if (value !== undefined) {
            url.searchParams.set(name, value);
        }
    }
    return url;
}

async function call(url, init) {
    const response = await fetch(url, init);
    const text = await response.text();
    let json = {};
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        json = {};
    }
    if (!response.ok) {
        throw new ApiError(response.status, json.error?.message ?? (text ? text.slice(0, 300) : response.statusText), json.error?.status);
    }
    return json;
}

/**
 * Authenticates once and returns `{ email, request, upload }`. `request`
 * sends JSON to the v3 API, `upload` sends raw media to the upload endpoint.
 * Paths start after `/androidpublisher/v3`, e.g. `/applications/<pkg>/edits`.
 */
export async function createPlayClient() {
    const key = readKey();
    console.log(`authenticating as ${key.client_email}`);
    const token = await fetchToken(key);
    const auth = { authorization: `Bearer ${token}` };
    return {
        email: key.client_email,
        request(method, apiPath, { query, body } = {}) {
            return call(withQuery(`${API}${apiPath}`, query), {
                method,
                headers: { ...auth, ...(body ? { "content-type": "application/json" } : {}) },
                body: body ? JSON.stringify(body) : undefined,
            });
        },
        upload(apiPath, { query, contentType, bytes }) {
            return call(withQuery(`${UPLOAD_API}${apiPath}`, { uploadType: "media", ...query }), {
                method: "POST",
                headers: { ...auth, "content-type": contentType },
                body: bytes,
            });
        },
    };
}

/** Prints an error with the usual Play API causes; safe to call for any error. */
export function explainError(error) {
    if (!(error instanceof ApiError)) {
        console.error(`✗ ${error.message}`);
        return;
    }
    console.error(`✗ Play API ${error.status}${error.code ? ` ${error.code}` : ""}: ${error.message}`);
    if (error.status === 401 || error.status === 403) {
        console.error(
            '  The service account needs "Manage store presence" for this app (Play Console -> Users and permissions); new permissions can take up to 24 h to reach the API, and the Google Cloud project must have the Google Play Android Developer API enabled.',
        );
    }
    if (error.status === 404) {
        console.error("  Check the package name and that the app exists in the Play Console account that invited the service account.");
    }
    if (/region/i.test(error.message) && /version/i.test(error.message)) {
        console.error("  Set PLAY_REGIONS_VERSION to the version Google names in this message and retry.");
    }
}
