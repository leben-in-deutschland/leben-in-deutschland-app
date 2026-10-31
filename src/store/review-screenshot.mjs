// Renders the App Review screenshot that every App Store in-app purchase
// needs: the Settings page of the exported web build with the tip jar open,
// exactly as the iOS app shows it. The page runs with the iOS platform and a
// `TipJar` plugin faked the way `TipJarPlugin.swift` answers (the three
// products from metadata/android/one-time-products.json with their German
// prices), so no App Store Connect products, sandbox account or device are
// needed. Apple shows the picture to the reviewer only, never in the store.
//
//   node src/store/review-screenshot.mjs                 # output/review/tip-jar-de.png and tip-jar-en.png
//   node src/store/review-screenshot.mjs --lang de --theme light
//
// Requires `src/web/out` (run `npm run build` in src/web first). Attach the
// result with `node src/store/asc-products.mjs --apply --review-screenshot
// src/store/output/review/tip-jar-de.png`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser.mjs";
import { buildStorageSeed } from "./lib/demo-user.mjs";
import { startServer } from "./lib/server.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../web/out");
const reviewDir = path.join(here, "output/review");
const DEFINITION = path.join(here, "metadata/android/one-time-products.json");
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
/** iPhone 16 Pro in CSS pixels at 3x: 1206 x 2622 raw, above Apple's 640 x 920 minimum. */
const PHONE = { width: 402, height: 874, scale: 3, mobile: true };

function parseArgs(argv) {
    const args = { lang: null, theme: "light" };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--")) {
            args[argv[i].slice(2)] = argv[++i];
        }
    }
    return args;
}

/** "1.99" -> "1,99 €", the way StoreKit formats a German price. */
function germanPrice(decimal) {
    return `${String(decimal).replace(".", ",")} €`;
}

function products(language) {
    const definition = JSON.parse(readFileSync(DEFINITION, "utf8"));
    const locale = language === "de" ? "de-DE" : "en-US";
    return definition.products.map((product) => ({ id: product.productId, name: product.listings[locale].title, price: germanPrice(product.price) }));
}

/** The storage seed of the demo learner plus an iOS platform whose TipJar plugin knows the products. */
function initScript(seed, items) {
    return `(() => {
        try {
            localStorage.clear();
            const seed = ${JSON.stringify(seed)};
            for (const key in seed) localStorage.setItem(key, seed[key]);
        } catch (error) {}
        window.CapacitorCustomPlatform = { name: "ios", plugins: {} };
        const products = ${JSON.stringify(items)};
        window.Capacitor = {
            PluginHeaders: [{ name: "TipJar", methods: [
                { name: "getProducts", rtype: "promise" },
                { name: "purchase", rtype: "promise" },
                { name: "recoverPurchases", rtype: "promise" },
            ] }],
            nativePromise(pluginName, methodName, options) {
                if (pluginName !== "TipJar") {
                    return Promise.reject(new Error(pluginName + " is not available in this capture"));
                }
                if (methodName === "getProducts") {
                    const ids = (options && options.ids) || [];
                    return Promise.resolve({ available: true, products: ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) });
                }
                if (methodName === "recoverPurchases") {
                    return Promise.resolve({ consumed: 0 });
                }
                return Promise.resolve({ state: "cancelled" });
            },
        };
    })();`;
}

export async function renderReviewScreenshots({ lang, theme } = {}) {
    if (!existsSync(path.join(outDir, "settings.html"))) {
        throw new Error(`missing ${outDir}/settings.html - run "npm run build" in src/web first`);
    }
    const server = await startServer({ "/": outDir });
    const browser = await launchBrowser();
    const files = [];
    try {
        const page = await browser.newPage();
        await page.setDevice({ ...PHONE, userAgent: IOS_UA });
        await page.setColorScheme(theme === "dark" ? "dark" : "light");
        for (const language of ["de", "en"].filter((item) => !lang || item === lang)) {
            await page.setInitScript(initScript(buildStorageSeed({ language, theme }), products(language)));
            await page.navigate(`${server.url}/settings.html`);
            await page.settle(900);
            await page.waitFor(`document.querySelectorAll("#support [role='group'] button").length === 3`, { label: "tip jar with three products" });
            await page.evaluate(`(() => {
                const section = document.getElementById("support");
                const top = section.getBoundingClientRect().top + window.scrollY - 72;
                window.scrollTo({ top, behavior: "instant" });
            })()`);
            await page.settle(600);
            mkdirSync(reviewDir, { recursive: true });
            const file = path.join(reviewDir, `tip-jar-${language}.png`);
            writeFileSync(file, await page.screenshot());
            files.push(file);
            console.log(`rendered ${path.relative(here, file)}`);
        }
    } finally {
        await browser.close();
        await server.close();
    }
    return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    renderReviewScreenshots(parseArgs(process.argv.slice(2))).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
