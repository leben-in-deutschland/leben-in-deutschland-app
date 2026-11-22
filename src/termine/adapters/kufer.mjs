// Kufer ("KuferWEB", the web front end of KuferSQL): the course system most
// German Volkshochschulen run. One page - a category or the result of its
// keyword search - lists the courses; every installation carries its own
// template, so the adapter relies on what all of them share:
//
//   - a link to the course details that carries the course number
//     (".../kurs/Einbuergerungstest/YCW44803", ".../kurs/YCW44803",
//     ".../kurs/A212B024/kursname/...", ".../kurs/<title>/nr/2625030/...",
//     or "knr=YCW44803"),
//   - a "traffic light" for the booking status (class kw_ampel / ampelicon /
//     ampelbutton, or an image from the "kursampeln" folder) whose text or
//     title says what it means,
//   - the start as a German date, usually followed by the time.
//
// Blocks are cut at the template's own markers where they exist
// ("<!-- B12A-->", one per course) or at the rows of the course table.
import { attrOf, classesOf, firstText, innerText, linesOf, openingTags, resolveUrl, squash, textOf, withoutNoise } from "../lib/html.mjs";
import { findDate, findTime } from "../lib/dates.mjs";
import { bookingFromText, statusFromText } from "../lib/status.mjs";

const NUMBER = "[A-Za-z0-9][A-Za-z0-9._+-]*";
const LINKS = [
    new RegExp(`/kurs/(${NUMBER})/kursname/`),
    new RegExp(`/kurs/[^/?#]+/nr/(${NUMBER})(?:[/?#]|$)`),
    new RegExp(`/kurs/(?:[^/?#]+/)?(${NUMBER})/?(?:[?#]|$)`),
    new RegExp(`[?&;]knr=(${NUMBER})`),
];

const MARKERS = /kw-kurs|kw_ampel|kw-table-row|kw-kursuebersicht|hauptseite_kurse|kuferweb|<!--\s*B12A\s*-->/i;
const BLOCK_MARKER = /<!--\s*B12A\s*-->/g;
const BLOCK_END = /<!--\s*B12E\s*-->/;
const MAX_BLOCK = 12_000;
const NOWHERE = "https://example.invalid/";

/** Words in front of a date that make it a registration deadline, not the exam day. */
const DEADLINE = /(anmeldeschluss|anmeldefrist|anmeldung(en)? (bis|möglich bis)|anmelden bis|bis (zum|spätestens))\W{0,12}$/i;

const LIGHT = /^(kw[_-]ampel|k_ampel|ampelicon|ampelbutton|kw-kurs-status)$/;
/** Class names of the traffic light that say what it shows. */
const CLASS_HINTS = [
    [/^(k-)?nicht[_-]?buchbar$/, "nicht buchbar"],
    [/^(k-)?fast[_-]?ausgebucht$/, "fast ausgebucht"],
    [/^(k-)?warteliste$/, "Warteliste"],
    [/^(k-)?ausgebucht$/, "ausgebucht"],
    [/^(k-)?buchbar$/, "buchbar"],
];

const PLACE_LABEL = /^(Ort|Wo|Kursort|Veranstaltungsort)\s?:\s*(.*)$/i;
const ANY_LABEL = /^[A-ZÄÖÜ][\wäöüß. ]{1,24}:$/;

/** The course number and absolute URL a link points at, or null for any other link. */
export function courseLink(href, pageUrl) {
    if (!href) {
        return null;
    }
    for (const pattern of LINKS) {
        const match = pattern.exec(href);
        if (match) {
            const url = resolveUrl(href.replace(/ /g, "%20"), pageUrl);
            return url ? { id: match[1], url } : null;
        }
    }
    return null;
}

/** True when the page comes from a Kufer installation, whether or not it lists a course. */
export function isKuferPage(html) {
    return MARKERS.test(String(html ?? ""));
}

