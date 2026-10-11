"use client";

import { useEffect, useSyncExternalStore } from "react";

/*
 * Focus mode hides the header and the tab bar while a learner is inside a
 * practice session or a running mock exam. Pages switch it on with
 * `useFocusMode(true)`; it switches off again when the page unmounts.
 */

let focusActive = false;
const listeners = new Set<() => void>();

function setFocus(active: boolean) {
    if (focusActive !== active) {
        focusActive = active;
        listeners.forEach((listener) => listener());
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Turns focus mode on while `active` is true and the calling component is mounted. */
export function useFocusMode(active: boolean): void {
    useEffect(() => {
        setFocus(active);
        return () => setFocus(false);
    }, [active]);
}

export function useIsFocusMode(): boolean {
    return useSyncExternalStore(subscribe, () => focusActive, () => false);
}
