"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useAppNavigate } from "@/components/ui/app-link";
import { activeTab, normalizePath } from "@/utils/routes";

/**
 * Android hardware back button.
 *
 * Capacitor's default is a plain WebView history step, which silently drops
 * a running exam or jumps out of the app. Registering a listener disables
 * that default, so the order here is deliberate:
 *
 * 1. an open dialog or sheet closes (Escape, the same key the web uses),
 * 2. the current screen may take over through `useBackButton`,
 * 3. otherwise the route decides: home minimizes the app, the other tabs
 *    return home, a practice session returns to its hub, and anything else
 *    walks the history when it can.
 */

/** Dispatched on `window` before the default handling; `preventDefault()` claims the press. */
export const BACK_EVENT = "lid:backbutton";

export type BackAction =
    | { type: "dismiss" }
    | { type: "intercepted" }
    | { type: "minimize" }
    | { type: "navigate"; path: string }
    | { type: "history" };

/** Pure decision for one back press. `intercepted` is true when a screen claimed the press. */
export function resolveBackAction(input: {
    pathname: string | null | undefined;
    canGoBack: boolean;
    dialogOpen: boolean;
    intercepted: boolean;
}): BackAction {
    if (input.dialogOpen) {
        return { type: "dismiss" };
    }
    if (input.intercepted) {
        return { type: "intercepted" };
    }
    const path = normalizePath(input.pathname);
    if (path === "/dashboard") {
        return { type: "minimize" };
    }
    if (path === "/prepare") {
        return { type: "navigate", path: "/practice" };
    }
    if (activeTab(path) !== null) {
        return { type: "navigate", path: "/dashboard" };
    }
    return input.canGoBack ? { type: "history" } : { type: "navigate", path: "/dashboard" };
}

function openDialog(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
}

/** Sends Escape into the open overlay; focus is trapped inside it, so the event reaches its handlers. */
function dismissDialog(dialog: HTMLElement) {
    const active = document.activeElement;
    const target = active instanceof HTMLElement && dialog.contains(active) ? active : dialog;
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
}

/** Lets a screen own the back button while `enabled`, for example to show its exit dialog. */
export function useBackButton(handler: () => void, enabled = true) {
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const onBack = (event: Event) => {
            event.preventDefault();
            handler();
        };
        window.addEventListener(BACK_EVENT, onBack);
        return () => window.removeEventListener(BACK_EVENT, onBack);
    }, [handler, enabled]);
}

/** Mounted once by the app shell; does nothing on the web. */
export function useAndroidBackButton() {
    const pathname = usePathname();
    const navigate = useAppNavigate();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            return;
        }
        const listener = App.addListener("backButton", ({ canGoBack }) => {
            const dialog = openDialog();
            // dispatchEvent returns false once a handler called preventDefault().
            const intercepted = dialog === null && !window.dispatchEvent(new Event(BACK_EVENT, { cancelable: true }));
            const action = resolveBackAction({ pathname, canGoBack, dialogOpen: dialog !== null, intercepted });
            switch (action.type) {
                case "dismiss":
                    dismissDialog(dialog as HTMLElement);
                    break;
                case "minimize":
                    void App.minimizeApp();
                    break;
                case "navigate":
                    navigate(action.path);
                    break;
                case "history":
                    window.history.back();
                    break;
                case "intercepted":
                    break;
            }
        });
        return () => {
            void listener.then((handle) => handle.remove());
        };
    }, [pathname, navigate]);
}
