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
// ("<!-- B12A-->", one per course) or at the rows of the course table;
// without either, around the links to one course (see `cutByLinks`).
import { attrOf, classesOf, firstText, innerText, linesOf, openingTags, resolveUrl, squash, tagsOf, textOf, withoutNoise } from "../lib/html.mjs";
import { findExamDay } from "../lib/dates.mjs";
import { bookingFromText, statusFromText, titleVerdict } from "../lib/status.mjs";

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
/** How far in front of a course's link its traffic light may stand. */
const MAX_LEAD = 2_000;
const NOWHERE = "https://example.invalid/";

const LIGHT = /^(kw[_-]ampel|k_ampel|ampelicon|ampelbutton|kw-kurs-status)$/;
const LIGHT_ELEMENTS = ["span", "div", "b", "p", "td", "a"];
/**
 * Elements that hold one course of a list: a card, a row, a list item.
 * Elements whose end tag may be left out (p, td) are not counted.
 */
const CONTAINER = /^<\/?(?:div|article|section|li|tr|table|tbody|ul|ol|dl|header|footer|aside|figure|form)\b/i;
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
/** Class names of the link that is the course's heading ("kw-kurstitel", "card-title"). */
const TITLE_CLASS = /(^|[-_])(kurs)?(titel|title)$/;
/** Class names of an element that holds the course's name where the link does not ("kw-title", "card-title", "kurs-name"). */
const NAME_CLASS = /(^|[-_])((kurs)?(titel|title)|kurs-?name)$/;
const NAME_ELEMENTS = ["h1", "h2", "h3", "h4", "h5", "h6", "div", "span", "strong"];

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

/** The traffic lights of a piece of the page in document order: the template's light elements and the images from its "kursampeln" folder. */
function lightsOf(html) {
    const elements = LIGHT_ELEMENTS.flatMap((element) => openingTags(html, element)).filter(({ tag }) => classesOf(tag).some((name) => LIGHT.test(name)));
    const images = openingTags(html, "img").filter(({ tag }) => /ampel/i.test(`${attrOf(tag, "src") ?? ""} ${attrOf(tag, "style") ?? ""}`));
    return [...elements.map((light) => ({ ...light, image: false })), ...images.map((light) => ({ ...light, image: true }))].sort((a, b) => a.index - b.index);
}

/**
 * One course's piece of the page. `lights` is the part of it whose traffic
 * lights are the course's own for certain; with `unanimous`, they count only
 * when they all say the same.
 * @typedef {{ html: string, lights: string, unanimous: boolean }} Block
 */

function sliceBlocks(html, starts) {
    return starts.map((start, position) => {
        const block = html.slice(start, Math.min(starts[position + 1] ?? html.length, start + MAX_BLOCK));
        const end = BLOCK_END.exec(block);
        return end ? block.slice(0, end.index) : block;
    });
}

/**
 * Where the nesting of containers is lowest between two links: there one
 * course's container has closed and the next has not opened yet. `first`
 * and `last` differ when elements stand between the two containers. Null
 * when no container closes on the way: the links are siblings.
 */
function gapBetween(html, from, to) {
    let depth = 0;
    let low = 0;
    let first = -1;
    let last = -1;
    for (const { tag, end } of tagsOf(html, from, to)) {
        if (!CONTAINER.test(tag)) {
            continue;
        }
        if (tag.startsWith("</")) {
            depth -= 1;
            if (depth < low) {
                low = depth;
                first = end;
                last = end;
            } else if (depth === low && low < 0) {
                last = end;
            }
        } else if (!tag.endsWith("/>")) {
            depth += 1;
        }
    }
    return low < 0 ? { first, last, low } : null;
}

/** Where the container starts whose closing tag ends at `close`; -1 when it does not start behind `floor`. */
function containerStart(html, floor, close) {
    const tags = tagsOf(html, floor, close).filter(({ tag }) => CONTAINER.test(tag));
    let depth = 0;
    for (let position = tags.length - 1; position >= 0; position--) {
        const { tag, index } = tags[position];
        if (tag.startsWith("</")) {
            depth += 1;
        } else if (!tag.endsWith("/>")) {
            depth -= 1;
            if (depth === 0) {
                return index;
            }
        }
    }
    return -1;
}

