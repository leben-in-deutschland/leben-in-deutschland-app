// @vitest-environment node
/*
 * The BAMF PDF prints "206. Woran erinnern …" under "Aufgabe 206" on a few
 * questions; the extracted question text must not carry that copy of the
 * number, or learners read "206." on question 32 of the app.
 */
import { describe, expect, it } from "vitest";
import catalogue from "../../catalogue/data/bamf-catalogue.json";
import { stripOwnNumber } from "../../catalogue/extract.mjs";

describe("stripOwnNumber", () => {
    it("removes the question's own number", () => {
        expect(stripOwnNumber("206. Woran erinnern die sogenannten „Stolpersteine“ in Deutschland?", 206)).toBe(
            "Woran erinnern die sogenannten „Stolpersteine“ in Deutschland?",
        );
    });

    it("keeps a stem that starts with another number or a year", () => {
        expect(stripOwnNumber("184. Auf welcher Grundlage?", 206)).toBe("184. Auf welcher Grundlage?");
        expect(stripOwnNumber("1949 wurde Deutschland geteilt. Was gehörte dazu?", 1949)).toBe("1949 wurde Deutschland geteilt. Was gehörte dazu?");
        expect(stripOwnNumber("2.5 Millionen?", 2)).toBe("2.5 Millionen?");
    });
});

describe("bamf-catalogue.json", () => {
    it("has no question text that starts with a number and a dot", () => {
        const numbered = catalogue.questions.filter((question) => /^\d+\.\s/.test(question.question)).map((question) => question.num);
        expect(numbered).toEqual([]);
    });
});
