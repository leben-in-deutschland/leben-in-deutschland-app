// Text normalisation and matching helpers shared by extract.mjs and
// compare.mjs. Normalised text is only used to compare; the catalogue and
// the proposal keep the original wording.

const CHECKBOX_GLYPHS = /^[\uf0a3\u25a1\u25a2\u2610]\s*/u;
const QUOTES = /[\u201e\u201c\u201d\u201a\u2018\u2019\u00ab\u00bb\u2039\u203a"']/g;
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015]/g;

/** True when a catalogue line starts with the answer checkbox (Wingdings box or U+25A1). */
export function isAnswerLine(text) {
    return CHECKBOX_GLYPHS.test(text);
}

/** The answer text without its checkbox glyph. */
export function stripCheckbox(text) {
    return text.replace(CHECKBOX_GLYPHS, "").trim();
}

/** Tidies extracted text: NFC, plain spaces, one ellipsis character. */
export function cleanText(text) {
    return text
        .normalize("NFC")
        .replace(/\u00a0/g, " ")
        .replace(/\.\.\./g, "\u2026")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Comparison form: NFKC, lower case, unified quotes/dashes/ellipsis, no
 * punctuation, single spaces. "Deutschland ist …" and "Deutschland ist..."
 * normalise to the same string.
 */
export function normalise(text) {
    return (text ?? "")
        .normalize("NFKC")
        .replace(/\.\.\./g, "\u2026")
        .replace(QUOTES, '"')
        .replace(DASHES, "-")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function tokens(text) {
    return new Set(normalise(text).split(" ").filter(Boolean));
}

/** Jaccard similarity of two token sets (1 = identical, 0 = disjoint). */
export function jaccard(a, b) {
    if (a.size === 0 && b.size === 0) {
        return 1;
    }
    let shared = 0;
    for (const token of a) {
        if (b.has(token)) {
            shared++;
        }
    }
    return shared / (a.size + b.size - shared);
}

function levenshtein(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previous = row;
    }
    return previous[b.length];
}

/**
 * Similarity of two answer texts in 0..1: the token Jaccard, or for short
 * answers the character-level ratio. Texts whose digits differ ("1949" vs
 * "1945") never count as similar.
 */
export function similarity(a, b) {
    const left = normalise(a);
    const right = normalise(b);
    if (left === right) {
        return 1;
    }
    if (left.replace(/\D/g, "") !== right.replace(/\D/g, "")) {
        return 0;
    }
    const byTokens = jaccard(new Set(left.split(" ")), new Set(right.split(" ")));
    const longest = Math.max(left.length, right.length);
    const byCharacters = longest === 0 ? 1 : 1 - levenshtein(left, right) / longest;
    return Math.max(byTokens, byCharacters);
}

/** Number of answers whose normalised text occurs in both lists (order-insensitive). */
export function sharedAnswers(a, b) {
    const pool = new Set(b.map(normalise));
    return a.map(normalise).filter((answer) => pool.has(answer)).length;
}

/** The scope a question number belongs to: "general" or the state code ("BW", ...). */
export function scopeOf(num) {
    const match = /^([A-Z]{2})-\d+$/.exec(num);
    return match ? match[1] : "general";
}
