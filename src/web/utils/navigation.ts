import { Capacitor } from "@capacitor/core";

/**
 * Navigate to a route, using window.location on native (Capacitor)
 * because Next.js router.push relies on .txt RSC payload files
 * which are stripped from the Android APK.
 *
 * On web, falls back to the provided Next.js router.push.
 */
export function navigateTo(
    path: string,
    routerPush: (path: string) => void,
) {
    if (Capacitor.isNativePlatform()) {
        window.location.assign(toNativeHref(path));
    } else {
        routerPush(path);
    }
}

/**
 * Convert a Next.js route path to a .html path for Capacitor.
 * Examples:
 *   /dashboard            -> /dashboard.html
 *   /prepare?action=prep  -> /prepare.html?action=prep
 *   /mock?action=mock     -> /mock.html?action=mock
 *   /progress#streak      -> /progress.html#streak
 *   /                     -> /index.html
 */
export function toHtmlPath(path: string): string {
    const hashIndex = path.indexOf("#");
    const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
    const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
    const [pathname, query] = withoutHash.split("?");
    let htmlPathname: string;
    if (pathname === "" || pathname === "/") {
        htmlPathname = "/index.html";
    } else if (pathname.endsWith(".html")) {
        htmlPathname = pathname;
    } else {
        htmlPathname = `${pathname.replace(/\/$/, "")}.html`;
    }
    return `${htmlPathname}${query ? `?${query}` : ""}${hash}`;
}

/** Public website, used on native for pages that only exist on the web. */
const WEBSITE = "https://www.lebenindeutschland.org";

/** Routes that are removed from the Android bundle (see scripts/prepare-android.sh). */
const WEB_ONLY_PREFIXES = ["/question-catalogue", "/pruefstellen", "/privacy-policy"];

/** True for in-app paths that do not exist in the Android bundle. */
export function isWebOnlyPath(path: string): boolean {
    return path.startsWith("/#") || WEB_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * The href to use inside the Android app: web-only pages open the public
 * website, everything else becomes a bundled .html file.
 */
export function toNativeHref(path: string): string {
    if (/^[a-z]+:/i.test(path)) {
        return path;
    }
    if (isWebOnlyPath(path)) {
        return `${WEBSITE}${path}`;
    }
    return toHtmlPath(path);
}
