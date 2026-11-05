// Turns the official pictures of one catalogue question into the one image
// the app shows: a single picture as it is, four pictures ("Bild 1" ..
// "Bild 4") in a 2 x 2 grid with their caption under each, so the four stay
// legible on a phone. A credit or source note printed under the picture in
// the PDF ("© Deutscher Bundestag/…") is printed under the image as well.
// Transparent pictures are flattened on white; the result is a WebP that
// works in every browser the web app, the Android WebView (API 24+), and
// WKWebView (iOS 15+) use.
//
// sharp is loaded from src/web/node_modules like pdf.js (see lib/pdf.mjs).
import { createRequire } from "node:module";
import { webRoot } from "./pdf.mjs";

/** Largest single picture; the app shows pictures at most 288 CSS px high. */
export const SINGLE_MAX = { width: 1200, height: 900 };
/** One cell of the four-picture grid (picture area, caption below). */
export const CELL = { width: 400, height: 440, caption: 56, gap: 24, margin: 16 };
export const WEBP = { quality: 80, effort: 6 };

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const INK = "#1f2933";
const MUTED = "#52606d";

let sharpModule;

/** sharp from src/web/node_modules, loaded once. */
export function loadSharp() {
    if (!sharpModule) {
        const require = createRequire(`${webRoot}/package.json`);
        try {
            sharpModule = require("sharp");
        } catch {
            throw new Error("sharp is not installed; run `npm ci` in src/web");
        }
    }
    return sharpModule;
}

function escapeMarkup(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A line of text as a PNG buffer no wider than `maxWidth`. */
async function textLine(text, { size, color, bold = false, maxWidth }) {
    const sharp = loadSharp();
    const markup = `<span foreground="${color}"${bold ? ' weight="bold"' : ""}>${escapeMarkup(text)}</span>`;
    return sharp({ text: { text: markup, font: `sans-serif ${size}px`, rgba: true, width: maxWidth, wrap: "word", dpi: 72 } }).png().toBuffer();
}

/** A picture flattened on white and fitted into `width` x `height` (never enlarged). */
async function fitted(file, width, height) {
    const sharp = loadSharp();
    return sharp(file).flatten({ background: WHITE }).resize({ width, height, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
}

/** Appends a credit line under an image buffer of the given width. */
async function withCredit(image, width, credit) {
    const sharp = loadSharp();
    if (!credit) {
        return image;
    }
    const size = Math.max(14, Math.round(width / 48));
    const line = await textLine(credit, { size, color: MUTED, maxWidth: width - 2 * CELL.margin });
    const lineMeta = await sharp(line).metadata();
    const imageMeta = await sharp(image).metadata();
    const pad = Math.round(size * 0.6);
    return sharp({ create: { width, height: imageMeta.height + lineMeta.height + 2 * pad, channels: 3, background: WHITE } })
        .composite([
            { input: image, left: 0, top: 0 },
            { input: line, left: CELL.margin, top: imageMeta.height + pad },
        ])
        .png()
        .toBuffer();
}

/**
 * The app image of a question from its official picture files (1 or 4, in
 * `Bild 1` .. `Bild 4` order) and its credit. Resolves with a WebP buffer.
 * @param {string[]} files
 * @param {string | null | undefined} credit
 * @returns {Promise<Buffer>}
 */
export async function renderQuestionPicture(files, credit) {
    const sharp = loadSharp();
    if (files.length !== 1 && files.length !== 4) {
        throw new Error(`a picture question has 1 or 4 pictures, not ${files.length}`);
    }
    let image;
    let width;
    if (files.length === 1) {
        const { data, info } = await fitted(files[0], SINGLE_MAX.width, SINGLE_MAX.height);
        image = data;
        width = info.width;
    } else {
        const { width: cellWidth, height: cellHeight, caption, gap, margin } = CELL;
        width = 2 * margin + 2 * cellWidth + gap;
        const height = 2 * margin + 2 * (cellHeight + caption) + gap;
        const layers = [];
        for (const [index, file] of files.entries()) {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const left = margin + column * (cellWidth + gap);
            const top = margin + row * (cellHeight + caption + gap);
            const { data, info } = await fitted(file, cellWidth, cellHeight);
            layers.push({ input: data, left: left + Math.round((cellWidth - info.width) / 2), top: top + Math.round((cellHeight - info.height) / 2) });
            const label = await textLine(`Bild ${index + 1}`, { size: 34, color: INK, bold: true });
            const labelMeta = await sharp(label).metadata();
            layers.push({ input: label, left: left + Math.round((cellWidth - labelMeta.width) / 2), top: top + cellHeight + Math.round((caption - labelMeta.height) / 2) });
        }
        image = await sharp({ create: { width, height, channels: 3, background: WHITE } }).composite(layers).png().toBuffer();
    }
    const framed = await withCredit(image, width, credit);
    return sharp(framed).webp(WEBP).toBuffer();
}
