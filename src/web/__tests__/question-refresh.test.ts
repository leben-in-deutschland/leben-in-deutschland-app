/*
 * The downloaded question catalogue: only a complete, well-formed file
 * passes; an identical file is not stored; the bank prefers a valid cache of
 * this build at first load and falls back to the bundle otherwise; stale
 * explanations and translations stay hidden for changed questions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { questionsData } from "@/data/data";
import type { Question } from "@/types/question";
import { getQuestionBank, getQuestionBankSource, getRelevantQuestions, isQuestionChanged, resetQuestionBankCache } from "@/utils/question-bank";
import { loadQuestionContext, loadQuestionTranslation } from "@/utils/question-loader";
import { PICTURE_ORIGIN } from "@/utils/question-pictures";
import { APP_VERSION } from "@/utils/remote-cache";
import { changedQuestionNums, isQuestionCatalogue, keepIfDifferent, QUESTIONS_KEY, questionStore, readDownloadedCatalogue, sameCatalogue } from "@/utils/question-store";

const bundled = questionsData();

function withChange(mutate: (copy: Question[]) => void): Question[] {
    const copy = questionsData();
    mutate(copy);
    return copy;
}

beforeEach(() => {
    localStorage.clear();
    resetQuestionBankCache();
});

afterEach(() => {
    vi.restoreAllMocks();
    resetQuestionBankCache();
});

describe("isQuestionCatalogue", () => {
    it("accepts the bundled catalogue", () => {
        expect(isQuestionCatalogue(bundled)).toBe(true);
    });

    it("rejects partial or malformed files", () => {
        expect(isQuestionCatalogue(null)).toBe(false);
        expect(isQuestionCatalogue(bundled.slice(0, 200))).toBe(false);
        expect(isQuestionCatalogue(withChange((copy) => copy.splice(0, 5)))).toBe(false);
        expect(isQuestionCatalogue(withChange((copy) => (copy[0].solution = "e")))).toBe(false);
        expect(isQuestionCatalogue(withChange((copy) => (copy[0].question = "  ")))).toBe(false);
        expect(isQuestionCatalogue(withChange((copy) => (copy[1].num = copy[0].num)))).toBe(false);
        expect(isQuestionCatalogue(withChange((copy) => (copy[0].num = "x1")))).toBe(false);
        expect(isQuestionCatalogue(withChange((copy) => ((copy[0] as unknown as { a: number }).a = 1)))).toBe(false);
    });

    it("keeps every state represented", () => {
        const withoutBerlin = bundled.filter((question) => !question.num.startsWith("BE-"));
        expect(isQuestionCatalogue(withoutBerlin)).toBe(false);
        const berlinKeepsThree = bundled.filter((question) => !question.num.startsWith("BE-") || Number(question.num.slice(3)) <= 3);
        expect(isQuestionCatalogue(berlinKeepsThree)).toBe(true);
    });

    it("allows the catalogue to grow", () => {
        const grown = withChange((copy) => copy.push({ ...copy[0], num: "301", id: "new", question: "Neue Frage?" }));
        expect(isQuestionCatalogue(grown)).toBe(true);
    });
});

describe("sameCatalogue / changedQuestionNums / keepIfDifferent", () => {
    it("detects identical and changed catalogues", () => {
        expect(sameCatalogue(bundled, questionsData())).toBe(true);
        const changed = withChange((copy) => {
            copy[0].question = "Geändert?";
            copy[5].solution = copy[5].solution === "a" ? "b" : "a";
            copy.push({ ...copy[1], num: "301", id: "new" });
        });
        expect(sameCatalogue(bundled, changed)).toBe(false);
        expect([...changedQuestionNums(changed, bundled)].sort()).toEqual([bundled[0].num, bundled[5].num, "301"].sort());
        expect(changedQuestionNums(questionsData(), bundled).size).toBe(0);
    });

    it("keeps nothing from an identical download", () => {
        expect(keepIfDifferent(questionsData())).toBeNull();
        const changed = withChange((copy) => (copy[0].question = "Geändert?"));
        expect(keepIfDifferent(changed)).toBe(changed);
    });

    it("treats the published file, whose pictures are website URLs for apps up to 2.1.25, as the bundled catalogue", () => {
        const published = withChange((copy) => {
            for (const question of copy) {
                if (question.image.startsWith("/questions/")) {
                    question.image = `${PICTURE_ORIGIN}${question.image}`;
                }
            }
        });
        expect(published.filter((question) => question.image.startsWith(`${PICTURE_ORIGIN}/questions/`)).length).toBeGreaterThan(40);
        expect(keepIfDifferent(published)).toBeNull();
        published[0].question = "Geändert?";
        const kept = keepIfDifferent(published);
        expect(kept).not.toBeNull();
        expect(kept!.filter((question) => question.image.startsWith("http"))).toEqual([]);
        expect([...changedQuestionNums(kept!, bundled)]).toEqual([published[0].num]);
    });
});

describe("question bank with a downloaded catalogue", () => {
    it("uses the bundle when nothing valid is cached", () => {
        expect(getQuestionBankSource()).toBe("bundled");
        expect(getQuestionBank()).toHaveLength(bundled.length);
        expect(isQuestionChanged("1")).toBe(false);
    });

    it("prefers a valid cache written by this build and marks changed questions", () => {
        const changed = withChange((copy) => (copy[0].question = "Geändert?"));
        questionStore.storeData(changed);
        expect(readDownloadedCatalogue()).not.toBeNull();
        expect(getQuestionBankSource()).toBe("downloaded");
        expect(getQuestionBank()[0].question).toBe("Geändert?");
        expect(isQuestionChanged(bundled[0].num)).toBe(true);
        expect(isQuestionChanged(bundled[1].num)).toBe(false);
        expect(getRelevantQuestions("BE")).toHaveLength(310);
    });

    it("shows the bundled picture files for a cache that holds website URLs", () => {
        const published = withChange((copy) => {
            copy[0].question = "Geändert?";
            for (const question of copy) {
                if (question.image.startsWith("/questions/")) {
                    question.image = `${PICTURE_ORIGIN}${question.image}`;
                }
            }
        });
        questionStore.storeData(published);
        const bank = getQuestionBank();
        expect(getQuestionBankSource()).toBe("downloaded");
        const pictures = bank.filter((question) => question.image !== "-");
        expect(pictures.length).toBe(bundled.filter((question) => question.image !== "-").length);
        for (const question of pictures) {
            expect(question.image, question.num).toBe(`/questions/${question.num}.webp`);
            expect(isQuestionChanged(question.num), question.num).toBe(false);
        }
    });

    it("ignores a cache from another build or one that fails the check", () => {
        localStorage.setItem(QUESTIONS_KEY, JSON.stringify({ data: bundled, fetchedAt: "2026-10-10T00:00:00Z", attemptedAt: "2026-10-10T00:00:00Z", etag: null, appVersion: "0.0.1" }));
        expect(readDownloadedCatalogue()).toBeNull();
        expect(getQuestionBankSource()).toBe("bundled");
        resetQuestionBankCache();
        localStorage.setItem(QUESTIONS_KEY, JSON.stringify({ data: bundled.slice(0, 10), fetchedAt: "2026-10-10T00:00:00Z", attemptedAt: null, etag: null, appVersion: APP_VERSION }));
        expect(readDownloadedCatalogue()).toBeNull();
        expect(getQuestionBankSource()).toBe("bundled");
        expect(localStorage.getItem("user")).toBeNull();
    });

    it("hides bundled explanations and translations for changed questions only", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const body = url.includes("/context/") ? { "1": "Erklärung zu 1", "2": "Erklärung zu 2" } : { "1": { question: "Q1" }, "2": { question: "Q2" } };
            return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
        });
        vi.stubGlobal("fetch", fetchMock);
        questionStore.storeData(withChange((copy) => (copy[0].question = "Geändert?")));
        expect(bundled[0].num).toBe("1");
        expect(await loadQuestionContext("1", "de")).toBeNull();
        expect(await loadQuestionContext("2", "de")).toBe("Erklärung zu 2");
        expect(await loadQuestionTranslation("1", "en")).toBeNull();
        expect((await loadQuestionTranslation("2", "en"))?.question).toBe("Q2");
        vi.unstubAllGlobals();
    });
});
