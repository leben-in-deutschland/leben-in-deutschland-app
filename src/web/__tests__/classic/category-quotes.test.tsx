/*
 * Thirteen bundled questions carry a category with stray quotes ("'Elections'"
 * on 153, 190, 198, 282, BY-4, BE-4, MV-3, RP-4, TH-4, and three more). The
 * data stays as it is - installed apps compare the category field when the
 * catalogue updates over the air (ADR-006) - so the classic (2.0) screens clean
 * it with normalizeCategory(): the dashboard's topic doughnuts count those
 * questions, and the quiz chip shows the topic without quotes.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/prepare",
}));
// jsdom has no canvas; chart.js is not under test here.
vi.mock("react-chartjs-2", () => ({
    Doughnut: () => <canvas data-testid="chart" />,
}));

import { buildCategoryData } from "@/classic/components/statistic/category-progress";
import PrepareQuiz from "@/classic/components/prepare-quiz";
import { PrepareQuestionActions } from "@/classic/types/prepare-question";
import { getTranslations, questionsData } from "@/data/data";
import { categories } from "@/types/question";
import type { User } from "@/types/user";
import { normalizeCategory } from "@/utils/question-bank";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeUser(answered: string[] = []): User {
    return {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress: answered.map((num) => ({
            num,
            skipped: false,
            answerSelected: "a",
            flagged: false,
            answeredCorrectly: true,
        })),
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: new Date(),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
    };
}

describe("classic topic statistics", () => {
    const questions = questionsData();

    it("the bundled catalogue still holds quoted categories (the case under test)", () => {
        const quoted = questions.filter((q) => /['"]/.test(q.category ?? ""));
        expect(quoted.length).toBeGreaterThan(0);
        expect(quoted.map((q) => q.num)).toContain("153");
    });

    it("counts every question of a topic, quoted categories included", () => {
        const data = buildCategoryData(makeUser(), questions);
        const elections = data.find((d) => d.key === "Elections");
        const expected = questions.filter((q) => normalizeCategory(q.category) === "Elections").length;
        expect(expected).toBe(65);
        expect(elections?.totalQuestion).toBe(expected);

        for (const category of categories) {
            const total = questions.filter((q) => normalizeCategory(q.category) === category).length;
            expect(data.find((d) => d.key === category)?.totalQuestion).toBe(total);
        }
        // Every question belongs to exactly one doughnut.
        const general = questions.filter((q) => normalizeCategory(q.category) === "General").length;
        expect(data.reduce((sum, d) => sum + d.totalQuestion, 0) + general).toBe(questions.length);
    });

    it("counts progress on a quoted-category question in its topic", () => {
        const data = buildCategoryData(makeUser(["153"]), questions);
        expect(data.find((d) => d.key === "Elections")?.correct).toBe(1);
    });
});

describe("classic quiz topic chip", () => {
    let root: Root | null = null;
    let container: HTMLDivElement | null = null;

    afterEach(() => {
        act(() => root?.unmount());
        container?.remove();
        root = null;
        container = null;
    });

    it("shows the topic of a quoted-category question without quotes", async () => {
        const questions = questionsData();
        expect(questions.find((q) => q.num === "153")?.category).toBe("'Elections'");
        // Questions 1-152 answered, so the next question to prepare is 153.
        const answered = Array.from({ length: 152 }, (_, i) => String(i + 1));
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root!.render(
                <PrepareQuiz
                    originalQuestions={questions}
                    user={makeUser(answered)}
                    prepareQuestion={{ selected: false, action: PrepareQuestionActions.Prepare }}
                    translations={getTranslations("de")}
                />,
            );
        });

        const text = container.textContent ?? "";
        expect(text).toContain("153.");
        expect(text).toContain("Elections");
        expect(text).not.toContain("'Elections'");
        const chip = Array.from(container.querySelectorAll("span")).find((s) => s.textContent?.trim() === "Elections");
        expect(chip).toBeDefined();
    });
});
