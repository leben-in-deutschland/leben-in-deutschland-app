// Fetch helpers for bamf.de on Node's built-in fetch: a descriptive
// User-Agent, a timeout, one retry, conditional GET, and redirects reported
// as failures. The site sits behind a WAF that rejects HEAD requests and
// answers some blocked requests with a redirect to an error page, so only
// GET is used and a 3xx is never followed. Cookies the WAF sets are neither
// stored nor printed.
export const USER_AGENT = "LebenInDeutschlandCatalogue/1.0 (+https://github.com/leben-in-deutschland/leben-in-deutschland-app)";

const DEFAULT_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 3_000;

export class HttpError extends Error {
    constructor(message, { status, retryable = false } = {}) {
        super(message);
        this.status = status;
        this.retryable = retryable;
    }
}

function describeLocation(response) {
    const location = response.headers.get("location");
    if (!location) {
        return "no Location header";
    }
    try {
        // Only the path is reported: a WAF redirect can carry session data in the query.
        return `Location ${new URL(location, response.url || undefined).pathname}`;
    } catch {
        return "an unparseable Location header";
    }
}

async function attempt(url, { headers, timeoutMs }) {
    let response;
    try {
        response = await fetch(url, {
            method: "GET",
            redirect: "manual",
            headers: { "user-agent": USER_AGENT, ...headers },
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        const reason = error.name === "TimeoutError" ? `no response within ${timeoutMs / 1000} s` : (error.cause?.code ?? error.message);
        throw new HttpError(`GET ${new URL(url).pathname} failed: ${reason}`, { retryable: true });
    }
    if (response.status >= 300 && response.status < 400 && response.status !== 304) {
        await response.body?.cancel();
        throw new HttpError(`GET ${new URL(url).pathname} was redirected (${response.status}, ${describeLocation(response)}); the site's WAF may have blocked the request`, { status: response.status });
    }
    if (response.status >= 500) {
        await response.body?.cancel();
        throw new HttpError(`GET ${new URL(url).pathname} failed with ${response.status}`, { status: response.status, retryable: true });
    }
    return response;
}

/**
 * GETs `url` and returns the Response for 2xx and 304; throws HttpError for
 * everything else. Network errors and 5xx answers are retried once.
 */
export async function get(url, { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1 } = {}) {
    for (let tries = 0; ; tries++) {
        try {
            const response = await attempt(url, { headers, timeoutMs });
            if (response.ok || response.status === 304) {
                return response;
            }
            await response.body?.cancel();
            throw new HttpError(`GET ${new URL(url).pathname} failed with ${response.status}`, { status: response.status });
        } catch (error) {
            if (error instanceof HttpError && error.retryable && tries < retries) {
                console.log(`  ! ${error.message}; retrying in ${RETRY_DELAY_MS / 1000} s`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                continue;
            }
            throw error;
        }
    }
}

/** GETs an HTML page and returns its text (the caller must not print it whole). */
export async function getHtml(url) {
    const response = await get(url, { headers: { accept: "text/html" } });
    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html/i.test(type)) {
        await response.body?.cancel();
        throw new HttpError(`expected an HTML page from ${new URL(url).pathname}, got ${type || "no content type"}`);
    }
    return response.text();
}

/**
 * Conditional GET of a binary document. Returns `{ status: 304 }` when the
 * server reports no change, otherwise `{ status: 200, buffer, etag,
 * lastModified, contentType }`.
 */
export async function getDocument(url, { etag, lastModified, timeoutMs = 120_000 } = {}) {
    const headers = { accept: "application/pdf,*/*" };
    if (etag) {
        headers["if-none-match"] = etag;
    }
    if (lastModified) {
        headers["if-modified-since"] = lastModified;
    }
    const response = await get(url, { headers, timeoutMs });
    if (response.status === 304) {
        await response.body?.cancel();
        return { status: 304 };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
        status: 200,
        buffer,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        contentType: response.headers.get("content-type") ?? "",
    };
}
