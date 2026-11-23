/**
 * Route groups for the app shell.
 *
 * App routes show the learner tab bar and need a learner record (onboarding
 * runs first). Public routes are the marketing and reference pages; shared
 * routes are public pages that the apps show among the learner screens.
 * Paths may arrive as "/dashboard", "/dashboard/" or "/dashboard.html"
 * (Android).
 */

export const TAB_ROUTES = ["/dashboard", "/practice", "/mock", "/progress", "/settings"] as const;
export const APP_ROUTES = [...TAB_ROUTES, "/prepare"] as const;

/**
 * Pages that work with and without a learner record: public pages on the
 * website, learner screens with the tab bar inside the apps (ADR-050).
 */
export const SHARED_ROUTES = ["/termine"] as const;

/** "/termine" and "/termine/<state>". */
export function isSharedRoute(pathname: string | null | undefined): boolean {
    const path = normalizePath(pathname);
    return SHARED_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

/** "/settings/<section>": a settings sub-page (the hub lists them). */
export function isSettingsSubpage(pathname: string | null | undefined): boolean {
    return /^\/settings\/[a-z-]+$/.test(normalizePath(pathname));
}

/** "/dashboard.html" -> "/dashboard", "/practice/" -> "/practice", "/index.html" -> "/". */
export function normalizePath(pathname: string | null | undefined): string {
    if (!pathname) {
        return "/";
    }
    let path = pathname.split(/[?#]/)[0];
    if (path === "/index.html") {
        return "/";
    }
    if (path.endsWith(".html")) {
        path = path.slice(0, -5);
    }
    if (path.length > 1 && path.endsWith("/")) {
        path = path.slice(0, -1);
    }
    return path || "/";
}

export function isAppRoute(pathname: string | null | undefined): boolean {
    const path = normalizePath(pathname);
    return (APP_ROUTES as readonly string[]).includes(path) || isSettingsSubpage(path);
}

/** Learner screens that hide the tab bar and header for focus. */
export function isFocusRoute(pathname: string | null | undefined): boolean {
    return normalizePath(pathname) === "/prepare";
}

/** The tab a path belongs to, for highlighting navigation. */
export function activeTab(pathname: string | null | undefined): (typeof TAB_ROUTES)[number] | null {
    const path = normalizePath(pathname);
    if (path === "/prepare") {
        return "/practice";
    }
    if (isSettingsSubpage(path)) {
        return "/settings";
    }
    return (TAB_ROUTES as readonly string[]).includes(path) ? (path as (typeof TAB_ROUTES)[number]) : null;
}
