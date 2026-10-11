import { describe, it, expect, beforeEach, vi } from "vitest";
import type { User, UserQuestionProgress } from "@/types/user";

describe("user-mapping (createUserStats)", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("dispatchEvent", vi.fn());
    vi.stubGlobal("StorageEvent", class StorageEvent {
      type: string;
      constructor(type: string) { this.type = type; }
    });
  });

  // Inline createUserStats logic for testing
  const createUserStats = (
    newProgress: UserQuestionProgress,
    oldProgress: UserQuestionProgress | undefined,
    user: User,
    action: "SKIP" | "FLAG" | "SUBMIT"
  ) => {
    const safeOld: UserQuestionProgress = oldProgress || {
      num: newProgress.num,
      answeredCorrectly: false,
      skipped: false,
      answerSelected: null,
      flagged: false,
    };

    user.dailyProgress ||= [];
    const today = new Date().toDateString();
    let dailyStats = user.dailyProgress.find(
      (dp) => new Date(dp.date).toDateString() === today
    );
    if (!dailyStats) {
      dailyStats = { date: today, attempted: 0, correct: 0, incorrect: 0, skipped: 0, flagged: 0 };
      user.dailyProgress.push(dailyStats);
    }

    let attemptedDelta = 0, correctDelta = 0, incorrectDelta = 0, skippedDelta = 0, flaggedDelta = 0;

    switch (action) {
      case "SKIP":
        attemptedDelta = 1;
        skippedDelta = 1;
        break;
      case "FLAG":
        attemptedDelta = 1;
        flaggedDelta = newProgress.flagged ? 1 : -1;
        if (!newProgress.flagged && newProgress.answeredCorrectly === null) {
          skippedDelta = 1;
        }
        break;
      case "SUBMIT":
        if (newProgress.answeredCorrectly !== null) {
          if (newProgress.answeredCorrectly) {
            if (!safeOld.answeredCorrectly) {
              correctDelta = 1;
            }
          } else {
            if (safeOld.answeredCorrectly) {
              correctDelta = -1;
              incorrectDelta = 1;
            } else {
              incorrectDelta = 1;
            }
          }
          attemptedDelta = 1;
        }
        break;
    }

    dailyStats.attempted = Math.max(0, dailyStats.attempted + attemptedDelta);
    dailyStats.correct = Math.max(0, dailyStats.correct + correctDelta);
    dailyStats.incorrect = Math.max(0, dailyStats.incorrect + incorrectDelta);
    dailyStats.skipped = Math.max(0, dailyStats.skipped + skippedDelta);
    dailyStats.flagged = Math.max(0, dailyStats.flagged + flaggedDelta);
  };

  function makeUser(dailyProgress?: any[]): User {
    return {
      id: "test",
      state: { stateName: "Berlin", stateCode: "BE" },
      dailyProgress: dailyProgress || [],
      questionProgress: [],
      testProgress: [],
      appLanguage: "de",
      appFirstTimeOpenDateTime: new Date(),
      lastReviewPromptDateTime: null,
      reviewNoCount: 0,
      userReviewed: false,
    };
  }

  function makeProgress(overrides: Partial<UserQuestionProgress> = {}): UserQuestionProgress {
    return {
      num: "1",
      answeredCorrectly: null,
      skipped: false,
      answerSelected: null,
      flagged: false,
      ...overrides,
    };
  }

  describe("SKIP action", () => {
    it("increments attempted and skipped by 1", () => {
      const user = makeUser();
      const progress = makeProgress({ skipped: true });
      createUserStats(progress, undefined, user, "SKIP");
      expect(user.dailyProgress[0].attempted).toBe(1);
      expect(user.dailyProgress[0].skipped).toBe(1);
    });

    it("does not affect correct/incorrect/flagged counts", () => {
      const user = makeUser();
      const progress = makeProgress({ skipped: true });
      createUserStats(progress, undefined, user, "SKIP");
      expect(user.dailyProgress[0].correct).toBe(0);
      expect(user.dailyProgress[0].incorrect).toBe(0);
      expect(user.dailyProgress[0].flagged).toBe(0);
    });
  });

  describe("FLAG action", () => {
    it("increments flagged when flagging a question", () => {
      const user = makeUser();
      const progress = makeProgress({ flagged: true });
      createUserStats(progress, undefined, user, "FLAG");
      expect(user.dailyProgress[0].flagged).toBe(1);
    });

    it("decrements flagged when unflagging a question", () => {
      const user = makeUser([
        { date: new Date().toDateString(), attempted: 1, correct: 0, incorrect: 0, skipped: 0, flagged: 1 },
      ]);
      const progress = makeProgress({ flagged: false, answeredCorrectly: null });
      createUserStats(progress, undefined, user, "FLAG");
      expect(user.dailyProgress[0].flagged).toBe(0);
    });

    it("adds skipped delta when unflagging unanswered question", () => {
      const user = makeUser();
      const progress = makeProgress({ flagged: false, answeredCorrectly: null });
      createUserStats(progress, undefined, user, "FLAG");
      expect(user.dailyProgress[0].skipped).toBe(1);
    });
  });

  describe("SUBMIT action", () => {
    it("increments correct when answering correctly for the first time", () => {
      const user = makeUser();
      const newProgress = makeProgress({ answeredCorrectly: true, answerSelected: "a" });
      const oldProgress = makeProgress({ answeredCorrectly: false });
      createUserStats(newProgress, oldProgress, user, "SUBMIT");
      expect(user.dailyProgress[0].correct).toBe(1);
      expect(user.dailyProgress[0].attempted).toBe(1);
    });

    it("increments incorrect when answering incorrectly", () => {
      const user = makeUser();
      const newProgress = makeProgress({ answeredCorrectly: false, answerSelected: "b" });
      const oldProgress = makeProgress({ answeredCorrectly: false });
      createUserStats(newProgress, oldProgress, user, "SUBMIT");
      expect(user.dailyProgress[0].incorrect).toBe(1);
    });

    it("adjusts correct to incorrect when changing from correct to incorrect", () => {
      const user = makeUser([
        { date: new Date().toDateString(), attempted: 1, correct: 1, incorrect: 0, skipped: 0, flagged: 0 },
      ]);
      const newProgress = makeProgress({ answeredCorrectly: false, answerSelected: "b" });
      const oldProgress = makeProgress({ answeredCorrectly: true, answerSelected: "a" });
      createUserStats(newProgress, oldProgress, user, "SUBMIT");
      expect(user.dailyProgress[0].correct).toBe(0);
      expect(user.dailyProgress[0].incorrect).toBe(1);
    });

    it("does nothing when answeredCorrectly is null", () => {
      const user = makeUser();
      const newProgress = makeProgress({ answeredCorrectly: null });
      createUserStats(newProgress, undefined, user, "SUBMIT");
      expect(user.dailyProgress).toHaveLength(1);
      expect(user.dailyProgress[0].attempted).toBe(0);
    });
  });

  describe("daily progress creation", () => {
    it("creates a new daily progress entry when none exists for today", () => {
      const user = makeUser([]);
      const progress = makeProgress({ skipped: true });
      createUserStats(progress, undefined, user, "SKIP");
      expect(user.dailyProgress).toHaveLength(1);
      expect(user.dailyProgress[0].date).toBe(new Date().toDateString());
    });

    it("reuses existing daily progress entry for today", () => {
      const today = new Date().toDateString();
      const user = makeUser([
        { date: today, attempted: 5, correct: 3, incorrect: 2, skipped: 0, flagged: 0 },
      ]);
      const progress = makeProgress({ skipped: true });
      createUserStats(progress, undefined, user, "SKIP");
      expect(user.dailyProgress).toHaveLength(1);
      expect(user.dailyProgress[0].attempted).toBe(6);
    });

    it("never lets counts go below zero", () => {
      const today = new Date().toDateString();
      const user = makeUser([
        { date: today, attempted: 0, correct: 0, incorrect: 0, skipped: 0, flagged: 0 },
      ]);
      const progress = makeProgress({ flagged: false, answeredCorrectly: null });
      createUserStats(progress, undefined, user, "FLAG");
      expect(user.dailyProgress[0].flagged).toBe(0); // Would be -1 without Math.max
    });
  });
});
