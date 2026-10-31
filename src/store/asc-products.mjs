// Creates or updates the tip-jar products in App Store Connect through the
// App Store Connect API (in-app purchases v2): the consumable itself, its
// German and English texts, the price schedule from the EUR price, and
// worldwide availability. The product definition is shared with Google Play:
// metadata/android/one-time-products.json.
//
//   node src/store/asc-products.mjs                          # dry run: validates the definition and prints the requests; needs no credentials
//   node src/store/asc-products.mjs --list                   # what App Store Connect has today
//   node src/store/asc-products.mjs --apply                  # create or update every product
//   node src/store/asc-products.mjs --apply --product tip_small
//   node src/store/asc-products.mjs --apply --review-screenshot path/to/tip-jar.png
//
// Credentials (see lib/asc-api.mjs): ASC_KEY_ID, ASC_ISSUER_ID and the .p8 key
// through ASC_API_KEY_PATH (laptop) or ASC_API_KEY_BASE64 (GitHub Actions). The
// key is read, never printed, and must never be committed.
//
// A product needs a review screenshot before Apple lets it be submitted
// (state READY_TO_SUBMIT); pass one with --review-screenshot or drop it into
// App Store Connect by hand. Products are submitted together with the first
// app version, in App Store Connect.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, createAscClient, explainError, fail, findApp, readBundleId, relative } from "./lib/asc-api.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFINITION = path.join(here, "metadata/android/one-time-products.json");
const REQUIRED_LOCALES = ["de-DE", "en-US"];
const LIMITS = { title: 30, appStoreDescription: 45, reviewNote: 4000 };
const SUBMITTABLE = new Set(["READY_TO_SUBMIT", "WAITING_FOR_REVIEW", "IN_REVIEW", "APPROVED"]);

function parseArgs(argv) {
    const args = { apply: false, list: false, help: false, products: [], screenshot: null };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--apply") args.apply = true;
        else if (arg === "--list") args.list = true;
        else if (arg === "--dry-run") args.apply = false;
        else if (arg === "--help" || arg === "-h") args.help = true;
        else if (arg === "--product") args.products.push(argv[++i]);
        else if (arg === "--review-screenshot") args.screenshot = argv[++i];
        else fail(`unknown argument ${arg} (see --help)`);
    }
    return args;
}

function usage() {
    console.log(`Usage: node src/store/asc-products.mjs [--apply | --list] [--product <id>]... [--review-screenshot <png>]

  (no flag)            dry run: validate ${relative(DEFINITION)} and print the requests
  --list               list the in-app purchases App Store Connect has for the app
  --apply              create or update the products: texts, price schedule, availability
  --product            limit --apply or the dry run to one product id (repeatable)
  --review-screenshot  PNG or JPEG of the tip jar in the app, attached to every applied product for App Review

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_PATH or ASC_API_KEY_BASE64, ASC_BUNDLE_ID (optional override).`);
}

function loadDefinition() {
    const definition = JSON.parse(readFileSync(DEFINITION, "utf8"));
    definition.bundleId = readBundleId();
    return definition;
}

function validate(definition) {
    const problems = [];
    if (!/^[A-Z]{3}$/.test(definition.appStore?.baseTerritory ?? "")) {
        problems.push("appStore.baseTerritory must be an ISO 3166-1 alpha-3 territory such as DEU");
    }
    if (definition.appStore?.reviewNote && definition.appStore.reviewNote.length > LIMITS.reviewNote) {
        problems.push(`appStore.reviewNote is longer than ${LIMITS.reviewNote} characters`);
    }
    if (!Array.isArray(definition.products) || definition.products.length === 0) {
        problems.push("products must be a non-empty array");
        return problems;
    }
    const seen = new Set();
    for (const product of definition.products) {
        const id = product.productId ?? "(missing id)";
        if (!/^[a-z0-9][a-z0-9_.]*$/.test(id)) {
            problems.push(`${id}: product ids start with a digit or lowercase letter and contain only a-z, 0-9, _ and .`);
        }
        if (seen.has(id)) {
            problems.push(`${id}: duplicate product id`);
        }
        seen.add(id);
        if (!/^\d+\.\d{2}$/.test(String(product.price ?? ""))) {
            problems.push(`${id}: price "${product.price}" must be a decimal with two digits, e.g. "1.99"`);
        }
        for (const locale of REQUIRED_LOCALES) {
            const listing = product.listings?.[locale];
            if (!listing) {
                problems.push(`${id}: listing for ${locale} is missing`);
                continue;
            }
            if (!listing.title || listing.title.length > LIMITS.title) {
                problems.push(`${id}/${locale}: title must be 1-${LIMITS.title} characters (App Store display name)`);
            }
            if (!listing.appStoreDescription || listing.appStoreDescription.length > LIMITS.appStoreDescription) {
                problems.push(`${id}/${locale}: appStoreDescription must be 1-${LIMITS.appStoreDescription} characters`);
            }
        }
    }
    return problems;
}

