// Small HTML helpers on plain strings. The exam centres' course pages are read
// with regular expressions scoped to one course block, never with a DOM, so
// the pipeline needs nothing but Node built-ins.

const NAMED = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ensp: " ",
    emsp: " ",
    thinsp: " ",
    shy: "",
    zwnj: "",
    zwj: "",
    auml: "ä",
    ouml: "ö",
    uuml: "ü",
    Auml: "Ä",
    Ouml: "Ö",
    Uuml: "Ü",
    szlig: "ß",
    eacute: "é",
    egrave: "è",
    agrave: "à",
    euro: "€",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    bdquo: "„",
    ldquo: "“",
    rdquo: "”",
    lsquo: "‘",
    rsquo: "’",
    sbquo: "‚",
    laquo: "«",
    raquo: "»",
    middot: "·",
    bull: "•",
};

/** An opening or closing tag. Quoted attribute values may hold ">" (some course systems put markup into `title`). */
const TAG = /<\/?[a-zA-Z][^\s>"'/]*(?:[^>"']|"[^"]*"|'[^']*')*>/g;

/** Elements that start a new line of text. */
const LINE_BREAKING = /^<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|figure|footer|h[1-6]|header|hr|li|ol|p|section|table|tbody|td|th|thead|tr|ul)\b/i;

/**
 * Replaces character references ("&uuml;", "&#252;", "&#xFC;"). Numeric
 * references count without their semicolon too, as browsers read them;
 * unknown names stay as they are.
 */
export function decodeEntities(text) {
    return String(text ?? "").replace(/&(?:(#x[0-9a-f]+|#\d+);?|([a-z][a-z0-9]*);)/gi, (match, numeric, name) => {
        if (numeric) {
            const hex = numeric[1] === "x" || numeric[1] === "X";
            const code = hex ? Number.parseInt(numeric.slice(2), 16) : Number.parseInt(numeric.slice(1), 10);
            return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
        }
        return Object.hasOwn(NAMED, name) ? NAMED[name] : match;
    });
}

/** Collapses every run of white space (including no-break spaces) to one space and trims. */
export function squash(text) {
    return String(text ?? "")
        .replace(/[\s\u00a0\u2000-\u200b\u202f]+/g, " ")
        .trim();
}

/** The HTML without scripts, styles and comments. */
export function withoutNoise(html) {
    return String(html ?? "")
        .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ");
}

function stripTags(html, replacement) {
    // Whatever the quote-aware pattern leaves behind (a tag with an unbalanced quote) goes with the plain one.
    return html.replace(TAG, replacement).replace(/<[a-zA-Z/][^>]*>/g, " ");
}

/** The visible text of a fragment: tags become spaces, references are decoded, white space collapses. */
export function textOf(html) {
    return squash(decodeEntities(stripTags(withoutNoise(html), " ")));
}

/** The visible text as lines: block elements and `<br>` start a new line; empty lines are dropped. */
export function linesOf(html) {
    return decodeEntities(stripTags(withoutNoise(html), (tag) => (LINE_BREAKING.test(tag) ? "\n" : " ")))
        .split("\n")
        .map(squash)
        .filter(Boolean);
}

const VOID = /^<(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b/i;
/** No element's own text is longer than this; a missing closing tag must not swallow the page. */
const MAX_INNER = 4000;

/**
 * Walks the content of the element whose opening tag ends at `from`: calls
 * `onText` for every run of text and stops at the element's own closing tag,
 * or as soon as `onText` returns true.
 */
function walkInner(html, from, onText) {
    const source = String(html ?? "");
    const limit = Math.min(source.length, from + MAX_INNER);
    const pattern = new RegExp(TAG.source, "g");
    pattern.lastIndex = from;
    let depth = 0;
    let cursor = from;
    for (let match = pattern.exec(source); match && match.index < limit; match = pattern.exec(source)) {
        if (onText(source.slice(cursor, match.index))) {
            return;
        }
        cursor = match.index + match[0].length;
        if (match[0].startsWith("</")) {
            depth -= 1;
            if (depth < 0) {
                return;
            }
        } else if (!VOID.test(match[0]) && !match[0].endsWith("/>")) {
            depth += 1;
        }
    }
    onText(source.slice(cursor, limit));
}

/** All text inside the element whose opening tag ends at `from`. */
export function innerText(html, from = 0) {
    let text = "";
    walkInner(html, from, (run) => {
        text += `${run} `;
        return false;
    });
    return squash(decodeEntities(text));
}

/** The first run of text inside the element whose opening tag ends at `from`: a title before its date, place and number. */
export function firstText(html, from = 0) {
    let first = "";
    walkInner(html, from, (run) => {
        first = squash(decodeEntities(run));
        return first !== "";
    });
    return first;
}

/**
 * The value of one attribute of an opening tag (`<a href="…">`), decoded;
 * null when the tag does not carry it.
 */
export function attrOf(tag, name) {
    const pattern = new RegExp(`[\\s"']${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
    const match = pattern.exec(String(tag ?? ""));
    if (!match) {
        return null;
    }
    return decodeEntities(match[1] ?? match[2] ?? match[3] ?? "");
}

/** Every opening tag of one element type with its position, e.g. all `<a …>`. */
export function openingTags(html, element) {
    const pattern = new RegExp(`<${element}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, "gi");
    return Array.from(String(html ?? "").matchAll(pattern), (match) => ({ tag: match[0], index: match.index, end: match.index + match[0].length }));
}

/** The class names of an opening tag, lower-cased. */
export function classesOf(tag) {
    return (attrOf(tag, "class") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

/** Absolute URL of `href` against the page it was found on, without its fragment; null when it is not an http(s) link. */
export function resolveUrl(href, pageUrl) {
    if (!href) {
        return null;
    }
    try {
        const url = new URL(href.trim(), pageUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }
        url.hash = "";
        return url.href;
    } catch {
        return null;
    }
}
