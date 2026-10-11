// Renders the icons of the one-time (tip) products for the Play Console.
//
//   node src/store/compose/product-icons.mjs
//
// Output: src/store/output/play-products/<productId>.png, 1024 x 1024,
// 32-bit PNG (sRGB). The Play Developer API has no icon field for one-time
// products, so these files are uploaded by hand in the Play Console
// (Monetize > Products > One-time products > product > Icon); see the README.
//
// Google's icon rules (developer.android.com/guide/playpoints/create-products-one-time):
// 512-1080 px square, 32-bit PNG, main artwork centred in roughly half the
// canvas, plain background. The artwork reuses the app's own line icons
// (Lucide style, ISC) on the brand gradient of the feature graphic.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "../lib/browser.mjs";
import { startServer } from "../lib/server.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const storeRoot = path.resolve(here, "..");
const outputRoot = path.join(storeRoot, "output");
const sharp = createRequire(path.join(storeRoot, "..", "web", "package.json"))("sharp");

export const ICON_SIZE = 1024;
const ARTWORK = 500;
const STROKE = 1.75;

// 24 px grid paths, same drawing style as src/web/components/ui/icons.tsx.
export const PRODUCT_ICONS = {
    tip_small: {
        name: "coffee",
        paths: [
            "M10 2v2",
            "M14 2v2",
            "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",
            "M6 2v2",
        ],
    },
    tip_medium: {
        name: "cake",
        paths: [
            "M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8",
            "M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1",
            "M2 21h20",
            "M7 8v3",
            "M12 8v3",
            "M17 8v3",
            "M7 4h.01",
            "M12 4h.01",
            "M17 4h.01",
        ],
    },
    tip_large: {
        name: "utensils",
        paths: [
            "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
            "M7 2v20",
            "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
        ],
    },
};

export function productIconHtml(paths) {
    const svgPaths = paths.map((d) => `<path d="${d}" />`).join("");
    return `<!doctype html>
<html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${ICON_SIZE}px; height: ${ICON_SIZE}px; background: #4E1019; overflow: hidden; }
    .canvas {
        position: relative; width: ${ICON_SIZE}px; height: ${ICON_SIZE}px; overflow: hidden;
        background: radial-gradient(120% 70% at 50% -10%, #9A3146 0%, #7A1F2E 42%, #4E1019 100%);
    }
    .glow {
        position: absolute; left: 50%; top: 50%; width: 760px; height: 760px; border-radius: 50%;
        transform: translate(-50%, -50%);
        background: radial-gradient(closest-side, rgba(217,181,102,0.28), rgba(217,181,102,0) 72%);
    }
    .ring { position: absolute; left: 50%; top: 50%; border-radius: 50%; transform: translate(-50%, -50%); border: 3px solid rgba(217,181,102,0.22); }
    .ring.a { width: 640px; height: 640px; }
    .ring.b { width: 880px; height: 880px; border-color: rgba(217,181,102,0.12); }
    svg {
        position: absolute; left: 50%; top: 50%; width: ${ARTWORK}px; height: ${ARTWORK}px;
        transform: translate(-50%, -50%); color: #F0D89A;
        filter: drop-shadow(0 10px 24px rgba(20,14,16,0.45));
    }
</style></head>
<body><div class="canvas"><div class="glow"></div><div class="ring b"></div><div class="ring a"></div>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${svgPaths}</svg>
</div></body></html>`;
}

export async function renderProductIcons() {
    const tmpDir = path.join(outputRoot, "tmp");
    const targetDir = path.join(outputRoot, "play-products");
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
    const server = await startServer({ "/__store/": storeRoot });
    const browser = await launchBrowser();
    const written = [];
    try {
        const page = await browser.newPage();
        for (const [productId, icon] of Object.entries(PRODUCT_ICONS)) {
            const name = `product-icon-${productId}`;
            writeFileSync(path.join(tmpDir, `${name}.html`), productIconHtml(icon.paths));
            await page.setDevice({ width: ICON_SIZE, height: ICON_SIZE, scale: 1, mobile: false });
            await page.navigate(`${server.url}/__store/output/tmp/${name}.html`);
            await page.settle(200);
            const png = await page.screenshot({ clip: { x: 0, y: 0, width: ICON_SIZE, height: ICON_SIZE } });
            const file = path.join(targetDir, `${productId}.png`);
            // Google asks for 32-bit PNG: keep an (opaque) alpha channel, sRGB.
            await sharp(png).ensureAlpha().toColorspace("srgb").png({ compressionLevel: 9 }).toFile(file);
            written.push(file);
            console.log(`rendered ${path.relative(storeRoot, file)} (${icon.name})`);
        }
    } finally {
        await browser.close();
        await server.close();
    }
    return written;
}

/** Product ids that need an icon, read from the product definition. */
export function definedProductIds() {
    const file = path.join(storeRoot, "metadata/android/one-time-products.json");
    return JSON.parse(readFileSync(file, "utf8")).products.map((product) => product.productId);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const missing = definedProductIds().filter((id) => !PRODUCT_ICONS[id]);
    if (missing.length > 0) {
        console.error(`no icon defined for ${missing.join(", ")} - add it to PRODUCT_ICONS`);
        process.exit(1);
    }
    renderProductIcons().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