/** Scripts and styles go; comments go too, except the template's block markers. */
function clean(html) {
    const markers = [];
    const kept = html.replace(/<!--\s*B12[AE]\s*-->/g, (marker) => {
        markers.push(marker);
        return `\u0000${markers.length - 1}\u0000`;
    });
    return withoutNoise(kept).replace(/\u0000(\d+)\u0000/g, (_, index) => markers[Number(index)]);
}

function blockStarts(html) {
    const marked = Array.from(html.matchAll(BLOCK_MARKER), (match) => match.index);
    if (marked.length > 0) {
        return marked;
    }
    const rows = [...openingTags(html, "tr"), ...openingTags(html, "div")].filter(({ tag }) => classesOf(tag).includes("kw-table-row")).map(({ index }) => index);
    if (rows.length > 0) {
        return rows.sort((a, b) => a - b);
    }
    // No template marker: a block starts at the first link to each course.
    const seen = new Set();
    const starts = [];
    for (const { tag, index } of openingTags(html, "a")) {
        const link = courseLink(attrOf(tag, "href"), NOWHERE);
        if (link && !seen.has(link.id)) {
            seen.add(link.id);
            starts.push(index);
        }
    }
    return starts;
}

function cutBlocks(html) {
    const starts = blockStarts(html);
    return starts.map((start, position) => {
        const block = html.slice(start, Math.min(starts[position + 1] ?? html.length, start + MAX_BLOCK));
        const end = BLOCK_END.exec(block);
        return end ? block.slice(0, end.index) : block;
    });
}

/** First link to a course in the block: from an anchor, or from the row's `data-href`. */
function findLink(block, pageUrl) {
    const candidates = [
        ...openingTags(block, "a").map((found) => ({ ...found, href: attrOf(found.tag, "href") })),
        ...[...openingTags(block, "tr"), ...openingTags(block, "div")].map((found) => ({ ...found, href: attrOf(found.tag, "data-href") })),
    ].sort((a, b) => a.index - b.index);
    for (const { href } of candidates) {
        const link = courseLink(href, pageUrl);
        if (link) {
            return link;
        }
    }
    return null;
}

function findTitle(block, id) {
    for (const { tag, end } of openingTags(block, "a")) {
        if (courseLink(attrOf(tag, "href"), NOWHERE)?.id !== id) {
            continue;
        }
        const text = firstText(block, end);
        if (text) {
            return text;
        }
        const quoted = /['‚‘„“"]([^'’“”"]{3,})['’“”"]/.exec(attrOf(tag, "title") ?? "");
        if (quoted) {
            return squash(quoted[1]);
        }
    }
    for (const element of ["h2", "h3", "h4", "h5", "span", "div"]) {
        const heading = openingTags(block, element).find(({ tag }) => classesOf(tag).some((name) => name.includes("kurstitel")));
        if (heading) {
            return firstText(block, heading.end);
        }
    }
    return "";
}

/** What the traffic light says: its text, its title, or - as a last hint - its class. */
function findStatusText(block) {
    const lights = ["span", "div", "b", "p", "td", "a"]
        .flatMap((element) => openingTags(block, element))
        .filter(({ tag }) => classesOf(tag).some((name) => LIGHT.test(name)))
        .sort((a, b) => a.index - b.index);
    const hints = [];
    for (const { tag, end } of lights) {
        const said = innerText(block, end).replace(/^Status:?\s*/i, "") || textOf(attrOf(tag, "title") ?? "");
        if (said) {
            return said;
        }
        const hint = CLASS_HINTS.find(([pattern]) => classesOf(tag).some((name) => pattern.test(name)))?.[1];
        if (hint) {
            hints.push(hint);
        }
    }
    for (const { tag } of openingTags(block, "img")) {
        if (!/ampel/i.test(`${attrOf(tag, "src") ?? ""} ${attrOf(tag, "style") ?? ""}`)) {
            continue;
        }
        const said = textOf(attrOf(tag, "alt") ?? "") || textOf(attrOf(tag, "title") ?? "");
        if (said) {
            return said;
        }
    }
    return hints[0] ?? "";
}

