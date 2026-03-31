import { describe, it, expect } from "vitest";
import { statesData, questionsData, getTranslations } from "@/data/data";

describe("data module", () => {
  describe("statesData", () => {
    it("returns an array of states", () => {
      const states = statesData();
      expect(Array.isArray(states)).toBe(true);
      expect(states.length).toBeGreaterThan(0);
    });

    it("each state has code, name, eng, capital", () => {
      const states = statesData();
      for (const state of states) {
        expect(state).toHaveProperty("code");
        expect(state).toHaveProperty("name");
        expect(state).toHaveProperty("eng");
        expect(state).toHaveProperty("capital");
      }
    });

    it("includes all 16 German states", () => {
      const states = statesData();
      expect(states.length).toBe(16);
      const codes = states.map((s) => s.code);
      expect(codes).toContain("BE");
      expect(codes).toContain("BY");
      expect(codes).toContain("NW");
    });

    it("returns a deep copy (mutations don't affect source)", () => {
      const states1 = statesData();
      states1[0].name = "MUTATED";
      const states2 = statesData();
      expect(states2[0].name).not.toBe("MUTATED");
    });
  });

  describe("questionsData", () => {
    it("returns an array of questions", () => {
      const questions = questionsData();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it("each question has required fields", () => {
      const questions = questionsData();
      const first = questions[0];
      expect(first).toHaveProperty("num");
      expect(first).toHaveProperty("question");
      expect(first).toHaveProperty("a");
      expect(first).toHaveProperty("b");
      expect(first).toHaveProperty("c");
      expect(first).toHaveProperty("d");
      expect(first).toHaveProperty("solution");
    });

    it("solution is always a, b, c, or d", () => {
      const questions = questionsData();
      for (const q of questions) {
        expect(["a", "b", "c", "d"]).toContain(q.solution);
      }
    });

    it("returns a deep copy (mutations don't affect source)", () => {
      const q1 = questionsData();
      q1[0].question = "MUTATED";
      const q2 = questionsData();
      expect(q2[0].question).not.toBe("MUTATED");
    });

    it("contains both general and state-specific questions", () => {
      const questions = questionsData();
      const hasNumeric = questions.some((q) => !isNaN(Number(q.num)));
      const hasState = questions.some((q) => isNaN(Number(q.num)));
      expect(hasNumeric).toBe(true);
      expect(hasState).toBe(true);
    });
  });

  describe("getTranslations", () => {
    it("returns German translations for 'de'", () => {
      const translations = getTranslations("de");
      expect(translations).toBeDefined();
      expect(typeof translations).toBe("object");
    });

    it("returns English translations for 'en'", () => {
      const translations = getTranslations("en");
      expect(translations).toBeDefined();
      expect(typeof translations).toBe("object");
    });

    it("returns English translations for unknown language", () => {
      const translations = getTranslations("fr");
      const enTranslations = getTranslations("en");
      expect(translations).toEqual(enTranslations);
    });

    it("translations have common keys", () => {
      const de = getTranslations("de");
      const en = getTranslations("en");
      // Both should have dashboard-related keys
      expect(de).toHaveProperty("submit");
      expect(en).toHaveProperty("submit");
    });
  });
});
