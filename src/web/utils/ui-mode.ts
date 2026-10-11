"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@/types/user";
import { readUser } from "./user-store";

/**
 * Which interface a learner sees: the 2.1 "modern" design or the 2.0
 * "classic" design kept under `src/web/classic/`.
 *
 * The choice lives under its own storage key, apart from the learner record,
 * so nothing the classic code does to the record can lose it. Rules:
 *
 * - No learner record (or onboarding not finished): modern. New learners go
 *   straight to the new design and onboarding stores "modern".
 * - A stored choice always wins.
 * - A finished record without a choice belongs to a learner who upgraded from
 *   2.0: classic, with a one-time prompt offering the new design.
 */

export type UiMode = "classic" | "modern";

export const UI_MODE_KEY = "lid:ui-mode";
const CHANGE_EVENT = "ui-mode";

export interface UiModeState {
    mode: UiMode;
    /** True until the upgraded learner answers the "new design" prompt. */
    promptPending: boolean;
}

export const MODERN_STATE: UiModeState = { mode: "modern", promptPending: false };

/** Pure: decides the interface from the stored choice and the record. */
export function resolveUiMode(stored: string | null | undefined, user: User | null | undefined): UiModeState {
    if (stored === "classic") {
        return { mode: "classic", promptPending: false };
    }
    if (stored === "modern") {
        return MODERN_STATE;
    }
    if (!user || !user.state?.stateCode || !user.onboardingCompleted) {
        return MODERN_STATE;
    }
    return { mode: "classic", promptPending: true };
}

function readStorage(): string | null {
    try {
        return window.localStorage.getItem(UI_MODE_KEY);
    } catch {
        return null;
    }
}

/** The stored choice, or null when the learner never chose. */
export function readUiModeChoice(): UiMode | null {
    if (typeof window === "undefined") {
        return null;
    }
    const stored = readStorage();
    return stored === "classic" || stored === "modern" ? stored : null;
}

/** Current state outside React. */
export function readUiMode(): UiModeState {
    if (typeof window === "undefined") {
        return MODERN_STATE;
    }
    return resolveUiMode(readStorage(), readUser());
}

/** Stores the choice and notifies every subscriber. Returns false when storage fails. */
export function setUiMode(mode: UiMode): boolean {
    let saved = true;
    try {
        window.localStorage.setItem(UI_MODE_KEY, mode);
    } catch {
        saved = false;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return saved;
}

/** Forgets the choice (used when the record is deleted, so a new learner starts modern). */
export function clearUiMode(): void {
    try {
        window.localStorage.removeItem(UI_MODE_KEY);
    } catch {
        /* nothing stored */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("user", onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener("user", onChange);
        window.removeEventListener("storage", onChange);
    };
}

let cachedKey = "";
let cachedState: UiModeState = MODERN_STATE;

function snapshot(): UiModeState {
    const state = readUiMode();
    const key = `${state.mode}|${state.promptPending}`;
    if (key !== cachedKey) {
        cachedKey = key;
        cachedState = state;
    }
    return cachedState;
}

/** Interface state for React: `undefined` while prerendering and hydrating. */
export function useUiMode(): UiModeState | undefined {
    return useSyncExternalStore(subscribe, snapshot, () => undefined);
}
