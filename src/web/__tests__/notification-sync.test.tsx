/*
 * Regression: finishing onboarding is followed within milliseconds by the
 * startup stamp and the welcome inbox items. Those writes keep the same
 * notification signature, and they used to cancel the debounced sync, so a
 * new learner's reminders were never scheduled on Android.
 *
 * The cards also carry the learner's numbers, so practice results must lead
 * to a new plan while unrelated changes must not.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    sync: vi.fn(async (_user: User | null, _t: unknown) => 7),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/dashboard",
}));
vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
    registerPlugin: () => ({ setStyle: vi.fn(async () => undefined) }),
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })), minimizeApp: vi.fn() } }));
vi.mock("@capawesome/capacitor-android-edge-to-edge-support", () => ({ EdgeToEdge: { setBackgroundColor: vi.fn(async () => undefined), enable: vi.fn(async () => undefined) } }));
vi.mock("@/services/notifications", () => ({
    syncNativeNotifications: mocks.sync,
    addNotificationTapListener: () => () => undefined,
    getNotificationPermission: vi.fn(async () => "granted"),
    requestNotificationPermission: vi.fn(async () => "granted"),
    sendTestNotification: vi.fn(),
}));
// The classic 2.0 screens are not under test here (and chart.js cannot run in jsdom).
vi.mock("@/classic/classic-app", () => ({ ClassicApp: () => <div data-testid="classic-app" /> }));

import { AppShell } from "@/components/shell/app-shell";
import { completeOnboarding } from "@/components/onboarding/onboarding-logic";
import type { User, UserQuestionProgress } from "@/types/user";
import { setUiMode } from "@/utils/ui-mode";
import { readUser, updateUser, writeUser } from "@/utils/user-store";

function answer(num: string, answeredCorrectly: boolean): UserQuestionProgress {
    return { num, answeredCorrectly, skipped: false, answerSelected: "a", flagged: false };
}

describe("native notification sync after onboarding", () => {
    let root: Root | null = null;
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        act(() => root?.unmount());
        vi.useRealTimers();
    });

    async function mount() {
        const container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root!.render(<AppShell><div>home</div></AppShell>);
        });
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });
    }

    async function finishOnboarding() {
        await act(async () => {
            // Same order as OnboardingFlow.finish(): the design first, then the record.
            setUiMode("modern");
            writeUser(completeOnboarding(readUser(), {
                state: { name: "Hamburg", code: "HH", eng: "Hamburg", capital: "Hamburg" },
                language: "de",
                dailyGoal: 20,
                remindersEnabled: true,
                reminderTime: "18:00",
            }));
        });
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });
    }

    /** Saves a change to the record and lets the 800 ms debounce run out. */
    async function change(mutate: (draft: User) => void) {
        await act(async () => {
            updateUser((draft) => {
                mutate(draft);
            });
        });
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });
    }

    it("schedules reminders right after onboarding completes", async () => {
        await mount();
        mocks.sync.mockClear();
        await finishOnboarding();
        const synced = mocks.sync.mock.calls.map((call) => call[0]);
        expect(synced.length).toBeGreaterThan(0);
        expect(synced.at(-1)?.onboardingCompleted).toBe(true);
        expect(synced.at(-1)?.state.stateCode).toBe("HH");
    });

    it("plans again after a correct answer, a wrong answer, and a new review item", async () => {
        await mount();
        await finishOnboarding();

        mocks.sync.mockClear();
        await change((draft) => {
            draft.questionProgress.push(answer("1", true));
        });
        expect(mocks.sync).toHaveBeenCalledTimes(1);
        expect(mocks.sync.mock.calls[0][0]?.questionProgress).toHaveLength(1);

        mocks.sync.mockClear();
        await change((draft) => {
            draft.questionProgress.push(answer("2", false));
        });
        expect(mocks.sync).toHaveBeenCalledTimes(1);

        mocks.sync.mockClear();
        await change((draft) => {
            draft.reviewSchedule = [{ num: "2", box: 1, due: "2026-10-12", lastReviewed: "2026-10-11" }];
        });
        expect(mocks.sync).toHaveBeenCalledTimes(1);
        expect(mocks.sync.mock.calls[0][0]?.reviewSchedule).toHaveLength(1);
    });

    it("plans again after a mock exam and a new nickname", async () => {
        await mount();
        await finishOnboarding();

        mocks.sync.mockClear();
        await change((draft) => {
            draft.testProgress.push({ datetime: "2026-10-11T10:00:00.000Z", timeTake: "00:10:00", passed: true, cancelled: false, questions: [] });
        });
        expect(mocks.sync).toHaveBeenCalledTimes(1);
        expect(mocks.sync.mock.calls[0][0]?.testProgress).toHaveLength(1);

        mocks.sync.mockClear();
        await change((draft) => {
            draft.nickname = "Ada";
        });
        expect(mocks.sync).toHaveBeenCalledTimes(1);
        expect(mocks.sync.mock.calls[0][0]?.nickname).toBe("Ada");
    });

    it("does not plan again for changes the cards do not show", async () => {
        await mount();
        await finishOnboarding();

        mocks.sync.mockClear();
        await change((draft) => {
            draft.lastOpenedAt = "2026-10-11T09:00:00.000Z";
            draft.preferences!.haptics = false;
            draft.questionProgress.push({ num: "3", answeredCorrectly: null, skipped: true, answerSelected: null, flagged: true });
        });
        expect(mocks.sync).not.toHaveBeenCalled();
    });

    it("sends one sync for several quick changes", async () => {
        await mount();
        await finishOnboarding();

        mocks.sync.mockClear();
        await act(async () => {
            updateUser((draft) => {
                draft.questionProgress.push(answer("1", true));
            });
            vi.advanceTimersByTime(300);
            updateUser((draft) => {
                draft.questionProgress.push(answer("2", true));
            });
            vi.advanceTimersByTime(300);
            updateUser((draft) => {
                draft.questionProgress.push(answer("3", false));
            });
        });
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });
        expect(mocks.sync).toHaveBeenCalledTimes(1);
        expect(mocks.sync.mock.calls[0][0]?.questionProgress).toHaveLength(3);
    });
});
