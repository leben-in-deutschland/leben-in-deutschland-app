// Makes sure an App Store provisioning profile exists for the app and the
// given Apple Distribution certificate, and writes it where Xcode looks
// (`~/Library/MobileDevice/Provisioning Profiles`), so `xcodebuild archive`
// can sign with CODE_SIGN_STYLE=Manual on a machine that has only the
// distribution certificate - a CI runner. Profiles are immutable: when the
// named profile no longer matches (certificate renewed, state INVALID) it is
// deleted and created again.
//
//   node src/store/asc-profile.mjs --serial <certificate serial, hex>            # ensure, download, install
//   node src/store/asc-profile.mjs --serial <hex> --out <dir>                      # write the .mobileprovision into <dir> instead
//   node src/store/asc-profile.mjs --list                                          # distribution certificates and App Store profiles of the team
//
// The serial comes from the certificate in the keychain:
//   security find-certificate -c "Apple Distribution" -p <keychain> | openssl x509 -noout -serial
//
// Credentials (see lib/asc-api.mjs): ASC_KEY_ID, ASC_ISSUER_ID and the .p8 key
// through ASC_API_KEY_PATH or ASC_API_KEY_BASE64. Creating profiles needs the
// App Manager or Admin role. Nothing secret is printed: the profile is written
// to disk only, and the Team ID inside it stays there.
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAscClient, explainError, fail, readBundleId } from "./lib/asc-api.mjs";

const PROFILE_TYPE = "IOS_APP_STORE";
const DEFAULT_NAME = "Leben in Deutschland App Store";
const DEFAULT_OUT = path.join(os.homedir(), "Library/MobileDevice/Provisioning Profiles");

function parseArgs(argv) {
    const args = { serial: null, out: DEFAULT_OUT, name: DEFAULT_NAME, list: false, help: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--serial") args.serial = argv[++i];
        else if (arg === "--out") args.out = argv[++i];
        else if (arg === "--name") args.name = argv[++i];
        else if (arg === "--list") args.list = true;
        else if (arg === "--help" || arg === "-h") args.help = true;
        else fail(`unknown argument ${arg} (see --help)`);
    }
    return args;
}

function usage() {
    console.log(`Usage: node src/store/asc-profile.mjs --serial <hex> [--out <dir>] [--name <profile name>]
       node src/store/asc-profile.mjs --list

  --serial  serial number of the Apple Distribution certificate the profile must include
  --out     directory for the .mobileprovision (default: ${DEFAULT_OUT})
  --name    profile name in the developer portal (default: "${DEFAULT_NAME}")
  --list    show the team's distribution certificates and App Store profiles

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_PATH or ASC_API_KEY_BASE64, ASC_BUNDLE_ID (optional override).`);
}

const normalizeSerial = (value) => String(value ?? "").replace(/^serial=/i, "").replace(/[^0-9a-f]/gi, "").replace(/^0+/, "").toUpperCase();

async function findBundleId(client, identifier) {
    const records = await client.list("/v1/bundleIds", { query: { "filter[identifier]": identifier, "filter[platform]": "IOS" } });
    const record = records.find((item) => item.attributes?.identifier === identifier) ?? records.find((item) => item.attributes?.identifier === identifier.toLowerCase());
    if (!record) {
        fail(`no App ID ${identifier} in this team - register it in Certificates, Identifiers & Profiles first (src/store/README.md, App Store Connect, step 2)`);
    }
    return record;
}

async function distributionCertificates(client) {
    const certificates = await client.list("/v1/certificates", { query: { "filter[certificateType]": "DISTRIBUTION,IOS_DISTRIBUTION" } });
    return certificates.filter((item) => item.attributes?.certificateType === "DISTRIBUTION" || item.attributes?.certificateType === "IOS_DISTRIBUTION");
}

