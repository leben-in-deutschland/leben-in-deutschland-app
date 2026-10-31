// Pushes the App Store listing from the repository through the App Store
// Connect API: per locale the name, subtitle, promotional text, description
// and keywords from metadata/ios/<locale>/*.txt, plus category, content
// rights, age rating, copyright, release type and the version string from
// metadata/ios/listing.json and src/web/package.json.
//
//   node src/store/asc-listing.mjs            # dry run: validates the texts and prints what would change; needs no credentials
//   node src/store/asc-listing.mjs --apply    # write everything to the editable version in App Store Connect
//
// Credentials (see lib/asc-api.mjs): ASC_KEY_ID, ASC_ISSUER_ID and the .p8 key
// through ASC_API_KEY_PATH (laptop) or ASC_API_KEY_BASE64 (GitHub Actions).
//
// Not covered, by hand in App Store Connect: screenshots (drag the rendered
// ios-* sets in), the App Privacy answers (no API), pricing/availability of
// the app itself (free, all territories), the build and the submission.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, ApiError, createAscClient, explainError, fail, findApp, readAppVersion, readBundleId, relative } from "./lib/asc-api.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const METADATA = path.join(here, "metadata/ios");
const CONFIG = path.join(METADATA, "listing.json");
const LIMITS = { name: 30, subtitle: 30, promotional_text: 170, keywords: 100, description: 4000 };
const TEXT_FILES = Object.keys(LIMITS);
/** App Store version states in which metadata can still be edited. */
const EDITABLE_VERSION_STATES = new Set(["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY", "WAITING_FOR_REVIEW"]);
const EDITABLE_INFO_STATES = new Set(["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "WAITING_FOR_REVIEW"]);

function parseArgs(argv) {
    const args = { apply: false, help: false };
    for (const arg of argv) {
        if (arg === "--apply") args.apply = true;
        else if (arg === "--dry-run" || arg === "--validate") args.apply = false;
        else if (arg === "--help" || arg === "-h") args.help = true;
        else fail(`unknown argument ${arg} (see --help)`);
    }
    return args;
}

function usage() {
    console.log(`Usage: node src/store/asc-listing.mjs [--apply]

  (no flag)   dry run: validate ${relative(METADATA)} and print the planned writes
  --apply     write name, subtitle, texts, keywords, URLs, category, content rights, age rating,
              copyright, release type and the version string to App Store Connect

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_PATH or ASC_API_KEY_BASE64, ASC_BUNDLE_ID (optional override).`);
}

function readText(locale, name) {
    const file = path.join(METADATA, locale, `${name}.txt`);
    return existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim() : null;
}

function loadListing() {
    const config = JSON.parse(readFileSync(CONFIG, "utf8"));
    const version = readAppVersion();
    const locales = {};
    for (const locale of config.locales ?? []) {
        locales[locale] = Object.fromEntries(TEXT_FILES.map((name) => [name, readText(locale, name)]));
    }
    return { bundleId: readBundleId(), version, config, locales, copyright: String(config.copyright ?? "").replace("{year}", String(new Date().getFullYear())) };
}

function validate(listing) {
    const problems = [];
    const { config, locales } = listing;
    if (!/^[A-Z_]+$/.test(config.primaryCategory ?? "")) {
        problems.push("primaryCategory must be an App Store category id such as EDUCATION");
    }
    if (!["USES_THIRD_PARTY_CONTENT", "DOES_NOT_USE_THIRD_PARTY_CONTENT"].includes(config.contentRightsDeclaration)) {
        problems.push("contentRightsDeclaration must be USES_THIRD_PARTY_CONTENT or DOES_NOT_USE_THIRD_PARTY_CONTENT");
    }
    if (!["MANUAL", "AFTER_APPROVAL", "SCHEDULED"].includes(config.releaseType)) {
        problems.push("releaseType must be MANUAL, AFTER_APPROVAL or SCHEDULED");
    }
    if (!listing.copyright) {
        problems.push("copyright is empty");
    }
    for (const key of ["support", "marketing", "privacyPolicy"]) {
        if (!/^https:\/\//.test(config.urls?.[key] ?? "")) {
            problems.push(`urls.${key} must be an https URL`);
        }
    }
    if (!Array.isArray(config.locales) || config.locales.length === 0) {
        problems.push("locales must list at least the primary locale");
    }
    for (const [locale, texts] of Object.entries(locales)) {
        for (const name of TEXT_FILES) {
            const value = texts[name];
            if (name === "promotional_text" && value === null) {
                continue;
            }
            if (!value) {
                problems.push(`${locale}/${name}.txt is missing or empty`);
            } else if (value.length > LIMITS[name]) {
                problems.push(`${locale}/${name}.txt has ${value.length} characters, the App Store allows ${LIMITS[name]}`);
            }
        }
        if (texts.keywords && /\s,|,\s/.test(texts.keywords)) {
            problems.push(`${locale}/keywords.txt: no spaces around the commas, they count against the 100 characters`);
        }
    }
    return problems;
}

const ref = (type, id) => ({ data: { type, id } });

function infoLocalizationAttributes(listing, locale) {
    const texts = listing.locales[locale];
    return { name: texts.name, subtitle: texts.subtitle, privacyPolicyUrl: listing.config.urls.privacyPolicy };
}

function versionLocalizationAttributes(listing, locale) {
    const texts = listing.locales[locale];
    return {
        description: texts.description,
        keywords: texts.keywords,
        promotionalText: texts.promotional_text ?? undefined,
        supportUrl: listing.config.urls.support,
        marketingUrl: listing.config.urls.marketing,
    };
}

function changed(current, wanted) {
    return Object.entries(wanted).filter(([key, value]) => value !== undefined && (current?.[key] ?? "") !== value);
}

async function editableAppInfo(client, appId) {
    const infos = await client.list(`/v1/apps/${appId}/appInfos`, { query: { "fields[appInfos]": "appStoreState,state,contentRightsDeclaration" } });
    const stateOf = (info) => info.attributes?.state ?? info.attributes?.appStoreState;
    return infos.find((info) => EDITABLE_INFO_STATES.has(stateOf(info))) ?? infos.find((info) => stateOf(info) !== "READY_FOR_SALE") ?? infos[0] ?? fail("the app has no app info record");
}

async function editableVersion(client, appId) {
    const versions = await client.list(`/v1/apps/${appId}/appStoreVersions`, {
        query: { "filter[platform]": "IOS", "fields[appStoreVersions]": "versionString,appVersionState,appStoreState,copyright,releaseType,createdDate" },
    });
    const stateOf = (version) => version.attributes?.appVersionState ?? version.attributes?.appStoreState;
    const version = versions.find((candidate) => EDITABLE_VERSION_STATES.has(stateOf(candidate)));
    if (!version) {
        fail(
            `no editable iOS version in App Store Connect (states: ${versions.map((candidate) => `${candidate.attributes?.versionString} ${stateOf(candidate)}`).join(", ") || "none"}); add a new version there first`,
        );
    }
    return { version, state: stateOf(version) };
}

async function applyAppInfo(client, listing, info) {
    const wanted = { contentRightsDeclaration: listing.config.contentRightsDeclaration };
    const current = info.attributes ?? {};
    await client.request("PATCH", `/v1/appInfos/${info.id}`, {
        body: {
            data: {
                type: "appInfos",
                id: info.id,
                attributes: changed(current, wanted).length > 0 ? wanted : undefined,
                relationships: { primaryCategory: ref("appCategories", listing.config.primaryCategory) },
            },
        },
    });
    console.log(`  category ${listing.config.primaryCategory}, content rights ${listing.config.contentRightsDeclaration}`);

    const localizations = await client.list(`/v1/appInfos/${info.id}/appInfoLocalizations`);
    for (const locale of listing.config.locales) {
        const attributes = infoLocalizationAttributes(listing, locale);
        const current = localizations.find((item) => item.attributes?.locale === locale);
        if (current) {
            const diff = changed(current.attributes, attributes);
            if (diff.length === 0) {
                console.log(`  ${locale} name/subtitle: unchanged`);
                continue;
            }
            await client.request("PATCH", `/v1/appInfoLocalizations/${current.id}`, {
                body: { data: { type: "appInfoLocalizations", id: current.id, attributes: Object.fromEntries(diff) } },
            });
            console.log(`  ${locale} name/subtitle: updated (${diff.map(([key]) => key).join(", ")})`);
        } else {
            await client.request("POST", "/v1/appInfoLocalizations", {
                body: { data: { type: "appInfoLocalizations", attributes: { locale, ...attributes }, relationships: { appInfo: ref("appInfos", info.id) } } },
            });
            console.log(`  ${locale} name/subtitle: created`);
        }
    }

    try {
        const declaration = await client.request("GET", `/v1/appInfos/${info.id}/ageRatingDeclaration`, { allow404: true });
        if (!declaration?.data) {
            console.log("  age rating: no declaration record yet - answer the questionnaire once in App Store Connect");
        } else {
            const diff = changed(declaration.data.attributes, listing.config.ageRating);
            if (diff.length === 0) {
                console.log("  age rating: unchanged");
            } else {
                await client.request("PATCH", `/v1/ageRatingDeclarations/${declaration.data.id}`, {
                    body: { data: { type: "ageRatingDeclarations", id: declaration.data.id, attributes: Object.fromEntries(diff) } },
                });
                console.log(`  age rating: updated (${diff.length} answer(s))`);
            }
        }
    } catch (error) {
        if (!(error instanceof ApiError) || ![400, 409, 422].includes(error.status)) {
            throw error;
        }
        console.log(`  age rating: Apple refused the answers in listing.json (${error.message}); finish the questionnaire in App Store Connect -> App Information -> Age Rating`);
    }
}

async function applyVersion(client, listing, version, state) {
    const wanted = { versionString: listing.version, copyright: listing.copyright, releaseType: listing.config.releaseType };
    const diff = changed(version.attributes, wanted);
    if (diff.length === 0) {
        console.log(`  version ${listing.version} (${state}): unchanged`);
    } else {
        await client.request("PATCH", `/v1/appStoreVersions/${version.id}`, {
            body: { data: { type: "appStoreVersions", id: version.id, attributes: Object.fromEntries(diff) } },
        });
        console.log(`  version ${listing.version} (${state}): updated (${diff.map(([key]) => key).join(", ")})`);
    }

    const localizations = await client.list(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
    for (const locale of listing.config.locales) {
        const attributes = versionLocalizationAttributes(listing, locale);
        const current = localizations.find((item) => item.attributes?.locale === locale);
        if (current) {
            const diff = changed(current.attributes, attributes);
            if (diff.length === 0) {
                console.log(`  ${locale} texts: unchanged`);
                continue;
            }
            await client.request("PATCH", `/v1/appStoreVersionLocalizations/${current.id}`, {
                body: { data: { type: "appStoreVersionLocalizations", id: current.id, attributes: Object.fromEntries(diff) } },
            });
            console.log(`  ${locale} texts: updated (${diff.map(([key]) => key).join(", ")})`);
        } else {
            await client.request("POST", "/v1/appStoreVersionLocalizations", {
                body: { data: { type: "appStoreVersionLocalizations", attributes: { locale, ...attributes }, relationships: { appStoreVersion: ref("appStoreVersions", version.id) } } },
            });
            console.log(`  ${locale} texts: created`);
        }
    }
}

function dryRun(listing) {
    console.log(`dry run for ${listing.bundleId} - nothing is sent\n`);
    console.log(`PATCH ${API}/v1/appInfos/<id>  category ${listing.config.primaryCategory}, ${listing.config.contentRightsDeclaration}`);
    for (const locale of listing.config.locales) {
        console.log(`PATCH|POST ${API}/v1/appInfoLocalizations  ${JSON.stringify(infoLocalizationAttributes(listing, locale))}`);
    }
    console.log(`PATCH ${API}/v1/ageRatingDeclarations/<id>  ${Object.keys(listing.config.ageRating).length} answers -> 4+`);
    console.log(`PATCH ${API}/v1/appStoreVersions/<editable>  ${JSON.stringify({ versionString: listing.version, copyright: listing.copyright, releaseType: listing.config.releaseType })}`);
    for (const locale of listing.config.locales) {
        const attributes = versionLocalizationAttributes(listing, locale);
        console.log(
            `PATCH|POST ${API}/v1/appStoreVersionLocalizations  ${locale}: description ${attributes.description.length} chars, keywords ${attributes.keywords.length} chars, promotional text ${attributes.promotionalText?.length ?? 0} chars, support/marketing URLs`,
        );
    }
    console.log("\nBy hand in App Store Connect: screenshots, App Privacy, pricing (Free) and availability, the build, the submission.");
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }
    const listing = loadListing();
    const problems = validate(listing);
    if (problems.length > 0) {
        for (const problem of problems) {
            console.error(`  ✗ ${problem}`);
        }
        fail(`${problems.length} problem(s) in ${relative(METADATA)}`);
    }
    if (!args.apply) {
        dryRun(listing);
        console.log(`Listing valid for ${listing.config.locales.join(", ")}. Run with --apply to write it to App Store Connect.`);
        return;
    }
    const client = await createAscClient();
    const app = await findApp(client, listing.bundleId);
    console.log(`\napp info`);
    await applyAppInfo(client, listing, await editableAppInfo(client, app.id));
    console.log(`\nversion`);
    const { version, state } = await editableVersion(client, app.id);
    await applyVersion(client, listing, version, state);
    console.log("\nDone. Still by hand in App Store Connect: screenshots, App Privacy, pricing (Free) and availability, the build, the submission.");
}

main().catch((error) => {
    explainError(error);
    process.exit(1);
});
