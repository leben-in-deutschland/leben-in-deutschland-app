// cmx ("cmxOrganize" by cmxKonzepte): the course system of many
// Volkshochschulen in Bavaria and Baden-Württemberg and of some further
// north. A page of the programme lists its events as teasers, one list item
// each, and every item carries the same things:
//
//   - a link to the event ("/Veranstaltung/cmx68f7902a5beb9.html"),
//   - the name and the course number (`span.Name`, `span.Nummer`),
//   - the start as a short German date with the time (`span.Datum`
//     "03.03.26", `span.UhrzeitBeginn` "18:00", `span.UhrzeitEnde`
//     "- 19:00"),
//   - the place (`div.Ort`), and
//   - a traffic light whose text says what is left (`div.Ampeltext`:
//     "(Plätze frei)", "(noch 1 Platz frei)", "(keine freien Plätze.
//     Anmeldung auf Warteliste möglich.)"); some installations show none.
//     The item's own classes add what the light does not say: "Beendet",
//     "Ausgefallen".
import { attrOf, classesOf, firstText, openingTags, resolveUrl, squash, textOf, withoutNoise } from "../lib/html.mjs";
import { findExamDay } from "../lib/dates.mjs";
import { statusFromText } from "../lib/status.mjs";

const MARKERS = /\/cmx\/ordner\/|cmx_ajaxcontainer|\bVeranstaltungTeaserInhalt\b/;
const LINK = /\/Veranstaltung\/([A-Za-z0-9][A-Za-z0-9._-]*?)(?:\.html?)?\/?(?:[?#]|$)/;
const MAX_BLOCK = 12_000;
const OVER = ["beendet", "ausgefallen", "abgesagt"];

/** The event's id and absolute URL a link points at, or null for any other link. */
export function courseLink(href, pageUrl) {
    const match = href ? LINK.exec(href) : null;
    const url = match ? resolveUrl(href, pageUrl) : null;
    return url ? { id: match[1], url } : null;
}

/** True when the page comes from a cmx installation, whether or not it lists an event. */
export function isCmxPage(html) {
    return MARKERS.test(String(html ?? ""));
}

/** The parts of a teaser, by the class of the `div` that opens each. */
const SECTIONS = ["zeit", "ort", "ampelanzeige"];

/** The text of the first element in the block that carries the class name (lower-cased, as `classesOf` reads it). */
function textOfClass(block, name, elements = ["span", "div", "strong"]) {
    const found = elements
        .flatMap((element) => openingTags(block, element))
        .filter(({ tag }) => classesOf(tag).includes(name))
        .sort((a, b) => a.index - b.index)[0];
    return found ? firstText(block, found.end) : "";
}

/** One part of the teaser: from the `div` with the class name to the next part. */
function sectionOf(block, name) {
    const parts = openingTags(block, "div").filter(({ tag }) => SECTIONS.some((section) => classesOf(tag).includes(section)));
    const position = parts.findIndex(({ tag }) => classesOf(tag).includes(name));
    return position < 0 ? "" : block.slice(parts[position].end, parts[position + 1]?.index ?? block.length);
}

/**
 * What the traffic light says. The system prints "noch 2 Plätze frei" only
 * once an event is nearly full - its light then shows three quarters - so
 * that is "few", whatever the number. "Keine freien Plätze" without a
 * waiting list is full; an event that is over or cancelled is closed
 * whatever its light still shows.
 */
function statusOf(said, itemClasses) {
    if (itemClasses.some((name) => OVER.includes(name))) {
        return "closed";
    }
    const value = said.toLowerCase();
    const left = /\bnoch (\d+) pl(ä|a)tz/.exec(value);
    if (left) {
        return Number(left[1]) > 0 ? "few" : "full";
    }
    if (/\bkeine freien pl(ä|a)tze\b/.test(value) && !/warteliste/.test(value)) {
        return "full";
    }
    return statusFromText(value);
}

/**
 * The events a cmx page lists. `recognised` is false when the page does not
 * look like cmx at all (moved, replaced, an error page). `today`
 * ("YYYY-MM-DD") lets dates printed without a year be read.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @param {{ today?: string | null }} [options]
 * @returns {{ recognised: boolean, courses: import("../lib/courses.mjs").Course[] }}
 */
export function parseCmx(html, pageUrl, { today = null } = {}) {
    const page = withoutNoise(String(html ?? ""));
    if (!isCmxPage(page)) {
        return { recognised: false, courses: [] };
    }
    // A teaser is a list item in a list of events and a `div` under the heading of a part of the programme.
    const items = ["li", "div"]
        .flatMap((element) => openingTags(page, element))
        .filter(({ tag }) => ["veranstaltung", "teaser"].every((name) => classesOf(tag).includes(name)))
        .sort((a, b) => a.index - b.index);
    const courses = [];
    const seen = new Set();
    items.forEach(({ tag, index }, position) => {
        const whole = page.slice(index, Math.min(items[position + 1]?.index ?? page.length, index + MAX_BLOCK));
        const anchor = openingTags(whole, "a").find(({ tag: link }) => courseLink(attrOf(link, "href"), pageUrl));
        if (!anchor) {
            return;
        }
        // The teaser is one link around everything it shows.
        const closing = whole.slice(anchor.end).search(/<\/a\s*>/i);
        const block = closing < 0 ? whole : whole.slice(0, anchor.end + closing);
        const link = courseLink(attrOf(anchor.tag, "href"), pageUrl);
        const when = findExamDay(textOf(sectionOf(block, "zeit")), today);
        if (!link || !when || seen.has(link.id)) {
            return;
        }
        seen.add(link.id);
        const light = sectionOf(block, "ampelanzeige");
        const said = squash((textOfClass(light, "ampeltext", ["div"]) || (attrOf(openingTags(light, "span")[0]?.tag ?? "", "title") ?? "")).replace(/^\(|\)$/g, ""));
        courses.push({
            id: link.id,
            url: link.url,
            title: textOfClass(block, "name", ["span"]) || squash(attrOf(anchor.tag, "title") ?? ""),
            date: when.date,
            time: when.time,
            until: when.until,
            deadline: when.deadline,
            status: statusOf(said, classesOf(tag)),
            statusText: said,
            booking: null,
            place: textOf(sectionOf(block, "ort")),
        });
    });
    return { recognised: true, courses };
}
