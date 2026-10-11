import { describe, it, expect } from "vitest";
import {
    getCategoryCounts,
    getQuestion,
    getQuestionBank,
    getRelevantQuestions,
    getStateQuestions,
    isGeneralQuestion,
    isRelevantQuestion,
    isStateQuestion,
    normalizeCategory,
} from "@/utils/question-bank";
import { categories } from "@/types/question";

describe("question bank", () => {
    it("loads the catalogue once and reuses it", () => {
        expect(getQuestionBank()).toBe(getQuestionBank());
        expect(getQuestionBank().length).toBeGreaterThan(300);
    });

    it("cleans category names with stray quotes", () => {
        expect(normalizeCategory("'Elections'")).toBe("Elections");
        expect(normalizeCategory(" \"Law & Governance\" ")).toBe("Law & Governance");
        expect(normalizeCategory("Unknown topic")).toBe("General");
        expect(normalizeCategory(undefined)).toBe("General");
        for (const question of getQuestionBank()) {
            expect(categories).toContain(question.category);
        }
    });

    it("tells general and state questions apart", () => {
        expect(isGeneralQuestion("42")).toBe(true);
        expect(isGeneralQuestion("BE-3")).toBe(false);
        expect(isStateQuestion("BE-3", "BE")).toBe(true);
        expect(isStateQuestion("BB-3", "BE")).toBe(false);
        expect(isStateQuestion("BE-3", "")).toBe(false);
        expect(isRelevantQuestion("7", "HH")).toBe(true);
        expect(isRelevantQuestion("HE-1", "HH")).toBe(false);
    });

    it("builds the learner's catalogue: 300 general plus 10 state questions", () => {
        const berlin = getRelevantQuestions("BE");
        expect(berlin).toHaveLength(310);
        expect(berlin.filter((question) => !isGeneralQuestion(question.num)).every((question) => question.num.startsWith("BE-"))).toBe(true);
        expect(getStateQuestions("BY")).toHaveLength(10);
    });

    it("looks questions up by number", () => {
        expect(getQuestion("1")?.num).toBe("1");
        expect(getQuestion("TH-10")?.num).toBe("TH-10");
        expect(getQuestion("999")).toBeUndefined();
    });

    it("counts questions per category for a state", () => {
        const counts = getCategoryCounts("BE");
        expect(counts.reduce((sum, entry) => sum + entry.total, 0)).toBe(310);
        expect(counts.every((entry) => entry.total > 0)).toBe(true);
    });
});
