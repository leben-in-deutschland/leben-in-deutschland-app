// Polite GET for the exam centres' public course pages, on Node's built-in
// fetch: a User-Agent that names the project and where to read about it, a
// timeout, a size limit, redirects only within the same site, and the page's
// own character set (older course systems still answer in ISO-8859-1).
// No cookies are kept, nothing is posted, nothing behind a login is read.
export const AGENT_NAME = "LebenInDeutschlandTermine";
export const USER_AGENT = `${AGENT_NAME}/1.0 (+https://www.lebenindeutschland.org/termine; +https://github.com/leben-in-deutschland/leben-in-deutschland-app)`;

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;
const RETRY_DELAY_MS = 2_000;

export class HttpError extends Error {
    constructor(message, { status = null, retryable = false } = {}) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.retryable = retryable;
    }
}

/** "www.vhs-x.de" and "vhs-x.de" are the same site; anything else is another one. */
export function sameSite(a, b) {
    const bare = (url) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    try {
        return bare(a) === bare(b);
    } catch {
        return false;
    }
}

function charsetOf(contentType, head) {
    const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
    const fromMeta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
    return (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
}

/** Decodes a page with its declared character set; an unknown label falls back to UTF-8. */
export function decodeBody(buffer, contentType) {
    const head = Buffer.from(buffer.subarray(0, 4096)).toString("latin1");
    try {
        return new TextDecoder(charsetOf(contentType, head)).decode(buffer);
    } catch {
        return new TextDecoder("utf-8").decode(buffer);
    }
}

async function readLimited(response, maxBytes) {
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body ?? []) {
        size += chunk.length;
        if (size > maxBytes) {
            await response.body?.cancel().catch(() => {});
            throw new HttpError(`the page is larger than ${maxBytes} bytes`);
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function attempt(url, { timeoutMs, maxBytes, accept }) {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        let response;
        try {
            response = await fetch(current, {
                method: "GET",
                redirect: "manual",
                headers: { "user-agent": USER_AGENT, accept, "accept-language": "de" },
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (error) {
            const reason = error.name === "TimeoutError" ? `no answer within ${timeoutMs / 1000} s` : (error.cause?.code ?? error.message);
            throw new HttpError(`GET failed: ${reason}`, { retryable: true });
        }
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            await response.body?.cancel().catch(() => {});
            if (!location) {
                throw new HttpError(`redirect (${response.status}) without a target`, { status: response.status });
            }
            const next = new URL(location, current).href;
            if (!sameSite(next, url)) {
                throw new HttpError(`redirected to another site (${new URL(next).hostname})`, { status: response.status });
            }
            current = next;
            continue;
        }
        if (!response.ok) {
            await response.body?.cancel().catch(() => {});
            throw new HttpError(`HTTP ${response.status}`, { status: response.status, retryable: response.status >= 500 });
        }
        const contentType = response.headers.get("content-type") ?? "";
        const buffer = await readLimited(response, maxBytes);
        return { url: current, status: response.status, contentType, buffer };
    }
    throw new HttpError(`more than ${MAX_REDIRECTS} redirects`);
}

/**
 * GETs `url` and returns { url (after redirects), status, contentType,
 * buffer }. Network errors and 5xx answers are retried once; the notice goes
 * to stderr. Throws HttpError for everything else.
 */
export async function get(url, { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = MAX_BYTES, accept = "text/html,application/xhtml+xml", retries = 1 } = {}) {
    for (let tries = 0; ; tries++) {
        try {
            return await attempt(url, { timeoutMs, maxBytes, accept });
        } catch (error) {
            if (error instanceof HttpError && error.retryable && tries < retries) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                continue;
            }
            throw error;
        }
    }
}

/** GETs an HTML page and returns { url, html }. Anything that is not HTML is an error. */
export async function getPage(url, options) {
    const response = await get(url, options);
    if (!/html/i.test(response.contentType)) {
        throw new HttpError(`expected HTML, got ${response.contentType || "no content type"}`);
    }
    return { url: response.url, html: decodeBody(response.buffer, response.contentType) };
}