function readScreenshot(file) {
    const resolved = path.resolve(file);
    let bytes;
    try {
        bytes = readFileSync(resolved);
    } catch (error) {
        fail(`cannot read the review screenshot: ${error.code ?? error.message}`);
    }
    const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpeg) {
        fail("the review screenshot must be a PNG or JPEG");
    }
    return { fileName: path.basename(resolved), fileSize: statSync(resolved).size, bytes, md5: createHash("md5").update(bytes).digest("hex") };
}

const ref = (type, id) => ({ data: { type, id } });

function productAttributes(definition, product) {
    return {
        name: product.listings["de-DE"].title,
        productId: product.productId,
        inAppPurchaseType: "CONSUMABLE",
        reviewNote: definition.appStore.reviewNote ?? undefined,
        familySharable: false,
    };
}

function localizationAttributes(product, locale) {
    const listing = product.listings[locale];
    return { locale, name: listing.title, description: listing.appStoreDescription };
}

function priceScheduleBody(definition, iapId, pricePointId) {
    // JSON:API "included" is how a new price travels with its schedule.
    return {
        data: {
            type: "inAppPurchasePriceSchedules",
            relationships: {
                inAppPurchase: ref("inAppPurchases", iapId),
                baseTerritory: ref("territories", definition.appStore.baseTerritory),
                manualPrices: { data: [{ type: "inAppPurchasePrices", id: "${base-price}" }] },
            },
        },
        included: [
            {
                type: "inAppPurchasePrices",
                id: "${base-price}",
                attributes: { startDate: null },
                relationships: { inAppPurchasePricePoint: ref("inAppPurchasePricePoints", pricePointId) },
            },
        ],
    };
}

function printProduct(iap, localizations = [], price = null) {
    const a = iap.attributes ?? {};
    console.log(`  ${a.productId}  ${a.inAppPurchaseType ?? "?"}  ${a.state ?? "state unknown"}${price ? `  ${price}` : ""}`);
    for (const localization of localizations) {
        const l = localization.attributes ?? {};
        console.log(`    ${l.locale}: "${l.name}" - ${l.description ?? ""}`);
    }
}

async function existingProducts(client, appId) {
    const items = await client.list(`/v1/apps/${appId}/inAppPurchasesV2`, { query: { "fields[inAppPurchases]": "productId,name,inAppPurchaseType,state,reviewNote,familySharable" } });
    return new Map(items.map((item) => [item.attributes.productId, item]));
}

async function findPricePoint(client, iapId, definition, price) {
    const points = await client.list(`/v2/inAppPurchases/${iapId}/pricePoints`, {
        query: { "filter[territory]": definition.appStore.baseTerritory, "fields[inAppPurchasePricePoints]": "customerPrice,proceeds" },
    });
    const point = points.find((candidate) => candidate.attributes?.customerPrice === price);
    if (!point) {
        const near = points
            .map((candidate) => Number(candidate.attributes?.customerPrice))
            .filter((value) => Number.isFinite(value))
            .sort((a, b) => Math.abs(a - Number(price)) - Math.abs(b - Number(price)))
            .slice(0, 4);
        fail(`no App Store price point for ${price} in ${definition.appStore.baseTerritory}; nearest: ${near.map((value) => value.toFixed(2)).join(", ")} - change the price in ${relative(DEFINITION)} for both stores`);
    }
    return point;
}

async function currentBasePrice(client, iapId) {
    const schedule = await client.request("GET", `/v2/inAppPurchases/${iapId}/iapPriceSchedule`, { allow404: true });
    if (!schedule?.data) {
        return null;
    }
    const base = await client.request("GET", `/v1/inAppPurchasePriceSchedules/${schedule.data.id}/baseTerritory`, { allow404: true });
    const baseTerritory = base?.data?.id ?? null;
    const prices = await client.list(`/v1/inAppPurchasePriceSchedules/${schedule.data.id}/manualPrices`, {
        query: { "filter[territory]": baseTerritory ?? undefined, include: "inAppPurchasePricePoint" },
    });
    const current = prices.find((item) => !item.attributes?.endDate) ?? prices[0];
    return { baseTerritory, pricePointId: current?.relationships?.inAppPurchasePricePoint?.data?.id ?? null };
}

