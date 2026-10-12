// pdf.js helpers: loads pdfjs-dist from src/web/node_modules, reads the
// document info, rebuilds text lines from positioned glyph runs, and
// collects the decoded images of a page with their position on the page
// (tracked through the content stream's transformation matrix).
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const webRoot = path.resolve(here, "../../web");

let pdfjsPromise;

/** The legacy (Node-compatible) pdf.js build, loaded once. */
export function loadPdfjs() {
    pdfjsPromise ??= (async () => {
        const require = createRequire(path.join(webRoot, "package.json"));
        let entry;
        try {
            entry = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
        } catch {
            throw new Error("pdfjs-dist is not installed; run `npm ci` in src/web");
        }
        return import(pathToFileURL(entry).href);
    })();
    return pdfjsPromise;
}

/** Opens a PDF from a Buffer; `close()` releases the worker when done. */
export async function openPdf(buffer) {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({
        // A copy: pdf.js transfers the array to its worker, which would detach the caller's buffer.
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
        verbosity: 0,
    });
    const doc = await task.promise;
    return { pdfjs, doc, close: () => task.destroy() };
}

/** Title, ModDate, page count, and the `Stand: dd.mm.yyyy` date from the title. */
export async function readInfo(doc) {
    const { info } = await doc.getMetadata();
    const title = info?.Title ?? "";
    const stand = /Stand:\s*(\d{2}\.\d{2}\.\d{4})/.exec(title)?.[1] ?? null;
    return { title, modDate: info?.ModDate ?? null, pages: doc.numPages, stand };
}

const LINE_TOLERANCE = 2;

/**
 * Rebuilds the text lines of a page from pdf.js text items. Items are
 * grouped by baseline (within 2 pt), ordered left to right, and joined with
 * a space wherever the glyph runs do not touch. Lines come back top to
 * bottom as `{ y, x, text }` in PDF user space (origin bottom-left).
 */
export async function readLines(page) {
    const content = await page.getTextContent();
    const rows = [];
    for (const item of content.items) {
        if (!item.str || !item.transform) {
            continue;
        }
        const x = item.transform[4];
        const y = item.transform[5];
        let row = rows.find((candidate) => Math.abs(candidate.y - y) <= LINE_TOLERANCE);
        if (!row) {
            row = { y, items: [] };
            rows.push(row);
        }
        row.items.push({ x, width: item.width ?? 0, str: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map((row) => {
        row.items.sort((a, b) => a.x - b.x);
        let text = "";
        let end = null;
        for (const item of row.items) {
            if (end !== null && item.x - end > 1 && !text.endsWith(" ") && !item.str.startsWith(" ")) {
                text += " ";
            }
            text += item.str;
            end = item.x + item.width;
        }
        return { y: row.y, x: row.items[0].x, text: text.replace(/\s+/g, " ").trim() };
    }).filter((line) => line.text.length > 0);
}

function multiply(m, ctm) {
    // Row-vector convention of the PDF specification: new CTM = m x CTM.
    return [
        m[0] * ctm[0] + m[1] * ctm[2],
        m[0] * ctm[1] + m[1] * ctm[3],
        m[2] * ctm[0] + m[3] * ctm[2],
        m[2] * ctm[1] + m[3] * ctm[3],
        m[4] * ctm[0] + m[5] * ctm[2] + ctm[4],
        m[4] * ctm[1] + m[5] * ctm[3] + ctm[5],
    ];
}

function unitSquareBounds(ctm) {
    const corners = [
        [ctm[4], ctm[5]],
        [ctm[0] + ctm[4], ctm[1] + ctm[5]],
        [ctm[2] + ctm[4], ctm[3] + ctm[5]],
        [ctm[0] + ctm[2] + ctm[4], ctm[1] + ctm[3] + ctm[5]],
    ];
    const xs = corners.map((corner) => corner[0]);
    const ys = corners.map((corner) => corner[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

const OBJECT_TIMEOUT_MS = 30_000;

/** Waits for a decoded image; pdf.js keeps images shared by several pages in commonObjs. */
function resolveObject(page, id) {
    const store = id.startsWith("g_") ? page.commonObjs : page.objs;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`image ${id} on page ${page.pageNumber} was not decoded within ${OBJECT_TIMEOUT_MS / 1000} s`)), OBJECT_TIMEOUT_MS);
        store.get(id, (value) => {
            clearTimeout(timer);
            resolve(value);
        });
    });
}

/**
 * The images painted on a page, in painting order, each as
 * `{ id, x, y, top, width, height, pxWidth, pxHeight, kind, data }` where
 * x/y/width/height are the placed bounds in PDF user space and the pixel
 * data is pdf.js's decoded image (`kind` 1 = 1-bit gray, 2 = RGB, 3 = RGBA).
 */
export async function readImages(page, pdfjs) {
    const { OPS } = pdfjs;
    const ops = await page.getOperatorList();
    const images = [];
    const stack = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];
        if (fn === OPS.save) {
            stack.push(ctm);
        } else if (fn === OPS.restore) {
            ctm = stack.pop() ?? ctm;
        } else if (fn === OPS.transform) {
            ctm = multiply(args, ctm);
        } else if (fn === OPS.paintFormXObjectBegin) {
            stack.push(ctm);
            if (args[0]) {
                ctm = multiply(args[0], ctm);
            }
        } else if (fn === OPS.paintFormXObjectEnd) {
            ctm = stack.pop() ?? ctm;
        } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
            const image = fn === OPS.paintImageXObject ? await resolveObject(page, args[0]) : args[0];
            if (!image || !image.data) {
                continue;
            }
            const bounds = unitSquareBounds(ctm);
            images.push({
                id: fn === OPS.paintImageXObject ? args[0] : `inline-${i}`,
                ...bounds,
                top: bounds.y + bounds.height,
                pxWidth: image.width,
                pxHeight: image.height,
                kind: image.kind,
                data: image.data,
            });
        }
    }
    return images;
}
