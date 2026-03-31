import { describe, it, expect } from "vitest";
import {
  calculateExamReadiness,
  isExamReady,
} from "@/utils/exam-readiness-logic";
import type { MockTestProgress } from "@/types/user";

function makeMockTest(passed: boolean, cancelled: boolean = false): MockTestProgress {
  return {
    datetime: new Date().toISOString(),
    timeTake: "300",
    passed,
    cancelled,
    questions: [],
  };
}

describe("calculateExamReadiness", () => {
  it("returns 0 for empty test progress", () => {
    expect(calculateExamReadiness([])).toBe(0);
  });

  it("returns 0 when total non-cancelled tests <= 8", () => {
    const tests = Array.from({ length: 8 }, () => makeMockTest(true));
    expect(calculateExamReadiness(tests)).toBe(0);
  });

  it("returns 0 when exactly 8 non-cancelled tests (edge case)", () => {
    const tests = Array.from({ length: 8 }, () => makeMockTest(true));
    expect(calculateExamReadiness(tests)).toBe(0);
  });

  it("calculates percentage when more than 8 non-cancelled tests", () => {
    const tests = [
      ...Array.from({ length: 9 }, () => makeMockTest(true)),
    ];
    // 9 passed out of 9 = 100%
    expect(calculateExamReadiness(tests)).toBe(100);
  });

  it("correctly calculates partial pass rate", () => {
    const tests = [
      ...Array.from({ length: 7 }, () => makeMockTest(true)),
      ...Array.from({ length: 3 }, () => makeMockTest(false)),
    ];
    // 7 passed out of 10 = 70%
    expect(calculateExamReadiness(tests)).toBe(70);
  });

  it("excludes cancelled tests from both numerator and denominator", () => {
    const tests = [
      ...Array.from({ length: 9 }, () => makeMockTest(true)),
      ...Array.from({ length: 5 }, () => makeMockTest(false, true)), // cancelled
    ];
    // Only 9 non-cancelled, all passed = 100%
    expect(calculateExamReadiness(tests)).toBe(100);
  });

  it("returns 0 when cancelled tests bring count to <= 8", () => {
    const tests = [
      ...Array.from({ length: 5 }, () => makeMockTest(true)),
      ...Array.from({ length: 10 }, () => makeMockTest(true, true)), // cancelled
    ];
    // Only 5 non-cancelled → <= 8 → 0%
    expect(calculateExamReadiness(tests)).toBe(0);
  });

  it("handles 75% boundary correctly", () => {
    // 9 tests: 7 passed, 2 failed = 77.78%
    const tests = [
      ...Array.from({ length: 7 }, () => makeMockTest(true)),
      ...Array.from({ length: 2 }, () => makeMockTest(false)),
    ];
    const result = calculateExamReadiness(tests);
    expect(result).toBeCloseTo(77.78, 1);
  });

  it("handles all-failed scenario", () => {
    const tests = Array.from({ length: 10 }, () => makeMockTest(false));
    expect(calculateExamReadiness(tests)).toBe(0);
  });
});

describe("isExamReady", () => {
  it("returns false for empty progress", () => {
    expect(isExamReady([])).toBe(false);
  });

  it("returns false when readiness < 75%", () => {
    const tests = [
      ...Array.from({ length: 7 }, () => makeMockTest(true)),
      ...Array.from({ length: 3 }, () => makeMockTest(false)),
    ];
    // 70% < 75%
    expect(isExamReady(tests)).toBe(false);
  });

  it("returns true when readiness >= 75%", () => {
    const tests = [
      ...Array.from({ length: 8 }, () => makeMockTest(true)),
      ...Array.from({ length: 2 }, () => makeMockTest(false)),
    ];
    // 80% >= 75%
    expect(isExamReady(tests)).toBe(true);
  });

  it("returns true when readiness is exactly 75%", () => {
    // Need 75% exactly: 9 passed, 3 failed = 75%
    const tests = [
      ...Array.from({ length: 9 }, () => makeMockTest(true)),
      ...Array.from({ length: 3 }, () => makeMockTest(false)),
    ];
    expect(isExamReady(tests)).toBe(true);
  });

  it("returns false when total tests <= 8", () => {
    const tests = Array.from({ length: 8 }, () => makeMockTest(true));
    expect(isExamReady(tests)).toBe(false);
  });
});
