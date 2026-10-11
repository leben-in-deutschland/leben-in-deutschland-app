"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { getTranslations } from "@/data/data";
import { User } from "@/types/user";
import { normalizeUser } from "./user-defaults";
import { Translations } from "./i18n";

/**
 * Client-side access to the stored learner record.
 *
 * Components read the record with `useUser()` and change it with
 * `updateUser()`. Every save dispatches the existing `user` window event, so
 * all mounted components re-render with the new record. Reads are cached by
 * the raw stored string, which keeps the snapshot stable for React.
 *
 * During prerendering and the first hydration pass there is no browser
 * storage, so `useUser()` returns `undefined` ("not loaded yet"). After that it
 * returns the record, or `null` when none exists.
 */

const USER_KEY = "user";
const LANGUAGE_KEY = "app-language";

let cachedRaw: string | null | undefined;
let cachedUser: User | null = null;

function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function subscribeToUser(onChange: () => void): () => void {
    window.addEventListener("user", onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener("user", onChange);
        window.removeEventListener("storage", onChange);
    };
}

/** Current learner record, normalized. Safe to call outside React. */
export function readUser(): User | null {
    if (typeof window === "undefined") {
        return null;
    }
    const raw = readStorage(USER_KEY);
    if (raw !== cachedRaw) {
        cachedRaw = raw;
        try {
            cachedUser = raw ? normalizeUser(JSON.parse(raw)) : null;
        } catch {
            cachedUser = null;
        }
    }
    return cachedUser;
}

/** Saves a learner record and notifies every subscriber. Returns false when storage fails. */
export function writeUser(user: User): boolean {
    try {
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
        return false;
    }
    window.dispatchEvent(new StorageEvent("user"));
    return true;
}

/**
 * Applies a change to a private copy of the current record and saves it.
 * The mutator may edit the draft in place or return a new object.
 * Returns the saved record, or null when there is no record.
 */
export function updateUser(mutator: (draft: User) => User | void): User | null {
    const current = readUser();
    if (!current) {
        return null;
    }
    const draft = JSON.parse(JSON.stringify(current)) as User;
    const next = mutator(draft) ?? draft;
    writeUser(next);
    return next;
}

/** The learner record: `undefined` while loading, `null` when none exists. */
export function useUser(): User | null | undefined {
    return useSyncExternalStore(subscribeToUser, readUser, () => undefined);
}

/* ------------------------------------------------------------------ */
/*  Language before and after onboarding                              */
/* ------------------------------------------------------------------ */

function readLanguage(): string {
    const user = readUser();
    if (user) {
        return user.appLanguage === "en" ? "en" : "de";
    }
    return readStorage(LANGUAGE_KEY) === "en" ? "en" : "de";
}

/** True once a record or an earlier choice (for example on the public pages) decides the language. */
export function hasLanguageChoice(): boolean {
    return readUser() !== null || readStorage(LANGUAGE_KEY) !== null;
}

/** Sets the interface language. Updates the learner record when there is one. */
export function setAppLanguage(language: "de" | "en"): void {
    try {
        window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
        /* storage unavailable: the choice lasts for this session only */
    }
    if (readUser()) {
        updateUser((draft) => {
            draft.appLanguage = language;
        });
    } else {
        window.dispatchEvent(new StorageEvent("user"));
    }
}

/** "de" or "en". German until the client knows better. */
export function useAppLanguage(): "de" | "en" {
    return useSyncExternalStore(subscribeToUser, readLanguage, () => "de") as "de" | "en";
}

/** Translations for the current interface language. */
export function useTranslations(): Translations {
    return getTranslations(useAppLanguage()) as Translations;
}

/* ------------------------------------------------------------------ */
/*  Environment                                                        */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => {};

/** True inside the Android (Capacitor) app. False while prerendering. */
export function useIsNative(): boolean {
    return useSyncExternalStore(noopSubscribe, () => Capacitor.isNativePlatform(), () => false);
}

/** False during prerendering and hydration, true afterwards. */
export function useHydrated(): boolean {
    return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
