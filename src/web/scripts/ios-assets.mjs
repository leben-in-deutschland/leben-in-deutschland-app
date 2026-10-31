#!/usr/bin/env node
/**
 * ios-assets.mjs
 *
 * Renders the iOS app icon and launch images into the Xcode asset catalog
 * from the app icon the web and Android builds already use
 * (`public/android-chrome-512x512.png`, the map on transparency):
 *
 * - AppIcon: 1024 x 1024, opaque white behind the map (the App Store rejects
 *   alpha), map at 78 % of the width - the same look as the Android adaptive
 *   icon (white background, inset map).
 * - Splash (launch screen): 2732 x 2732 on the app background, light and
 *   dark, map at 20 % of the width; the LaunchScreen storyboard scales it to
 *   fill the screen, so the map stays centred on every device.
 *
 * Usage: npm run assets:ios   (then commit src/ios/App/App/Assets.xcassets)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(here, "../public/android-chrome-512x512.png");
const CATALOG = path.join(here, "../../ios/App/App/Assets.xcassets");

const ICON = { size: 1024, mapShare: 0.78, background: "#ffffff" };
const SPLASH = {
    size: 2732,
    mapShare: 0.2,
    // Page background of the app, light and dark (see `themeColor` in app/layout.tsx).
    light: "#F2F3F5",
    dark: "#140E10",
};

async function map(width) {
    return sharp(SOURCE).resize(width, width, { fit: "contain", kernel: sharp.kernel.lanczos3 }).png().toBuffer();
}

async function canvas(size, background, logo) {
    return sharp({ create: { width: size, height: size, channels: 3, background } })
        .composite([{ input: logo, gravity: "centre" }])
        .flatten({ background })
        .removeAlpha()
        .png({ compressionLevel: 9 })
        .toBuffer();
}

async function writeIcon() {
    const dir = path.join(CATALOG, "AppIcon.appiconset");
    await mkdir(dir, { recursive: true });
    const logo = await map(Math.round(ICON.size * ICON.mapShare));
    await writeFile(path.join(dir, "AppIcon-512@2x.png"), await canvas(ICON.size, ICON.background, logo));
    await writeFile(
        path.join(dir, "Contents.json"),
        JSON.stringify(
            {
                images: [{ filename: "AppIcon-512@2x.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
                info: { author: "xcode", version: 1 },
            },
            null,
            2,
        ) + "\n",
    );
    console.log("AppIcon.appiconset/AppIcon-512@2x.png (1024 x 1024, no alpha)");
}

async function writeSplash() {
    const dir = path.join(CATALOG, "Splash.imageset");
    await mkdir(dir, { recursive: true });
    const logo = await map(Math.round(SPLASH.size * SPLASH.mapShare));
    const light = await canvas(SPLASH.size, SPLASH.light, logo);
    const dark = await canvas(SPLASH.size, SPLASH.dark, logo);
    const images = [];
    for (const [scale, suffix] of [["1x", "-2"], ["2x", "-1"], ["3x", ""]]) {
        const lightName = `splash-2732x2732${suffix}.png`;
        const darkName = `splash-2732x2732${suffix}-dark.png`;
        await writeFile(path.join(dir, lightName), light);
        await writeFile(path.join(dir, darkName), dark);
        images.push({ filename: lightName, idiom: "universal", scale });
        images.push({ appearances: [{ appearance: "luminosity", value: "dark" }], filename: darkName, idiom: "universal", scale });
    }
    await writeFile(path.join(dir, "Contents.json"), JSON.stringify({ images, info: { author: "xcode", version: 1 } }, null, 2) + "\n");
    console.log("Splash.imageset: 2732 x 2732 light and dark at 1x, 2x, 3x");
}

await writeIcon();
await writeSplash();
