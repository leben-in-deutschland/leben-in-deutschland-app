/*
 * The engagement toasts ("goal reached", "achievements unlocked") point at
 * modern pages. A learner on the classic design must not see them; the
 * inbox items are still stored, so they appear after a switch.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    toast: vi.fn(),
}));

vi.mock("react-toastify", () => ({ toast: mocks.toast }));
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/dashboard",
}));
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
    registerPlugin: () => ({ setStyle: vi.fn(async () => undefined) }),
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })), minimizeApp: vi.fn() } }));
vi.mock("@capawesome/capacitor-android-edge-to-edge-support", () => ({ EdgeToEdge: { setBackgroundColor: vi.fn(async () => undefined), enable: vi.fn(async () => undefined) } }));
vi.mock("@/services/notifications", () => ({
    syncNativeNotifications: vi.fn(async () => 0),
    addNotificationTapListener: () => () => undefined,
}));

import { useAppEffects } from "@/components/shell/use-app-effects";
import type { User } from "@/types/user";
import { dayKey } from "@/utils/date-utils";
import { setUiMode, UI_MODE_KEY } from "@/utils/ui-mode";
import { createNewUser } from "@/utils/user-defaults";
import { readUser, updateUser, writeUser } from "@/utils/user-store";

const BERLIN = { name: "Berlin", code: "BE", eng: "Berlin", capital: "Berlin" };

function Effects() {
    useAppEffects();
    return null;
}

/** A finished record with the daily goal still open today. */
function finishedRecord(): User {
    const user = createNewUser({ state: BERLIN, language: "de" });
    return { ...user, preferences: { ...user.preferences!, dailyGoal: 3 } };
}

describe("engagement toasts and the classic design", () => {
    let root: Root | null = null;

    beforeEach(() => {
        localStorage.clear();
        mocks.toast.mockClear();
    });

    afterEach(() => {
        act(() => root?.unmount());
        root = null;
    });

    async function mount() {
        const container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root!.render(<Effects />);
        });
    }

    /** Answers enough questions today to meet the goal, which adds a "goal" inbox item. */
    async function meetTodaysGoal() {
        await act(async () => {
            updateUser((draft) => {
                draft.dailyProgress = [{ date: dayKey(), correct: 3, incorrect: 0, attempted: 3, skipped: 0, flagged: 0, answered: 3 }];
                return draft;
            });
        });
    }

    it("shows the goal toast in the modern design", async () => {
        writeUser(finishedRecord());
        setUiMode("modern");
        await mount();
        expect(mocks.toast).not.toHaveBeenCalled();

        await meetTodaysGoal();

        expect(mocks.toast).toHaveBeenCalled();
        expect(mocks.toast.mock.calls.some((call) => String(call[0]).includes("Tagesziel"))).toBe(true);
        expect((readUser()?.inbox ?? []).some((item) => item.type === "goal")).toBe(true);
    });

    it("stores the item silently in the classic design", async () => {
        writeUser(finishedRecord());
        setUiMode("classic");
        await mount();

        await meetTodaysGoal();

        expect(mocks.toast).not.toHaveBeenCalled();
        expect((readUser()?.inbox ?? []).some((item) => item.type === "goal")).toBe(true);
    });

    it("stays silent while the upgraded learner still has to choose", async () => {
        writeUser(finishedRecord());
        expect(localStorage.getItem(UI_MODE_KEY)).toBeNull();
        await mount();

        await meetTodaysGoal();

        expect(mocks.toast).not.toHaveBeenCalled();
    });
});