/**
 * The exam day (the first date that is not a deadline), its time, and the
 * deadline when the block names one. The title is left out first: it may
 * carry another date ("Anmeldung ab Mi., 25.11. möglich"); only when the
 * block shows no other date does a date in the title count.
 */
function findWhen(block, title, today) {
    const text = textOf(block);
    const position = title ? text.indexOf(title) : -1;
    const rest = position < 0 ? text : `${text.slice(0, position)} ${text.slice(position + title.length)}`;
    return whenIn(rest, today) ?? (position < 0 || /anmeld/i.test(title) ? null : whenIn(title, today));
}

function whenIn(text, today) {
    let day = null;
    let deadline = null;
    let from = 0;
    for (;;) {
        const found = findDate(text, from, today);
        if (!found) {
            break;
        }
        if (DEADLINE.test(text.slice(Math.max(0, found.index - 60), found.index))) {
            deadline ??= found.date;
        } else if (!day) {
            day = found;
        }
        from = found.end;
    }
    if (!day) {
        return null;
    }
    const clock = findTime(text.slice(day.end, day.end + 60));
    return { date: day.date, time: clock?.time ?? null, until: clock?.until ?? null, deadline };
}

/** Where the exam takes place: the table's "Ort" cell, or the value after an "Ort:" / "Wo:" label. */
function findPlace(block, headers) {
    for (const { tag, end } of openingTags(block, "td")) {
        const column = headers.get(attrOf(tag, "headers") ?? "") ?? "";
        if (/-ort$/.test(attrOf(tag, "id") ?? "") || /^(ort|wo|kursort|veranstaltungsort)\b/i.test(column)) {
            const closing = block.indexOf("</td", end);
            return textOf(block.slice(end, closing < 0 ? end + 300 : closing));
        }
    }
    const lines = linesOf(block);
    for (let index = 0; index < lines.length; index++) {
        const match = PLACE_LABEL.exec(lines[index]);
        if (match) {
            const next = lines[index + 1] ?? "";
            return match[2] || (ANY_LABEL.test(next) ? "" : next);
        }
    }
    return "";
}

/** Column labels of the course table by header id ("kue-columnheader4" -> "Ort"). */
function tableHeaders(page) {
    const headers = new Map();
    for (const { tag, end } of openingTags(page, "th")) {
        const id = attrOf(tag, "id");
        if (id) {
            const closing = page.indexOf("</th", end);
            headers.set(id, textOf(page.slice(end, closing < 0 ? end + 200 : closing)));
        }
    }
    return headers;
}

/**
 * The courses a Kufer page lists. `recognised` is false when the page does
 * not look like Kufer at all (moved, replaced, an error page), so the caller
 * can tell "no exam listed" from "this is no longer the page we knew".
 * `today` ("YYYY-MM-DD") lets dates printed without a year be read.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @param {{ today?: string | null }} [options]
 * @returns {{ recognised: boolean, courses: import("../lib/courses.mjs").Course[] }}
 */
export function parseKufer(html, pageUrl, { today = null } = {}) {
    const page = clean(String(html ?? ""));
    if (!isKuferPage(page)) {
        return { recognised: false, courses: [] };
    }
    const headers = tableHeaders(page);
    const courses = [];
    const seen = new Set();
    for (const block of cutBlocks(page)) {
        const link = findLink(block, pageUrl);
        if (!link || seen.has(link.id)) {
            continue;
        }
        const title = findTitle(block, link.id);
        const when = findWhen(block, title, today);
        if (!when) {
            continue;
        }
        seen.add(link.id);
        const statusText = findStatusText(block);
        courses.push({
            id: link.id,
            url: link.url,
            title,
            date: when.date,
            time: when.time,
            until: when.until,
            deadline: when.deadline,
            status: statusFromText(statusText),
            statusText,
            booking: bookingFromText(statusText),
            place: findPlace(block, headers),
        });
    }
    return { recognised: true, courses };
}