/** Where the container around `from` ends that reaches `low` levels up; `limit` when it does not end before. */
function containerEnd(html, from, limit, low) {
    let depth = 0;
    for (const { tag, end } of tagsOf(html, from, limit)) {
        if (!CONTAINER.test(tag)) {
            continue;
        }
        if (tag.startsWith("</")) {
            depth -= 1;
            if (depth <= low) {
                return end;
            }
        } else if (!tag.endsWith("/>")) {
            depth += 1;
        }
    }
    return limit;
}

/**
 * No template marker: a block is cut around the links to one course.
 *
 * Where each course sits in a container of its own (a card, a table row, a
 * list item), the block is that container - whatever comes first in it, the
 * link, the date or the traffic light. Where the links are siblings, or
 * elements stand between two containers, the edges of the list say where
 * such a piece belongs: lights in front of the first link and none behind
 * the last one mean "light, then link", the other way round "link, then
 * light". On a page that fits neither (a legend of lights, say) such pieces
 * belong to no course, and only the lights between a course's own links
 * are read - a light must never be taken for the neighbouring course.
 *
 * @returns {Block[]}
 */
function cutByLinks(html) {
    const courses = [];
    const seen = new Set();
    let current = null;
    for (const { tag, index } of openingTags(html, "a")) {
        const id = courseLink(attrOf(tag, "href"), NOWHERE)?.id;
        if (!id) {
            continue;
        }
        if (current?.id === id) {
            current.last = index;
        } else if (!seen.has(id)) {
            seen.add(id);
            current = { id, first: index, last: index };
            courses.push(current);
        }
    }
    if (courses.length === 0) {
        return [];
    }
    const lights = lightsOf(html).map(({ index }) => index);
    const head = courses[0];
    const tail = courses[courses.length - 1];
    const before = lights.some((at) => at < head.first && at >= head.first - MAX_LEAD);
    const after = lights.some((at) => at > tail.last && at < tail.first + MAX_BLOCK);
    const lightFirst = before && !after;
    const linkFirst = after && !before;
    const gaps = courses.slice(0, -1).map((course, position) => gapBetween(html, course.last, courses[position + 1].first));
    /** The first light in front of a course's links, behind `floor`. */
    const lightBefore = (course, floor) => lights.find((at) => at >= Math.max(floor, course.first - MAX_LEAD) && at < course.first);

    const pieces = courses.map((course, position) => {
        const isLast = position === courses.length - 1;
        const left = position > 0 ? gaps[position - 1] : null;
        const right = isLast ? null : gaps[position];
        const floor = position > 0 ? courses[position - 1].last + 1 : 0;
        // The course's own container, known from where it closes in front of the next course.
        const own = right ? containerStart(html, Math.max(floor, course.first - MAX_BLOCK), right.first) : -1;
        const hasOwn = own >= 0 && own <= course.first;

        let start = course.first;
        if (left) {
            // What stands between two containers goes to the course behind it only on a "light, then link" page.
            start = lightFirst ? left.first : Math.max(left.last, hasOwn ? own : -1);
        } else {
            if (position === 0 && hasOwn) {
                start = own;
            }
            if (lightFirst) {
                start = Math.min(start, lightBefore(course, floor) ?? start);
            }
        }
        // A block must reach its own link: what lies far in front of it is another part of the page.
        if (course.first - start > MAX_BLOCK / 2) {
            start = hasOwn && course.first - own <= MAX_BLOCK / 2 ? own : course.first;
        }

        let end = -1;
        if (right) {
            end = linkFirst ? right.last : right.first;
        } else if (isLast) {
            const limit = Math.min(html.length, course.last + MAX_BLOCK);
            end = left && !linkFirst ? containerEnd(html, course.last, limit, left.low) : limit;
        }
        const bounded = (left ? true : position === 0 && hasOwn) && Boolean(right || (isLast && left));
        return { course, start, end, certain: bounded || lightFirst || linkFirst };
    });
    return pieces.map((piece, position) => {
        // Between sibling links a block runs up to the next one.
        const end = piece.end < 0 ? pieces[position + 1].start : piece.end;
        const marked = html.slice(piece.start, Math.max(piece.start, Math.min(end, piece.start + MAX_BLOCK)));
        const cut = BLOCK_END.exec(marked);
        const block = cut ? marked.slice(0, cut.index) : marked;
        // Without a container or a clear order, only the lights between the course's own links are its own.
        const own = block.slice(Math.max(0, piece.course.first - piece.start), Math.max(0, piece.course.last - piece.start));
        return { html: block, lights: piece.certain ? block : own, unanimous: true };
    });
}

