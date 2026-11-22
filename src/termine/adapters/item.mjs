// ITEM ("vhs-cms" by ITEM KG): the course system many Bavarian and some other
// Volkshochschulen run. A category page lists its courses; two template
// generations are in use and both carry the same three things per course:
//
//   - a link to the course (".../einbuergerungstest-5-26-675-C-2617425KG" in
//     the older template, "/kurs/<category path>/<title>/<number>" in the
//     newer one),
//   - an icon whose classes spell out the booking state
//     (`bk-icon bk-inperson bk-av-enough bk-rs-notbookableonline`), and
//   - the start as a German date with the time
//     ("Do. 17.09.2026 14:30", or `data-date="2026-09-25"`).
import { attrOf, classesOf, firstText, openingTags, resolveUrl, textOf, withoutNoise } from "../lib/html.mjs";
import { findDate, findTime, isDay } from "../lib/dates.mjs";
import { statusFromBookingClasses } from "../lib/status.mjs";

const MARKERS = /\bbk-icon\b|category-courses|-CAT-KAT\d|course-list-item/i;
const OLD_LINK = /-C-([A-Za-z0-9][A-Za-z0-9._-]*)\/?(?:[?#]|$)/;
const NEW_LINK = /\/kurs\/(?:[^/?#]+\/)+([A-Za-z0-9][A-Za-z0-9._-]*)\/?(?:[?#]|$)/;
const MAX_BLOCK = 20_000;

/** The course number and absolute URL a link points at, or null for any other link. */
export function courseLink(href, pageUrl) {
    if (!href || href.startsWith("#")) {
        return null;
    }
    const match = OLD_LINK.exec(href) ?? NEW_LINK.exec(href);
    const url = match ? resolveUrl(href, pageUrl) : null;
    return url ? { id: match[1], url } : null;
}

/** True when the page comes from an ITEM installation, whether or not it lists a course. */
export function isItemPage(html) {
    return MARKERS.test(String(html ?? ""));
}

/** One block per course: the template's own course container, else from one status icon to the next. */
function cutBlocks(html) {
    const containers = [...openingTags(html, "article"), ...openingTags(html, "div").filter(({ tag }) => classesOf(tag).includes("course-item"))]
        .map(({ index }) => index)
        .sort((a, b) => a - b);
    const starts = containers.length > 0 ? containers : openingTags(html, "a").filter(({ tag }) => courseLink(attrOf(tag, "href"), "https://example.invalid/")).map(({ index }) => index);
    return starts.map((start, position) => html.slice(start, Math.min(starts[position + 1] ?? html.length, start + MAX_BLOCK)));
}

/** First run of text in the first element of the block that carries one of the class names. */
function textOfClass(block, names) {
    for (const element of ["div", "span", "h2", "h3", "h4"]) {
        for (const { tag, end } of openingTags(block, element)) {
            if (classesOf(tag).some((name) => names.includes(name))) {
                const text = firstText(block, end);
                if (text) {
                    return text;
                }
            }
        }
    }
    return "";
}

function findWhen(block, title, today) {
    for (const { tag, end } of openingTags(block, "span")) {
        const day = attrOf(tag, "data-date");
        if (classesOf(tag).includes("start-date") && isDay(day)) {
            const clock = findTime(textOf(block.slice(end, end + 600)).replace(/^\S+/, ""));
            return { date: day, time: clock?.time ?? null, until: clock?.until ?? null };
        }
    }
    // The title may carry another date ("Anmeldung ab 25.11."), so the day is looked for behind it.
    const whole = textOf(block);
    const position = title ? whole.indexOf(title) : -1;
    const text = position < 0 ? whole : whole.slice(position + title.length);
    const day = findDate(text, 0, today);
    if (!day) {
        return null;
    }
    const clock = findTime(text.slice(day.end, day.end + 40));
    return { date: day.date, time: clock?.time ?? null, until: clock?.until ?? null };
}

/**
 * The courses an ITEM category page lists. `recognised` is false when the
 * page does not look like ITEM at all (moved, replaced, an error page).
 * `today` ("YYYY-MM-DD") lets dates printed without a year be read.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @param {{ today?: string | null }} [options]
 * @returns {{ recognised: boolean, courses: import("../lib/courses.mjs").Course[] }}
 */
export function parseItem(html, pageUrl, { today = null } = {}) {
    const page = withoutNoise(String(html ?? ""));
    if (!isItemPage(page)) {
        return { recognised: false, courses: [] };
    }
    const courses = [];
    const seen = new Set();
    for (const block of cutBlocks(page)) {
        const anchor = openingTags(block, "a").find(({ tag }) => courseLink(attrOf(tag, "href"), pageUrl));
        const icon = openingTags(block, "i").find(({ tag }) => classesOf(tag).includes("bk-icon"));
        if (!anchor || !icon) {
            continue;
        }
        const link = courseLink(attrOf(anchor.tag, "href"), pageUrl);
        const title = textOfClass(block, ["course-title"]);
        const when = findWhen(block, title, today);
        if (!link || !when || seen.has(link.id)) {
            continue;
        }
        seen.add(link.id);
        const classes = classesOf(icon.tag).filter((name) => name.startsWith("bk-") && name !== "bk-icon");
        const { status, booking } = statusFromBookingClasses(classes);
        courses.push({
            id: link.id,
            url: link.url,
            title,
            date: when.date,
            time: when.time,
            until: when.until,
            deadline: null,
            status,
            statusText: classes.join(" "),
            booking,
            place: textOfClass(block, ["course-list-item-location", "course-location", "course-place"]),
        });
    }
    return { recognised: true, courses };
}