async function applyProduct(client, appId, definition, product, screenshot) {
    const id = product.productId;
    console.log(`\n${id}`);
    const existing = await existingProducts(client, appId);
    let iap = existing.get(id);
    if (iap) {
        iap = (await client.request("PATCH", `/v2/inAppPurchases/${iap.id}`, {
            body: { data: { type: "inAppPurchases", id: iap.id, attributes: { name: productAttributes(definition, product).name, reviewNote: definition.appStore.reviewNote ?? undefined } } },
        })).data;
        console.log(`  product exists (${iap.attributes.state}); name and review note updated`);
    } else {
        iap = (await client.request("POST", "/v2/inAppPurchases", {
            body: { data: { type: "inAppPurchases", attributes: productAttributes(definition, product), relationships: { app: ref("apps", appId) } } },
        })).data;
        console.log("  product created");
    }

    const localizations = await client.list(`/v2/inAppPurchases/${iap.id}/inAppPurchaseLocalizations`);
    for (const locale of REQUIRED_LOCALES) {
        const attributes = localizationAttributes(product, locale);
        const current = localizations.find((item) => item.attributes?.locale === locale);
        if (current && current.attributes.name === attributes.name && current.attributes.description === attributes.description) {
            console.log(`  ${locale}: unchanged`);
        } else if (current) {
            await client.request("PATCH", `/v1/inAppPurchaseLocalizations/${current.id}`, {
                body: { data: { type: "inAppPurchaseLocalizations", id: current.id, attributes: { name: attributes.name, description: attributes.description } } },
            });
            console.log(`  ${locale}: updated`);
        } else {
            await client.request("POST", "/v1/inAppPurchaseLocalizations", {
                body: { data: { type: "inAppPurchaseLocalizations", attributes, relationships: { inAppPurchaseV2: ref("inAppPurchases", iap.id) } } },
            });
            console.log(`  ${locale}: created`);
        }
    }

    const point = await findPricePoint(client, iap.id, definition, product.price);
    const base = await currentBasePrice(client, iap.id);
    if (base && base.baseTerritory === definition.appStore.baseTerritory && base.pricePointId === point.id) {
        console.log(`  price: unchanged (${product.price} ${definition.defaultCurrency} in ${definition.appStore.baseTerritory})`);
    } else {
        await client.request("POST", "/v1/inAppPurchasePriceSchedules", { body: priceScheduleBody(definition, iap.id, point.id) });
        console.log(`  price: ${product.price} ${definition.defaultCurrency} in ${definition.appStore.baseTerritory}, other territories derived by Apple`);
    }

    const availability = await client.request("GET", `/v2/inAppPurchases/${iap.id}/inAppPurchaseAvailability`, { allow404: true });
    if (availability?.data) {
        console.log("  availability: unchanged");
    } else {
        const territories = await client.list("/v1/territories");
        await client.request("POST", "/v1/inAppPurchaseAvailabilities", {
            body: {
                data: {
                    type: "inAppPurchaseAvailabilities",
                    attributes: { availableInNewTerritories: true },
                    relationships: { inAppPurchase: ref("inAppPurchases", iap.id), availableTerritories: { data: territories.map((territory) => ({ type: "territories", id: territory.id })) } },
                },
            },
        });
        console.log(`  availability: ${territories.length} territories, new ones included`);
    }

    if (screenshot) {
        const current = await client.request("GET", `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`, { allow404: true });
        if (current?.data?.attributes?.sourceFileChecksum === screenshot.md5) {
            console.log("  review screenshot: unchanged");
        } else {
            if (current?.data) {
                await client.request("DELETE", `/v1/inAppPurchaseAppStoreReviewScreenshots/${current.data.id}`);
            }
            const reserved = (await client.request("POST", "/v1/inAppPurchaseAppStoreReviewScreenshots", {
                body: {
                    data: {
                        type: "inAppPurchaseAppStoreReviewScreenshots",
                        attributes: { fileName: screenshot.fileName, fileSize: screenshot.fileSize },
                        relationships: { inAppPurchaseV2: ref("inAppPurchases", iap.id) },
                    },
                },
            })).data;
            await client.upload(reserved, screenshot.bytes);
            await client.request("PATCH", `/v1/inAppPurchaseAppStoreReviewScreenshots/${reserved.id}`, {
                body: { data: { type: "inAppPurchaseAppStoreReviewScreenshots", id: reserved.id, attributes: { uploaded: true, sourceFileChecksum: screenshot.md5 } } },
            });
            console.log(`  review screenshot: uploaded ${screenshot.fileName}`);
        }
    }

    const final = (await client.request("GET", `/v2/inAppPurchases/${iap.id}`, { query: { "fields[inAppPurchases]": "productId,inAppPurchaseType,state" } })).data;
    printProduct(final);
    return final.attributes.state;
}