/** @returns {Block[]} */
function cutBlocks(html) {
    let starts = Array.from(html.matchAll(BLOCK_MARKER), (match) => match.index);
    if (starts.length === 0) {
        starts = [...openingTags(html, "tr"), ...openingTags(html, "div")]
            .filter(({ tag }) => classesOf(tag).includes("kw-table-row"))
            .map(({ index }) => index)
            .sort((a, b) => a - b);
    }
    if (starts.length === 0) {
        return cutByLinks(html);
    }
    return sliceBlocks(html, starts).map((block) => ({ html: block, lights: block, unanimous: false }));
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

/** True for the link that is the course's heading: inside <h1> to <h6>, or with the template's title class. */
function isHeadingLink(block, { tag, index }) {
    return classesOf(tag).some((name) => TITLE_CLASS.test(name)) || /<h[1-6]\b[^>]{0,300}>\s*$/i.test(block.slice(Math.max(0, index - 320), index));
}

function findTitle(block, id) {
    const links = openingTags(block, "a").filter(({ tag }) => courseLink(attrOf(tag, "href"), NOWHERE)?.id === id);
    // The heading names the course; another link to it may be a button ("Kursinfo beachten").
    const headings = links.filter((link) => isHeadingLink(block, link));
    const named = NAME_ELEMENTS.flatMap((element) => openingTags(block, element))
        .filter(({ tag }) => classesOf(tag).some((name) => NAME_CLASS.test(name)))
        .sort((a, b) => a.index - b.index);
    const nameIn = (from, to) => {
        for (const { index, end } of named) {
            const text = index >= from && index < to ? firstText(block, end) : "";
            if (text) {
                return text;
            }
        }
        return "";
    };
    for (const link of [...headings, ...links.filter((entry) => !headings.includes(entry))]) {
        if (!headings.includes(link)) {
            // A link that is the whole card ("Fr. | 18.12.2026 ... <h3 class="card-title">") is named by the
            // heading inside it, a button ("Kursdetails anzeigen") by the name the template prints above it.
            const closing = block.slice(link.end).search(/<\/a\s*>/i);
            const button = classesOf(link.tag).some((name) => /^(btn|button)$/.test(name));
            const name = nameIn(link.end, closing < 0 ? link.end : link.end + closing) || (button ? nameIn(0, link.index) : "");
            if (name) {
                return name;
            }
        }
        const text = firstText(block, link.end);
        if (text) {
            return text;
        }
        const quoted = /['‚‘„“"]([^'’“”"]{3,})['’“”"]/.exec(attrOf(link.tag, "title") ?? "");
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

/**
 * What the traffic lights of `html` say: a light's text or its title, an
 * image's alt text and - as a last hint - a light's class. The first entry
 * is the one that counts. With `unanimous`, lights that disagree say nothing.
 */
function findStatusText(html, unanimous) {
    const said = [];
    const shown = [];
    const hints = [];
    for (const { tag, end, image } of lightsOf(html)) {
        if (image) {
            const text = textOf(attrOf(tag, "alt") ?? "") || textOf(attrOf(tag, "title") ?? "");
            if (text) {
                shown.push(text);
            }
            continue;
        }
        const text = innerText(html, end).replace(/^Status:?\s*/i, "") || textOf(attrOf(tag, "title") ?? "");
        if (text) {
            said.push(text);
            continue;
        }
        const hint = CLASS_HINTS.find(([pattern]) => classesOf(tag).some((name) => pattern.test(name)))?.[1];
        if (hint) {
            hints.push(hint);
        }
    }
    const texts = [...said, ...shown, ...hints];
    if (unanimous && new Set(texts.map(statusFromText)).size > 1) {
        return "";
    }
    return texts[0] ?? "";
}

/**
 * What a link to the course says in its tooltip, when that is a verdict
 * ("Der Termin ist ausgebucht. Keine Anmeldung mehr möglich."). Like a
 * title, a tooltip can close a date but never open one.
 */
function findTooltipVerdict(block, id) {
    for (const { tag } of openingTags(block, "a")) {
        if (courseLink(attrOf(tag, "href"), NOWHERE)?.id !== id) {
            continue;
        }
        const tooltip = textOf(attrOf(tag, "title") ?? "");
        if (tooltip && titleVerdict(tooltip)) {
            return tooltip;
        }
    }
    return "";
}

/**
 * The exam day, its time and the registration deadline (see `findExamDay`).
 * The title is left out first: it may carry another date ("Anmeldung ab
 * Mi., 25.11. möglich"); only when the block shows no other date does a
 * date in the title count.
 */
function findWhen(block, title, today) {
    const text = textOf(block);
    const position = title ? text.indexOf(title) : -1;
    const rest = position < 0 ? text : `${text.slice(0, position)} ${text.slice(position + title.length)}`;
    return findExamDay(rest, today) ?? (position < 0 || /anmeld/i.test(title) ? null : findExamDay(title, today));
}

/** A place without the label some templates repeat for screen readers (", Ort: vhs, Saal"). */
function tidyPlace(text) {
    return squash(
        String(text ?? "")
            .replace(/^[\s,;:–-]+/, "")
            .replace(/^(Ort|Wo|Kursort|Veranstaltungsort)\s*:\s*/i, ""),
    );
}

/** Where the exam takes place: the table's "Ort" cell, or the value after an "Ort:" / "Wo:" label. */
function findPlace(block, headers) {
    for (const { tag, end } of openingTags(block, "td")) {
        const column = headers.get(attrOf(tag, "headers") ?? "") ?? "";
        if (/-ort$/.test(attrOf(tag, "id") ?? "") || /^(ort|wo|kursort|veranstaltungsort)\b/i.test(column)) {
            const closing = block.indexOf("</td", end);
            return tidyPlace(textOf(block.slice(end, closing < 0 ? end + 300 : closing)));
        }
    }
    const lines = linesOf(block);
    for (let index = 0; index < lines.length; index++) {
        const match = PLACE_LABEL.exec(lines[index]);
        if (match) {
            const next = lines[index + 1] ?? "";
            return tidyPlace(match[2] || (ANY_LABEL.test(next) ? "" : next));
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
            const cell = page.slice(end, end + 400);
            const closing = cell.indexOf("</th");
            headers.set(id, textOf(closing < 0 ? cell.slice(0, 200) : cell.slice(0, closing)));
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
    for (const { html: block, lights, unanimous } of cutBlocks(page)) {
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
        const said = findStatusText(lights, unanimous);
        let status = statusFromText(said);
        let statusText = said;
        const tooltip = status === "closed" ? "" : findTooltipVerdict(block, link.id);
        if (tooltip) {
            status = titleVerdict(tooltip) ?? status;
            statusText = tooltip;
        }
        courses.push({
            id: link.id,
            url: link.url,
            title,
            date: when.date,
            time: when.time,
            until: when.until,
            deadline: when.deadline,
            status,
            statusText,
            booking: bookingFromText(said),
            place: findPlace(block, headers),
        });
    }
    return { recognised: true, courses };
}
