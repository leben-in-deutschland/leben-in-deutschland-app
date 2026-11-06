// @vitest-environment jsdom
/*
 * The mock-exam results review shows each question picture with the same alt
 * text as practice and the catalogue: the question number and, on
 * four-picture questions, the official captions "Bild 1" .. "Bild 4".
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReviewEntries } from "@/components/mock/exam-logic";
import { MockResults } from "@/components/mock/mock-results";
import { getTranslations } from "@/data/data";
import type { MockTestProgress } from "@/types/user";
import type { Translations } from "@/utils/i18n";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/mock",
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = getTranslations("de") as Translations;
let root: Root;
let container: HTMLDivElement;

function exam(nums: string[]): MockTestProgress {
    return {
        datetime: "2026-11-05T10:00:00.000Z",
        timeTake: "600",
        passed: false,
        cancelled: false,
        questions: nums.map((num) => ({ num, answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false })),
    };
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function openReview(num: string) {
    const test = exam([num]);
    await act(async () => {
        root.render(<MockResults test={test} entries={buildReviewEntries(test)} mode="review" t={t} language="de" />);
    });
    await flush();
    const item = container.querySelector('section[aria-labelledby="exam-review-heading"] button[aria-expanded]');
    if (!item) throw new Error("review item not found");
    act(() => {
        (item as HTMLElement).click();
    });
    await flush();
    await flush();
}

function alt(): string | null {
    return container.querySelector('section[aria-labelledby="exam-review-heading"] img')?.getAttribute("alt") ?? null;
}

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe("MockResults review picture alt text", () => {
    it("names the question number and the Bild 1..4 captions", async () => {
        await openReview("56");
        expect(alt()).toBe("Bild zur Frage (Frage 56): Bild 1, Bild 2, Bild 3, Bild 4");
    });

    it("names Bild 1..4 on a numbered-picture question", async () => {
        await openReview("212");
        expect(alt()).toBe("Bild zur Frage (Frage 212): Bild 1, Bild 2, Bild 3, Bild 4");
    });

    it("a single picture names the question number", async () => {
        await openReview("62");
        expect(alt()).toBe("Bild zur Frage (Frage 62)");
    });
});
