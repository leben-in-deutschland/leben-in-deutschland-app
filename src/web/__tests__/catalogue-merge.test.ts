// @vitest-environment node
/*
 * The BAMF catalogue pipeline (src/catalogue/compare.mjs) adopts the
 * official answer order. The translations' a-d must move with the answers
 * they translate - also when the official text of an answer was reworded
 * ("schwarz-gelb" -> "schwarz-gold", "Bürger/Bürgerin" -> "Bürgerin/Bürger"),
 * or the translation panel shows a wrong translation under a letter.
 */
import { describe, expect, it } from "vitest";
import { mergeMatched } from "../../catalogue/compare.mjs";

type Entry = Record<string, string>;

function appQuestion(answers: string[], solution: string, english: string[]) {
    return {
        num: "X-1",
        question: "Welche Farben hat die Flagge?",
        a: answers[0],
        b: answers[1],
        c: answers[2],
        d: answers[3],
        solution,
        image: "-",
        translation: {
            en: { question: "Which colours?", a: english[0], b: english[1], c: english[2], d: english[3], context: "kept" },
            tr: null,
        },
        category: "History",
        context: "Kontext",
        id: "x-1",
    };
}

function official(answers: string[]) {
    return { num: "X-1", part: "state", question: "Welche Farben hat die Flagge?", answers };
}

/** German answer -> English translation, read letter by letter. */
function pairs(entry: Entry & { translation: { en: Entry } }) {
    return ["a", "b", "c", "d"].map((letter) => [entry[letter], entry.translation.en[letter]]);
}

describe("catalogue merge keeps translations next to their answers", () => {
    it("moves translations when the answers only changed places", () => {
        const existing = appQuestion(["rot-weiß", "blau-weiß", "grün-weiß", "gelb-rot"], "a", ["red-white", "blue-white", "green-white", "yellow-red"]);
        const { merged } = mergeMatched(existing, official(["gelb-rot", "grün-weiß", "rot-weiß", "blau-weiß"]));
        expect(merged.solution).toBe("c");
        expect(merged.needsReview).toBeUndefined();
        expect(pairs(merged)).toEqual([
            ["gelb-rot", "yellow-red"],
            ["grün-weiß", "green-white"],
            ["rot-weiß", "red-white"],
            ["blau-weiß", "blue-white"],
        ]);
        expect(merged.translation.en.context).toBe("kept");
        expect(merged.translation.tr).toBeNull();
    });

    it("moves the translation of a reworded wrong answer with it", () => {
        // Bremen-like case: a wrong answer was reworded, the correct one kept its text.
        const existing = appQuestion(["grün-weiß-rot", "schwarz-gelb", "rot-weiß", "blau-weiß-rot"], "c", ["green-white-red", "black-yellow", "red-white", "blue-white-red"]);
        const { merged } = mergeMatched(existing, official(["blau-weiß-rot", "rot-weiß", "grün-weiß-rot", "schwarz-gold"]));
        expect(merged.solution).toBe("b");
        expect(merged.needsReview).toBeUndefined();
        expect(pairs(merged)).toEqual([
            ["blau-weiß-rot", "blue-white-red"],
            ["rot-weiß", "red-white"],
            ["grün-weiß-rot", "green-white-red"],
            ["schwarz-gold", "black-yellow"],
        ]);
    });

    it("moves the translations of reworded gender pairs with them", () => {
        const existing = appQuestion(
            ["der Bundespräsident/die Bundespräsidentin.", "der Ministerpräsident/die Ministerpräsidentin eines Bundeslandes.", "der Bundeskanzler/die Bundeskanzlerin.", "der Bürgermeister/die Bürgermeisterin."],
            "a",
            ["the Federal President", "the Minister-President of a federal state", "the Federal Chancellor", "the mayor"],
        );
        const { merged } = mergeMatched(
            existing,
            official(["die Bundeskanzlerin/der Bundeskanzler.", "die Bürgermeisterin/der Bürgermeister.", "die Bundespräsidentin/der Bundespräsident.", "die Ministerpräsidentin/der Ministerpräsident eines Bundeslandes."]),
        );
        expect(pairs(merged)).toEqual([
            ["die Bundeskanzlerin/der Bundeskanzler.", "the Federal Chancellor"],
            ["die Bürgermeisterin/der Bürgermeister.", "the mayor"],
            ["die Bundespräsidentin/der Bundespräsident.", "the Federal President"],
            ["die Ministerpräsidentin/der Ministerpräsident eines Bundeslandes.", "the Minister-President of a federal state"],
        ]);
    });

    it("holds an entry back when its answers cannot all be paired", () => {
        const existing = appQuestion(["rot-weiß", "blau-weiß", "grün-weiß", "gelb-rot"], "a", ["red-white", "blue-white", "green-white", "yellow-red"]);
        const { merged } = mergeMatched(existing, official(["rot-weiß", "lila-orange", "türkis-braun", "gelb-rot"]));
        expect(merged.needsReview).toBe(true);
        expect(merged.reviewReason).toMatch(/translations/);
    });
});
