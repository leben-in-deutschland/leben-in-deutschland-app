import { siteConfig } from "@/config/site";
import questionsJson from "@/data/questions-core.json";

/**
 * Question pictures in the catalogue file (TASK-077 follow-up).
 *
 * `data/question.json` points a picture question at its bundled file,
 * `/questions/<num>.webp`. Apps up to 2.1.25 do not bundle those files but
 * download `questions-core.json` every day (ADR-006), so
 * `scripts/split-questions.js` writes absolute URLs on the public website
 * there (`https://www.lebenindeutschland.org/questions/<num>.webp`): old
 * builds load the picture from the project's own site, and this build maps
 * every such URL back to its bundled file, so the picture works offline and
 * costs no request.
 *
 * Only pictures this build bundles are mapped: a picture a later catalogue
 * adds stays an absolute URL and still loads from the website.
 */

/** Origin of the deployed website, e.g. `https://www.lebenindeutschland.org`. */
export const PICTURE_ORIGIN = new URL(siteConfig.links.website).origin;

const PICTURE_PATH = /^\/questions\/[A-Za-z0-9-]+\.webp$/;

/** Root-relative paths of the pictures this build ships under public/questions. */
const bundledPaths: ReadonlySet<string> = new Set(
    (questionsJson as { image: string }[]).map((question) => toPicturePath(question.image)).filter((image): image is string => image !== null),
);

/** `/questions/<num>.webp` for a root-relative or website URL of a question picture, otherwise null. */
function toPicturePath(image: string): string | null {
    if (PICTURE_PATH.test(image)) {
        return image;
    }
    if (!image.startsWith(`${PICTURE_ORIGIN}/`)) {
        return null;
    }
    const pathname = image.slice(PICTURE_ORIGIN.length);
    return PICTURE_PATH.test(pathname) ? pathname : null;
}

/** The website URL of a bundled picture path, as the catalogue file carries it for apps up to 2.1.25. */
export function websitePicture(path: string): string {
    return PICTURE_PATH.test(path) ? `${PICTURE_ORIGIN}${path}` : path;
}

/** The image to show: the bundled file for a picture this build ships, anything else unchanged. */
export function bundledPicture(image: string): string {
    const path = toPicturePath(image);
    return path !== null && bundledPaths.has(path) ? path : image;
}

/** The catalogue with its pictures pointing at the bundled files where this build has them; the same array when nothing maps. */
export function withBundledPictures<T extends { image: string }>(questions: T[]): T[] {
    let changed = false;
    const mapped = questions.map((question) => {
        const image = bundledPicture(question.image);
        if (image === question.image) {
            return question;
        }
        changed = true;
        return { ...question, image };
    });
    return changed ? mapped : questions;
}

/**
 * Official caption of the n-th of four pictures: "Bild 1" .. "Bild 4" under four
 * pictures, or the bare "1" .. "4" of the numbered parts of one picture (the
 * ballot papers of question 212, the state maps of the *-8 and *-10 questions).
 * Both read as "Bild <n>", the way `src/catalogue/compare.mjs` matches them.
 */
const PICTURE_CAPTION = /^(?:Bild\s*)?([1-4])$/;

/**
 * Alt text of a question picture: the generic label plus the question number, so
 * a screen reader tells one picture from the next, and - when the answers are
 * the official captions of four pictures or of four numbered parts of one
 * picture - those captions, so the listener knows the picture holds "Bild 1" ..
 * "Bild 4" and which answer names which picture.
 *
 * `numberLabel` replaces "Frage <catalogue number>", e.g. with the mock exam's
 * "Frage 4", which like the official test sheet shows no catalogue number.
 */
export function questionImageAlt(
    question: { num: string; a: string; b: string; c: string; d: string },
    t: Readonly<Record<string, string | undefined>>,
    numberLabel?: string,
): string {
    const number = numberLabel ?? (t.question_number_label ? `${t.question_number_label} ${question.num}` : question.num);
    const label = t.question_image_alt ? `${t.question_image_alt} (${number})` : number;
    const numbers = [question.a, question.b, question.c, question.d].map((caption) => PICTURE_CAPTION.exec(String(caption ?? "").trim())?.[1]);
    const captioned = numbers.every((number, index) => number === String(index + 1));
    return captioned ? `${label}: ${numbers.map((number) => `Bild ${number}`).join(", ")}` : label;
}
