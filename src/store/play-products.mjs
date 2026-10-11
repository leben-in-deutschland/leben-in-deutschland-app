// Creates or updates the tip-jar products in Google Play through the Play
// Developer API (monetization.onetimeproducts) and activates them. The product
// definition lives in metadata/android/one-time-products.json.
//
//   node src/store/play-products.mjs                    # dry run: validates the definition and prints the requests; needs no credentials
//   node src/store/play-products.mjs --list             # what Play has today
//   node src/store/play-products.mjs --apply            # create or update every product, then activate it
//   node src/store/play-products.mjs --apply --product tip_small
//
// Credentials: PLAY_SERVICE_ACCOUNT_KEY=/path/outside/the/repo/key.json, the
// JSON key of a Google Cloud service account whose e-mail is invited in Play
// Console -> Users and permissions with "Manage store presence" for this app.
// The key is read, never printed, and must never be committed (lib/play-api.mjs).
// Optional: PLAY_REGIONS_VERSION overrides the regions version that
// pricing:convertRegionPrices reports.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, createPlayClient, explainError, fail, readPackageName, relative } from "./lib/play-api.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFINITION = path.join(here, "metadata/android/one-time-products.json");
const REQUIRED_LANGUAGES = ["de-DE", "en-US"];
const LIMITS = { title: 55, description: 200 };

function parseArgs(argv) {
    const args = { apply: false, list: false, help: false, products: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--apply") args.apply = true;
        else if (arg === "--list") args.list = true;
        else if (arg === "--dry-run") args.apply = false;
        else if (arg === "--help" || arg === "-h") args.help = true;
        else if (arg === "--product") args.products.push(argv[++i]);
        else fail(`unknown argument ${arg} (see --help)`);
    }
    return args;
}

function usage() {
    console.log(`Usage: node src/store/play-products.mjs [--apply | --list] [--product <id>]...

  (no flag)   dry run: validate ${relative(DEFINITION)} and print the requests
  --list      list the one-time products Play has for the app
  --apply     create or update the products and activate their purchase option
  --product   limit --apply or the dry run to one product id (repeatable)

Environment: PLAY_SERVICE_ACCOUNT_KEY (path to the service-account JSON key),
PLAY_PACKAGE_NAME (optional override), PLAY_REGIONS_VERSION (optional override).`);
}

// "1.99" -> { currencyCode: "EUR", units: "1", nanos: 990000000 }
function money(decimal, currencyCode) {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(decimal));
    if (!match) {
        fail(`price "${decimal}" must be a decimal with at most two digits, e.g. "1.99"`);
    }
    return { currencyCode, units: match[1], nanos: Number((match[2] ?? "").padEnd(2, "0")) * 10_000_000 };
}

function amount({ units = "0", nanos = 0 }) {
    return Number(units) + nanos / 1e9;
}

function formatMoney(value) {
    return `${amount(value).toFixed(2)} ${value.currencyCode}`;
}

// Google's converter expects the tax-exclusive price and returns tax-inclusive
// local prices, so the German consumer price is stripped of German VAT first.
function netOf(price, vatRate) {
    const value = amount(price) / (1 + vatRate);
    const units = Math.floor(value);
    return { currencyCode: price.currencyCode, units: String(units), nanos: Math.round((value - units) * 1e9) };
}

function loadDefinition() {
    const definition = JSON.parse(readFileSync(DEFINITION, "utf8"));
    definition.packageName = readPackageName();
    return definition;
}

