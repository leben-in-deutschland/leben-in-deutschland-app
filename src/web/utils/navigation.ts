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
        // Convert /dashboard to /dashboard.html for Capacitor static file serving
        const htmlPath = toHtmlPath(path);
        window.location.assign(htmlPath);
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
 */
function toHtmlPath(path: string): string {
    const [pathname, query] = path.split("?");
    const htmlPathname = pathname.endsWith(".html") ? pathname : `${pathname}.html`;
    return query ? `${htmlPathname}?${query}` : htmlPathname;
}
