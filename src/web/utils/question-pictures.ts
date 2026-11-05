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