async function appStoreProfiles(client) {
    return client.list("/v1/profiles", { query: { "filter[profileType]": PROFILE_TYPE, include: "bundleId,certificates", "fields[certificates]": "serialNumber" } });
}

function describeProfile(profile) {
    const a = profile.attributes ?? {};
    return `${a.name} (${a.profileState}, expires ${String(a.expirationDate ?? "").slice(0, 10)})`;
}

async function list(client) {
    const certificates = await distributionCertificates(client);
    console.log(`${certificates.length} distribution certificate(s)`);
    for (const certificate of certificates) {
        const a = certificate.attributes;
        console.log(`  ${a.certificateType}  serial …${normalizeSerial(a.serialNumber).slice(-6)}  expires ${String(a.expirationDate ?? "").slice(0, 10)}`);
    }
    const profiles = await appStoreProfiles(client);
    console.log(`${profiles.length} App Store profile(s)`);
    for (const profile of profiles) {
        console.log(`  ${describeProfile(profile)} for ${profile.relationships?.bundleId?.data?.id ? "bundle id record " + profile.relationships.bundleId.data.id : "?"}`);
    }
}

async function ensureProfile(client, { serial, name, out }) {
    const bundleId = readBundleId();
    const wantedSerial = normalizeSerial(serial);
    if (!wantedSerial) {
        fail("--serial must be the hexadecimal serial number of the Apple Distribution certificate");
    }
    const record = await findBundleId(client, bundleId);
    const certificate = (await distributionCertificates(client)).find((item) => normalizeSerial(item.attributes?.serialNumber) === wantedSerial);
    if (!certificate) {
        fail("no Apple Distribution certificate with that serial number in this team - the .p12 and the team do not belong together, or the certificate was revoked");
    }
    console.log(`certificate: Apple Distribution, expires ${String(certificate.attributes.expirationDate ?? "").slice(0, 10)}`);

    const profiles = await appStoreProfiles(client);
    const matches = (profile) =>
        profile.relationships?.bundleId?.data?.id === record.id &&
        (profile.relationships?.certificates?.data ?? []).some((item) => item.id === certificate.id) &&
        profile.attributes?.profileState === "ACTIVE";
    let profile = profiles.find((item) => item.attributes?.name === name && matches(item)) ?? profiles.find(matches);
    if (profile) {
        console.log(`profile: reusing ${describeProfile(profile)}`);
    } else {
        for (const stale of profiles.filter((item) => item.attributes?.name === name)) {
            await client.request("DELETE", `/v1/profiles/${stale.id}`);
            console.log(`profile: removed stale ${describeProfile(stale)}`);
        }
        profile = (
            await client.request("POST", "/v1/profiles", {
                body: {
                    data: {
                        type: "profiles",
                        attributes: { name, profileType: PROFILE_TYPE },
                        relationships: {
                            bundleId: { data: { type: "bundleIds", id: record.id } },
                            certificates: { data: [{ type: "certificates", id: certificate.id }] },
                        },
                    },
                },
            })
        ).data;
        console.log(`profile: created ${describeProfile(profile)}`);
    }
    if (!profile.attributes?.profileContent) {
        profile = (await client.request("GET", `/v1/profiles/${profile.id}`)).data;
    }
    const content = Buffer.from(profile.attributes.profileContent, "base64");
    mkdirSync(out, { recursive: true });
    const file = path.join(out, `${profile.attributes.uuid}.mobileprovision`);
    writeFileSync(file, content);
    console.log(`installed ${file}`);
    return profile.attributes.name;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }
    const client = await createAscClient();
    if (args.list) {
        await list(client);
        return;
    }
    if (!args.serial) {
        fail("--serial is required (or use --list)");
    }
    const name = await ensureProfile(client, args);
    if (process.env.GITHUB_OUTPUT) {
        writeFileSync(process.env.GITHUB_OUTPUT, `profile_name=${name}\n`, { flag: "a" });
    }
}

main().catch((error) => {
    explainError(error);
    process.exit(1);
});
