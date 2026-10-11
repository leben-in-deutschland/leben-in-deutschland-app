/*
 * The interface choice ("classic" 2.0 design or "modern" 2.1 design): the
 * pure rules, the storage helpers with their change event, and the hook that
 * follows both the stored choice and the learner record.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/types/user";
import { createNewUser, normalizeUser } from "@/utils/user-defaults";
import { clearUiMode, MODERN_STATE, readUiMode, readUiModeChoice, resolveUiMode, setUiMode, UI_MODE_KEY, useUiMode } from "@/utils/ui-mode";
import { writeUser } from "@/utils/user-store";
import DEVICE_RECORD from "./fixtures/legacy-user-2.0-device.json";

const BERLIN = { name: "Berlin", code: "BE", eng: "Berlin", capital: "Berlin" };

/** A record as onboarding writes it: state and the finished flag. */
function finishedRecord(): User {
    return createNewUser({ state: BERLIN, language: "de" });
}

/** A record written by version 2.0 before a state was chosen. */
function stateless(): User {
    return { ...finishedRecord(), state: { stateCode: "", stateName: "" }, onboardingCompleted: false };
}

function Probe() {
    const ui = useUiMode();
    return createElement("span", { id: "probe" }, ui === undefined ? "undefined" : `${ui.mode}:${ui.promptPending}`);
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("resolveUiMode", () => {
    it("lets a stored choice win over the record", () => {
        expect(resolveUiMode("classic", null)).toEqual({ mode: "classic", promptPending: false });
        expect(resolveUiMode("classic", finishedRecord())).toEqual({ mode: "classic", promptPending: false });
        expect(resolveUiMode("modern", finishedRecord())).toEqual({ mode: "modern", promptPending: false });
        expect(resolveUiMode("modern", null)).toEqual({ mode: "modern", promptPending: false });
    });

    it("sends new learners and unfinished records to the modern design without a prompt", () => {
        expect(resolveUiMode(null, null)).toEqual(MODERN_STATE);
        expect(resolveUiMode(undefined, undefined)).toEqual(MODERN_STATE);
        expect(resolveUiMode(null, stateless())).toEqual(MODERN_STATE);
        expect(resolveUiMode(null, { ...finishedRecord(), onboardingCompleted: false })).toEqual(MODERN_STATE);
    });

    it("keeps an upgraded learner on the classic design and asks once", () => {
        expect(resolveUiMode(null, finishedRecord())).toEqual({ mode: "classic", promptPending: true });
    });

    it("recognises a record exactly as version 2.0 left it on a device", () => {
        // 2.0 never wrote onboardingCompleted; the read path derives it from the state.
        const upgraded = normalizeUser(DEVICE_RECORD);
        expect(upgraded?.onboardingCompleted).toBe(true);
        expect(resolveUiMode(null, upgraded)).toEqual({ mode: "classic", promptPending: true });
        expect(resolveUiMode(null, normalizeUser({ ...DEVICE_RECORD, state: { stateCode: "", stateName: "" } }))).toEqual(MODERN_STATE);
    });

    it("treats an unknown stored value like no choice", () => {
        expect(resolveUiMode("fancy", finishedRecord())).toEqual({ mode: "classic", promptPending: true });
        expect(resolveUiMode("", null)).toEqual(MODERN_STATE);
    });
});

describe("storage helpers", () => {
    it("stores the choice and announces it", () => {
        const onChange = vi.fn();
        window.addEventListener("ui-mode", onChange);
        try {
            expect(setUiMode("classic")).toBe(true);
            expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("classic");
            expect(readUiModeChoice()).toBe("classic");
            expect(onChange).toHaveBeenCalledTimes(1);

            expect(setUiMode("modern")).toBe(true);
            expect(window.localStorage.getItem(UI_MODE_KEY)).toBe("modern");
            expect(readUiModeChoice()).toBe("modern");
            expect(onChange).toHaveBeenCalledTimes(2);
        } finally {
            window.removeEventListener("ui-mode", onChange);
        }
    });

    it("forgets the choice and announces that too", () => {
        setUiMode("classic");
        const onChange = vi.fn();
        window.addEventListener("ui-mode", onChange);
        try {
            clearUiMode();
            expect(window.localStorage.getItem(UI_MODE_KEY)).toBeNull();
            expect(readUiModeChoice()).toBeNull();
            expect(onChange).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener("ui-mode", onChange);
        }
    });

    it("ignores garbage under the key", () => {
        window.localStorage.setItem(UI_MODE_KEY, "fancy");
        expect(readUiModeChoice()).toBeNull();
        expect(readUiMode()).toEqual(MODERN_STATE);
    });

    it("reads the record when there is no choice", () => {
        writeUser(finishedRecord());
        expect(readUiMode()).toEqual({ mode: "classic", promptPending: true });
        setUiMode("modern");
        expect(readUiMode()).toEqual(MODERN_STATE);
    });

    it("falls back to the modern design when storage cannot be read", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(readUiModeChoice()).toBeNull();
        expect(readUiMode()).toEqual(MODERN_STATE);
    });

    it("still announces a choice that could not be saved", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("full");
        });
        const onChange = vi.fn();
        window.addEventListener("ui-mode", onChange);
        try {
            expect(setUiMode("classic")).toBe(false);
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(() => clearUiMode()).not.toThrow();
        } finally {
            window.removeEventListener("ui-mode", onChange);
        }
    });
});

describe("useUiMode", () => {
    let root: Root | null = null;
    let container: HTMLDivElement | null = null;

    function probeText(): string {
        return container?.querySelector("#probe")?.textContent ?? "";
    }

    function mount() {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => {
            root!.render(createElement(Probe));
        });
    }

    afterEach(() => {
        act(() => root?.unmount());
        container?.remove();
        root = null;
        container = null;
    });

    it("is unknown while prerendering", () => {
        expect(renderToString(createElement(Probe))).toContain("undefined");
    });

    it("starts modern for a new learner and follows every change", () => {
        mount();
        expect(probeText()).toBe("modern:false");

        act(() => {
            setUiMode("classic");
        });
        expect(probeText()).toBe("classic:false");

        act(() => {
            setUiMode("modern");
        });
        expect(probeText()).toBe("modern:false");
    });

    it("notices the record of an upgraded learner and the answer to the prompt", () => {
        mount();
        expect(probeText()).toBe("modern:false");

        // writeUser dispatches the "user" event the hook listens to.
        act(() => {
            writeUser(finishedRecord());
        });
        expect(probeText()).toBe("classic:true");

        act(() => {
            setUiMode("classic");
        });
        expect(probeText()).toBe("classic:false");

        act(() => {
            clearUiMode();
        });
        expect(probeText()).toBe("classic:true");

        act(() => {
            setUiMode("modern");
        });
        expect(probeText()).toBe("modern:false");
    });

    it("stops listening after unmount", () => {
        mount();
        act(() => root!.unmount());
        root = null;
        expect(() => setUiMode("classic")).not.toThrow();
    });
});