async function listProducts(client, appId, definition) {
    const existing = await existingProducts(client, appId);
    console.log(`${existing.size} in-app purchase(s) in App Store Connect for ${definition.bundleId}`);
    for (const iap of existing.values()) {
        const localizations = await client.list(`/v2/inAppPurchases/${iap.id}/inAppPurchaseLocalizations`);
        const base = await currentBasePrice(client, iap.id);
        printProduct(iap, localizations, base ? `base price set (${base.baseTerritory})` : "no price yet");
    }
    for (const product of definition.products) {
        if (!existing.has(product.productId)) {
            console.log(`  missing: ${product.productId} (run --apply)`);
        }
    }
}

function dryRun(definition, products, screenshot) {
    console.log(`dry run for ${definition.bundleId} - nothing is sent\n`);
    for (const product of products) {
        console.log(`POST ${API}/v2/inAppPurchases`);
        console.log(JSON.stringify({ data: { type: "inAppPurchases", attributes: productAttributes(definition, product), relationships: { app: ref("apps", "<app id>") } } }, null, 2));
        for (const locale of REQUIRED_LOCALES) {
            console.log(`POST ${API}/v1/inAppPurchaseLocalizations ${JSON.stringify(localizationAttributes(product, locale))}`);
        }
        console.log(`POST ${API}/v1/inAppPurchasePriceSchedules  base ${definition.appStore.baseTerritory}, price point for ${product.price} ${definition.defaultCurrency} (looked up at apply time)`);
        console.log(`POST ${API}/v1/inAppPurchaseAvailabilities  every territory, new territories included`);
        if (screenshot) {
            console.log(`POST ${API}/v1/inAppPurchaseAppStoreReviewScreenshots  ${screenshot.fileName} (${screenshot.fileSize} bytes), then upload and commit`);
        }
        console.log();
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }
    const definition = loadDefinition();
    const problems = validate(definition);
    if (problems.length > 0) {
        for (const problem of problems) {
            console.error(`  ✗ ${problem}`);
        }
        fail(`${problems.length} problem(s) in ${relative(DEFINITION)}`);
    }
    const known = new Set(definition.products.map((product) => product.productId));
    for (const id of args.products) {
        if (!known.has(id)) {
            fail(`unknown product "${id}"; known: ${[...known].join(", ")}`);
        }
    }
    const selected = args.products.length > 0 ? definition.products.filter((product) => args.products.includes(product.productId)) : definition.products;
    const screenshot = args.screenshot ? readScreenshot(args.screenshot) : null;

    if (args.list) {
        const client = await createAscClient();
        const app = await findApp(client, definition.bundleId);
        await listProducts(client, app.id, definition);
        return;
    }
    if (!args.apply) {
        dryRun(definition, selected, screenshot);
        console.log(`Definition valid: ${selected.length} product(s). Run with --apply to create them in App Store Connect.`);
        return;
    }
    const client = await createAscClient();
    const app = await findApp(client, definition.bundleId);
    const states = [];
    for (const product of selected) {
        states.push([product.productId, await applyProduct(client, app.id, definition, product, screenshot)]);
    }
    const pending = states.filter(([, state]) => !SUBMITTABLE.has(state));
    console.log(`\nDone: ${selected.length} product(s) in App Store Connect.`);
    if (pending.length > 0) {
        console.log(
            `${pending.map(([id, state]) => `${id} (${state})`).join(", ")}: add the App Review screenshot (--review-screenshot, or App Store Connect -> the product -> Review Information) before submitting.`,
        );
    }
    console.log("Products are submitted together with the app version in App Store Connect; purchases work in the sandbox once the Paid Apps Agreement is active.");
}

main().catch((error) => {
    explainError(error);
    process.exit(1);
});