function validate(definition) {
    const problems = [];
    if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(definition.packageName ?? "")) {
        problems.push(`packageName "${definition.packageName}" is not a valid Android package name`);
    }
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(definition.purchaseOptionId ?? "")) {
        problems.push(`purchaseOptionId "${definition.purchaseOptionId}" must be 1-63 lowercase letters, digits or dashes`);
    }
    if (!/^[A-Z]{2}$/.test(definition.defaultRegion ?? "") || !/^[A-Z]{3}$/.test(definition.defaultCurrency ?? "")) {
        problems.push("defaultRegion must be an ISO 3166 code such as DE and defaultCurrency an ISO 4217 code such as EUR");
    }
    if (!(typeof definition.defaultVatRate === "number" && definition.defaultVatRate >= 0 && definition.defaultVatRate < 1)) {
        problems.push("defaultVatRate must be a number between 0 and 1, e.g. 0.19");
    }
    if (!Array.isArray(definition.products) || definition.products.length === 0) {
        problems.push("products must be a non-empty array");
        return problems;
    }
    const seen = new Set();
    for (const product of definition.products) {
        const id = product.productId ?? "(missing id)";
        if (!/^[a-z0-9][a-z0-9_.]*$/.test(id) || id.startsWith("android.test")) {
            problems.push(`${id}: product ids start with a digit or lowercase letter and contain only a-z, 0-9, _ and .`);
        }
        if (seen.has(id)) {
            problems.push(`${id}: duplicate product id`);
        }
        seen.add(id);
        try {
            if (amount(money(product.price, definition.defaultCurrency)) <= 0) {
                problems.push(`${id}: price must be positive`);
            }
        } catch (error) {
            problems.push(`${id}: ${error.message}`);
        }
        const listings = product.listings ?? {};
        for (const language of REQUIRED_LANGUAGES) {
            if (!listings[language]) {
                problems.push(`${id}: listing for ${language} is missing`);
            }
        }
        for (const [language, listing] of Object.entries(listings)) {
            const title = [...(listing.title ?? "")].length;
            const description = [...(listing.description ?? "")].length;
            if (title === 0 || title > LIMITS.title) {
                problems.push(`${id}/${language}: title has ${title} characters, allowed 1-${LIMITS.title}`);
            }
            if (description === 0 || description > LIMITS.description) {
                problems.push(`${id}/${language}: description has ${description} characters, allowed 1-${LIMITS.description}`);
            }
        }
    }
    return problems;
}

function buildProduct(definition, product, regional) {
    const basePrice = money(product.price, definition.defaultCurrency);
    const configs = regional?.configs ?? [{ regionCode: definition.defaultRegion, price: basePrice, availability: "AVAILABLE" }];
    const purchaseOption = {
        purchaseOptionId: definition.purchaseOptionId,
        // legacyCompatible keeps the product visible to Billing Library flows that
        // read OneTimePurchaseOfferDetails, which is what TipJarPlugin.java does.
        buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
        regionalPricingAndAvailabilityConfigs: configs,
    };
    if (regional?.newRegionsConfig) {
        purchaseOption.newRegionsConfig = regional.newRegionsConfig;
    }
    return {
        packageName: definition.packageName,
        productId: product.productId,
        listings: Object.entries(product.listings).map(([languageCode, listing]) => ({
            languageCode,
            title: listing.title,
            description: listing.description,
        })),
        purchaseOptions: [purchaseOption],
    };
}

async function convertPrices(request, definition, price) {
    const result = await request("POST", `/applications/${definition.packageName}/pricing:convertRegionPrices`, {
        body: { price: netOf(price, definition.defaultVatRate) },
    });
    const configs = [];
    for (const [regionCode, entry] of Object.entries(result.convertedRegionPrices ?? {})) {
        const converted = entry.price ?? {};
        // Euro countries get the exact configured price, so Germany shows precisely what the definition says.
        const regionalPrice =
            converted.currencyCode === price.currencyCode
                ? price
                : { currencyCode: converted.currencyCode, units: converted.units ?? "0", nanos: converted.nanos ?? 0 };
        configs.push({ regionCode, price: regionalPrice, availability: "AVAILABLE" });
    }
    if (!configs.some((config) => config.regionCode === definition.defaultRegion)) {
        configs.push({ regionCode: definition.defaultRegion, price, availability: "AVAILABLE" });
    }
    configs.sort((a, b) => a.regionCode.localeCompare(b.regionCode));
    const other = result.convertedOtherRegionsPrice;
    const newRegionsConfig =
        other?.usdPrice && other?.eurPrice ? { usdPrice: other.usdPrice, eurPrice: other.eurPrice, availability: "AVAILABLE" } : undefined;
    const regionsVersion = process.env.PLAY_REGIONS_VERSION ?? result.regionVersion?.version;
    if (!regionsVersion) {
        fail("Play returned no regions version; set PLAY_REGIONS_VERSION to the current value from https://support.google.com/googleplay/android-developer/answer/10532353");
    }
    return { configs, newRegionsConfig, regionsVersion };
}

function printProduct(product, definition) {
    const titles = (product.listings ?? []).map((listing) => `${listing.languageCode} "${listing.title}"`).join(", ");
    console.log(`${product.productId}: ${titles || "no listings"}`);
    for (const option of product.purchaseOptions ?? []) {
        const configs = option.regionalPricingAndAvailabilityConfigs ?? [];
        const home = configs.find((config) => config.regionCode === definition.defaultRegion);
        const flags = [option.buyOption ? "buy" : option.rentOption ? "rent" : "?", option.buyOption?.legacyCompatible ? "legacy compatible" : null]
            .filter(Boolean)
            .join(", ");
        console.log(
            `  ${option.purchaseOptionId}: ${option.state ?? "state unknown"}, ${home?.price ? formatMoney(home.price) : "no price"} in ${definition.defaultRegion}, ${configs.length} regions (${flags})`,
        );
    }
}

