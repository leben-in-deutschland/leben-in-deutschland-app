import { describe, it, expect } from "vitest";
import { getTodayCount, calculateStreak } from "@/utils/stats-logic";
import type { User } from "@/types/user";

/** Helper to build a minimal User with given dailyProgress entries. */
function makeUser(
  dailyProgress: { date: string; attempted: number }[] = []
): User {
  return {
    id: "test-user",
    state: { stateName: "Berlin", stateCode: "BE" },
    dailyProgress: dailyProgress.map((dp) => ({
      date: dp.date,
      correct: 0,
      incorrect: 0,
      attempted: dp.attempted,
      skipped: 0,
      flagged: 0,
    })),
    questionProgress: [],
    testProgress: [],
    appLanguage: "de",
    appFirstTimeOpenDateTime: new Date(),
    lastReviewPromptDateTime: null,
    reviewNoCount: 0,
    userReviewed: false,
  };
}

/** Return an ISO date string for N days ago at midnight. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

describe("getTodayCount", () => {
  it("returns 0 when dailyProgress is empty", () => {
    const user = makeUser([]);
    expect(getTodayCount(user)).toBe(0);
  });

  it("returns attempted count for today", () => {
    const user = makeUser([{ date: daysAgo(0), attempted: 7 }]);
    expect(getTodayCount(user)).toBe(7);
  });

  it("ignores entries from other days", () => {
    const user = makeUser([
      { date: daysAgo(1), attempted: 10 },
      { date: daysAgo(2), attempted: 5 },
    ]);
    expect(getTodayCount(user)).toBe(0);
  });
});

describe("calculateStreak", () => {
  it("returns 0 for empty dailyProgress", () => {
    const user = makeUser([]);
    expect(calculateStreak(user)).toBe(0);
  });

  it("returns 1 when only today has activity", () => {
    const user = makeUser([{ date: daysAgo(0), attempted: 3 }]);
    expect(calculateStreak(user)).toBe(1);
  });

  it("counts consecutive days including today", () => {
    const user = makeUser([
      { date: daysAgo(0), attempted: 1 },
      { date: daysAgo(1), attempted: 2 },
      { date: daysAgo(2), attempted: 3 },
    ]);
    expect(calculateStreak(user)).toBe(3);
  });

  it("allows streak starting from yesterday", () => {
    const user = makeUser([
      { date: daysAgo(1), attempted: 5 },
      { date: daysAgo(2), attempted: 3 },
    ]);
    expect(calculateStreak(user)).toBe(2);
  });

  it("breaks streak on gap", () => {
    const user = makeUser([
      { date: daysAgo(0), attempted: 1 },
      // gap: daysAgo(1) missing
      { date: daysAgo(2), attempted: 1 },
      { date: daysAgo(3), attempted: 1 },
    ]);
    expect(calculateStreak(user)).toBe(1);
  });

  it("returns 0 when most recent activity is 2+ days ago", () => {
    const user = makeUser([{ date: daysAgo(3), attempted: 5 }]);
    expect(calculateStreak(user)).toBe(0);
  });

  it("ignores days with 0 attempts", () => {
    const user = makeUser([
      { date: daysAgo(0), attempted: 2 },
      { date: daysAgo(1), attempted: 0 },
      { date: daysAgo(2), attempted: 4 },
    ]);
    // Day 1 had 0 attempts so streak is just 1 (today only)
    expect(calculateStreak(user)).toBe(1);
  });
});
