/*
 * Renders the real /prepare page in jsdom and checks that the URL decides
 * the session: `?action=` picks the mode, `&start=` the first question (the
 * link of the "question of the day" notification), and a new URL rebuilds
 * the session.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/types/user";
import { getQuestion } from "@/utils/question-bank";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/prepare",
}));

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

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function text(): string {
    return container?.textContent ?? "";
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

/** Renders the page at `/prepare<search>`, reusing the mounted root when there is one. */
async function mount(search: string) {
    window.history.replaceState({}, "", `/prepare${search}`);
    const { default: PreparePage } = await import("@/app/prepare/page");
    if (!root) {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    }
    await act(async () => {
        root!.render(<PreparePage />);
    });
    await flush();
}

function questionText(num: string): string {
    return getQuestion(num)!.question;
}

beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", JSON.stringify(makeUser()));
    window.matchMedia =
        window.matchMedia ??
        ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList);
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    Element.prototype.scrollIntoView = vi.fn();
});

afterEach(async () => {
    if (root) {
        await act(async () => root!.unmount());
    }
    container?.remove();
    root = null;
    container = null;
    window.history.replaceState({}, "", "/");
});

describe("prepare page", () => {
    it("starts a session of the mode in the URL", async () => {
        await mount("?action=new&size=3");
        expect(text()).toContain("1 / 3");
        expect(text()).toContain(questionText("1"));
    });

    it("opens with the start question of the URL and keeps it through the session size", async () => {
        await mount("?action=new&size=3&start=42");
        expect(text()).toContain("1 / 3");
        expect(text()).toContain(questionText("42"));
        expect(text()).not.toContain(questionText("1"));
    });

    it("opens a mode without questions with just the start question", async () => {
        // Nothing is due, so the review mode would be empty without the notification's question.
        await mount("?action=review&start=BE-3");
        expect(text()).toContain("1 / 1");
        expect(text()).toContain(questionText("BE-3"));
        expect(text()).not.toContain("Nothing to practise here");
    });

    it("ignores a start question that is not in the catalogue or not shaped like a number", async () => {
        await mount("?action=new&size=2&start=999");
        expect(text()).toContain("1 / 2");
        expect(text()).toContain(questionText("1"));
        await mount(`?action=new&size=2&start=${encodeURIComponent("../x")}`);
        expect(text()).toContain("1 / 2");
        expect(text()).toContain(questionText("1"));
        await mount("?action=review&start=BY-3");
        expect(text()).toContain("Nothing to practise here");
    });

    it("rebuilds the session when the URL names another start question", async () => {
        await mount("?action=new&size=2&start=42");
        expect(text()).toContain(questionText("42"));
        // Skip the first question: the session has moved on.
        await act(async () => {
            document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true, cancelable: true }));
        });
        expect(text()).toContain("2 / 2");
        // The same page at another URL starts over with the new question.
        await mount("?action=new&size=2&start=77");
        expect(text()).toContain("1 / 2");
        expect(text()).toContain(questionText("77"));
        expect(text()).not.toContain(questionText("42"));
        // Dropping the start question starts over as well.
        await mount("?action=new&size=2");
        expect(text()).toContain("1 / 2");
        expect(text()).toContain(questionText("1"));
    });
});