function optionState(product, definition) {
    return (product.purchaseOptions ?? []).find((option) => option.purchaseOptionId === definition.purchaseOptionId)?.state;
}

async function applyProduct(request, definition, product) {
    console.log(`\n${product.productId}`);
    const price = money(product.price, definition.defaultCurrency);
    const regional = await convertPrices(request, definition, price);
    console.log(`  ${formatMoney(price)} converted for ${regional.configs.length} regions (regions version ${regional.regionsVersion})`);
    const saved = await request("PATCH", `/applications/${definition.packageName}/onetimeproducts/${product.productId}`, {
        query: { allowMissing: "true", updateMask: "listings,purchaseOptions", "regionsVersion.version": regional.regionsVersion },
        body: buildProduct(definition, product, regional),
    });
    console.log(`  saved; purchase option "${definition.purchaseOptionId}" is ${optionState(saved, definition) ?? "state unknown"}`);
    if (optionState(saved, definition) !== "ACTIVE") {
        await request("POST", `/applications/${definition.packageName}/oneTimeProducts/${product.productId}/purchaseOptions:batchUpdateStates`, {
            body: {
                requests: [
                    {
                        activatePurchaseOptionRequest: {
                            packageName: definition.packageName,
                            productId: product.productId,
                            purchaseOptionId: definition.purchaseOptionId,
                        },
                    },
                ],
            },
        });
        console.log("  activated");
    }
    const current = await request("GET", `/applications/${definition.packageName}/oneTimeProducts/${product.productId}`);
    printProduct(current, definition);
    const state = optionState(current, definition);
    if (state !== "ACTIVE") {
        fail(`${product.productId}: purchase option is ${state ?? "missing"}, expected ACTIVE`);
    }
}

async function listProducts(request, definition) {
    const products = [];
    let pageToken;
    do {
        const page = await request("GET", `/applications/${definition.packageName}/oneTimeProducts`, { query: { pageSize: "100", pageToken } });
        products.push(...(page.oneTimeProducts ?? []));
        pageToken = page.nextPageToken;
    } while (pageToken);
    console.log(`${products.length} one-time product(s) in Play for ${definition.packageName}`);
    for (const product of products) {
        printProduct(product, definition);
    }
    const present = new Set(products.map((product) => product.productId));
    for (const product of definition.products) {
        if (!present.has(product.productId)) {
            console.log(`  missing: ${product.productId} (run --apply)`);
        }
    }
}

function dryRun(definition, products) {
    console.log(`dry run for ${definition.packageName} - nothing is sent\n`);
    for (const product of products) {
        const price = money(product.price, definition.defaultCurrency);
        console.log(
            `PATCH ${API}/applications/${definition.packageName}/onetimeproducts/${product.productId}?allowMissing=true&updateMask=listings,purchaseOptions&regionsVersion.version=<from pricing:convertRegionPrices>`,
        );
        console.log(JSON.stringify(buildProduct(definition, product, null), null, 2));
        console.log(
            `  at apply time pricing:convertRegionPrices turns ${formatMoney(netOf(price, definition.defaultVatRate))} (tax-exclusive) into local prices for every Play region; euro countries keep ${formatMoney(price)}`,
        );
        console.log(
            `POST ${API}/applications/${definition.packageName}/oneTimeProducts/${product.productId}/purchaseOptions:batchUpdateStates {"requests":[{"activatePurchaseOptionRequest":{"purchaseOptionId":"${definition.purchaseOptionId}"}}]}\n`,
        );
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

    if (args.list) {
        const client = await createPlayClient();
        await listProducts(client.request, definition);
        return;
    }
    if (!args.apply) {
        dryRun(definition, selected);
        console.log(`Definition valid: ${selected.length} product(s). Run with --apply to create them in Play.`);
        return;
    }
    const client = await createPlayClient();
    for (const product of selected) {
        await applyProduct(client.request, definition, product);
    }
    console.log(`\nDone: ${selected.length} product(s) active in Play. Add your Google account under Play Console -> Settings -> License testing before trying a purchase.`);
}

main().catch((error) => {
    explainError(error);
    process.exit(1);
});
