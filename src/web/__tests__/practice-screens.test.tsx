// @vitest-environment jsdom
/* Render tests for the practice hub and the practice session. */
import { HeroUIProvider } from "@heroui/react";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    useSearchParams: () => new URLSearchParams("mode=category"),
    usePathname: () => "/practice",
}));

import { PracticeHub } from "@/components/practice/practice-hub";
import { PracticeSession } from "@/components/practice/practice-session";
import { questionsData } from "@/data/data";
import type { User } from "@/types/user";
import { readUser, useUser } from "@/utils/user-store";

function SessionHarness(props: Omit<React.ComponentProps<typeof PracticeSession>, "user">) {
    const user = useUser();
    return user ? <PracticeSession user={user} {...props} /> : null;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeUser(overrides: Partial<User> = {}): User {
    return {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: "en",
        appFirstTimeOpenDateTime: new Date(2026, 0, 1),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        ...overrides,
    };
}

let root: Root;
let container: HTMLDivElement;

async function render(node: React.ReactNode) {
    await act(async () => {
        root.render(<HeroUIProvider>{node}</HeroUIProvider>);
    });
}

async function click(element: Element | null | undefined) {
    if (!element) {
        throw new Error("element not found");
    }
    await act(async () => {
        (element as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
}

async function key(keyName: string, target: EventTarget = document.body) {
    await act(async () => {
        target.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, bubbles: true, cancelable: true }));
    });
}

beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia =
        window.matchMedia ??
        ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

describe("practice screens render", () => {
    const cardTitles = () => Array.from(container.querySelectorAll("article h3")).map((el) => el.textContent?.trim());
    const moreModesButton = () => container.querySelector<HTMLButtonElement>('[aria-labelledby="practice-modes-title"] button[aria-expanded]');

    it("hub shows the four main modes, the goal, and opens the topic picker from ?mode=category", async () => {
        const user = makeUser();
        window.localStorage.setItem("user", JSON.stringify(user));
        await render(<PracticeHub user={readUser()!} />);
        const text = container.textContent ?? "";
        expect(text).toContain("Practice");
        expect(text).toContain("Study modes");
        expect(text).toContain("Recommended");
        // Four main modes, the recommended one first; the rest wait behind the fold-out.
        expect(cardTitles()).toEqual(["Learn new questions", "Review due", "Fix mistakes", "Quick round"]);
        expect(container.querySelector("article.ring-2 h3")?.textContent).toBe("Learn new questions");
        // Empty main modes stay visible, just disabled.
        expect(Array.from(container.querySelectorAll('article[aria-disabled="true"] h3')).map((el) => el.textContent)).toEqual(["Review due", "Fix mistakes"]);
        expect(text).toContain("Nothing here yet");
        expect(moreModesButton()?.getAttribute("aria-expanded")).toBe("false");
        expect(moreModesButton()?.textContent).toContain("6 more modes");
        expect(text).not.toContain("Marathon");
        // Topic picker opened via the deep link; it renders in a portal on document.body.
        expect(document.body.textContent).toContain("Choose a topic");
        expect(document.body.textContent).toContain("Rights & Freedoms");
        // Session size chips save to the record.
        const chip = Array.from(container.querySelectorAll('[role="radio"]')).find((el) => el.textContent?.trim() === "10");
        await click(chip);
        expect(readUser()?.preferences?.sessionSize).toBe(10);
    });

    it("hub unfolds the other six modes on request and folds them again", async () => {
        window.localStorage.setItem("user", JSON.stringify(makeUser()));
        await render(<PracticeHub user={readUser()!} />);
        await click(moreModesButton());
        expect(moreModesButton()?.getAttribute("aria-expanded")).toBe("true");
        expect(cardTitles()).toEqual([
            "Learn new questions",
            "Review due",
            "Fix mistakes",
            "Quick round",
            "Flagged",
            "Skipped",
            "Your state",
            "By topic",
            "Marathon",
            "Already known",
        ]);
        // Every deep link survives the fold.
        expect(container.querySelector('a[href="/prepare?action=marathon"]')).toBeTruthy();
        expect(container.querySelector('a[href="/prepare?action=state"]')).toBeTruthy();
        expect(container.querySelector('[role="region"] article')).toBeTruthy();
        await click(moreModesButton());
        expect(moreModesButton()?.getAttribute("aria-expanded")).toBe("false");
        expect(container.querySelectorAll("article").length).toBe(4);
    });

    it("hub moves a recommended review backlog to the front and keeps new questions among the four", async () => {
        const user = makeUser({
            reviewSchedule: ["1", "2", "3", "4", "5"].map((num) => ({ num, box: 1, due: "2020-01-01", lastReviewed: "2019-12-25" })),
        });
        window.localStorage.setItem("user", JSON.stringify(user));
        await render(<PracticeHub user={readUser()!} />);
        expect(cardTitles()).toEqual(["Review due", "Fix mistakes", "Quick round", "Learn new questions"]);
        expect(container.querySelector("article.ring-2 h3")?.textContent).toBe("Review due");
        expect(container.querySelector('article[aria-disabled="true"] h3')?.textContent).toBe("Fix mistakes");
    });

    it("session: instant answer, keyboard next, skip, flag, summary, retry", async () => {
        const user = makeUser();
        window.localStorage.setItem("user", JSON.stringify(user));
        await render(<SessionHarness mode="new" sessionSize={2} />);
        expect(container.textContent).toContain("1 / 2");
        const answers = () => Array.from(container.querySelectorAll('[data-answer-list] button')) as HTMLButtonElement[];
        expect(answers().length).toBe(4);

        // Flag with the keyboard.
        await key("f");
        expect(readUser()?.questionProgress.find((p) => p.num === "1")?.flagged).toBe(true);
        expect(container.querySelector('[aria-pressed="true"][aria-label="Remove flag"]')).toBeTruthy();

        // Wrong answer in instant mode: records, reveals, shows the explanation panel.
        const first = readUser()!;
        const wrongIndex = 1; // question 1's solution is a
        await click(answers()[wrongIndex]);
        const after = readUser()!;
        expect(after.questionProgress.find((p) => p.num === "1")?.answeredCorrectly).toBe(false);
        expect(after.dailyProgress.length).toBeGreaterThanOrEqual(first.dailyProgress.length);
        expect(after.dailyProgress.at(-1)?.attempted ?? 0).toBeGreaterThan(0);
        expect(container.textContent).toContain("Not quite");
        expect(container.textContent).toContain("Explanation");
        expect(answers().every((b) => b.disabled)).toBe(true);
        expect(container.textContent).toContain("Next");

        // Enter on the body moves on.
        await key("Enter");
        expect(container.textContent).toContain("2 / 2");
        expect(container.textContent).not.toContain("Flagged for review");
        expect(container.textContent).toContain("Skip");

        // Skip the last one with "s" -> summary.
        await key("s");
        expect(container.textContent).toContain("Session complete");
        expect(container.textContent).toContain("Look at these again");
        expect(container.textContent).toContain("Practice these again");
        expect(readUser()?.questionProgress.find((p) => p.num === "2")?.skipped).toBe(true);

        // Retry starts a new round with only the wrong question.
        const retry = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Practice these again"));
        await click(retry);
        expect(container.textContent).toContain("1 / 1");
        expect(container.textContent).toContain("Mistakes again");
    });

    it("session: confirm mode selects then checks; auto-advance after a correct answer", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const user = makeUser({
            preferences: {
                dailyGoal: 1,
                streakRule: "activity",
                restDays: [],
                examType: "einbuergerung",
                mockTimer: true,
                confirmAnswers: true,
                autoAdvance: true,
                haptics: false,
                largeText: false,
                translationLanguage: "tr",
                sessionSize: 20,
                notificationsEnabled: false,
                reminders: { daily: false, dailyTime: "18:00", streak: false, streakTime: "20:00", weekly: false, examCountdown: false, mockNudge: false, comeback: false },
                tips: false,
            },
        });
        window.localStorage.setItem("user", JSON.stringify(user));
        await render(<SessionHarness mode="new" sessionSize={3} />);
        expect(container.textContent).toContain("Pick an answer, then tap Check.");
        const solution = questionsData().find((question) => question.num === "1")?.solution ?? "a";
        await key(String("abcd".indexOf(solution) + 1)); // select the correct answer for question 1
        expect(container.querySelector('[data-answer-list] button[aria-pressed="true"]')).toBeTruthy();
        expect(readUser()?.questionProgress.length ?? 0).toBe(0);
        await key("Enter"); // check
        expect(readUser()?.questionProgress.find((p) => p.num === "1")?.answeredCorrectly).toBe(true);
        expect(container.textContent).toContain("Correct!");
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(container.textContent).toContain("2 / 3");
        vi.useRealTimers();
    });

    it("session: empty mode shows the empty state with a way on", async () => {
        window.localStorage.setItem("user", JSON.stringify(makeUser()));
        await render(<SessionHarness mode="flagged" />);
        expect(container.textContent).toContain("Nothing to practise here");
        expect(container.textContent).toContain("Back to practice");
        expect(container.querySelector('a[href="/practice"]')).toBeTruthy();
    });
});
