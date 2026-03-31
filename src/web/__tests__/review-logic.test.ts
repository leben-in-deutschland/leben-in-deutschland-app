import { describe, it, expect } from "vitest";
import {
  shouldShowReviewPrompt,
  handleReviewNo,
  handleReviewDone,
  MIN_QUESTIONS_FOR_REVIEW,
  MAX_NO_COUNT,
  MIN_DAYS_BETWEEN_PROMPTS,
} from "@/utils/review-logic";
import type { User, UserQuestionProgress } from "@/types/user";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "test",
    state: { stateName: "Berlin", stateCode: "BE" },
    dailyProgress: [],
    questionProgress: [],
    testProgress: [],
    appLanguage: "de",
    appFirstTimeOpenDateTime: new Date(),
    lastReviewPromptDateTime: null,
    reviewNoCount: 0,
    userReviewed: false,
    ...overrides,
  };
}

function makeQuestionProgress(count: number): UserQuestionProgress[] {
  return Array.from({ length: count }, (_, i) => ({
    num: String(i + 1),
    answeredCorrectly: true,
    skipped: false,
    answerSelected: "a",
    flagged: false,
  }));
}

describe("constants", () => {
  it("has correct default values", () => {
    expect(MIN_QUESTIONS_FOR_REVIEW).toBe(50);
    expect(MAX_NO_COUNT).toBe(3);
    expect(MIN_DAYS_BETWEEN_PROMPTS).toBe(7);
  });
});

describe("shouldShowReviewPrompt", () => {
  it("returns false when user already reviewed", () => {
    const user = makeUser({
      userReviewed: true,
      questionProgress: makeQuestionProgress(100),
    });
    expect(shouldShowReviewPrompt(user)).toBe(false);
  });

  it("returns false when reviewNoCount >= MAX_NO_COUNT", () => {
    const user = makeUser({
      reviewNoCount: MAX_NO_COUNT,
      questionProgress: makeQuestionProgress(100),
    });
    expect(shouldShowReviewPrompt(user)).toBe(false);
  });

  it("returns false when not enough questions attempted", () => {
    const user = makeUser({
      questionProgress: makeQuestionProgress(MIN_QUESTIONS_FOR_REVIEW - 1),
    });
    expect(shouldShowReviewPrompt(user)).toBe(false);
  });

  it("returns true when all conditions met and never prompted", () => {
    const user = makeUser({
      questionProgress: makeQuestionProgress(MIN_QUESTIONS_FOR_REVIEW),
    });
    expect(shouldShowReviewPrompt(user)).toBe(true);
  });

  it("returns false when prompted too recently", () => {
    const now = new Date();
    const recentPrompt = new Date(now.getTime() - (MIN_DAYS_BETWEEN_PROMPTS - 1) * 24 * 60 * 60 * 1000);
    const user = makeUser({
      questionProgress: makeQuestionProgress(100),
      lastReviewPromptDateTime: recentPrompt,
    });
    expect(shouldShowReviewPrompt(user, now)).toBe(false);
  });

  it("returns true when enough time has passed since last prompt", () => {
    const now = new Date();
    const oldPrompt = new Date(now.getTime() - (MIN_DAYS_BETWEEN_PROMPTS + 1) * 24 * 60 * 60 * 1000);
    const user = makeUser({
      questionProgress: makeQuestionProgress(100),
      lastReviewPromptDateTime: oldPrompt,
    });
    expect(shouldShowReviewPrompt(user, now)).toBe(true);
  });

  it("returns true at exactly MIN_QUESTIONS_FOR_REVIEW questions", () => {
    const user = makeUser({
      questionProgress: makeQuestionProgress(MIN_QUESTIONS_FOR_REVIEW),
    });
    expect(shouldShowReviewPrompt(user)).toBe(true);
  });

  it("returns false at reviewNoCount exactly MAX_NO_COUNT", () => {
    const user = makeUser({
      reviewNoCount: MAX_NO_COUNT,
      questionProgress: makeQuestionProgress(100),
    });
    expect(shouldShowReviewPrompt(user)).toBe(false);
  });
});

describe("handleReviewNo", () => {
  it("increments reviewNoCount", () => {
    const user = makeUser({ reviewNoCount: 0 });
    const result = handleReviewNo(user);
    expect(result.reviewNoCount).toBe(1);
  });

  it("sets lastReviewPromptDateTime", () => {
    const now = new Date("2025-06-15T12:00:00Z");
    const user = makeUser();
    const result = handleReviewNo(user, now);
    expect(result.lastReviewPromptDateTime).toEqual(now);
  });

  it("does not mutate original user", () => {
    const user = makeUser({ reviewNoCount: 1 });
    const result = handleReviewNo(user);
    expect(user.reviewNoCount).toBe(1);
    expect(result.reviewNoCount).toBe(2);
  });
});

describe("handleReviewDone", () => {
  it("sets userReviewed to true", () => {
    const user = makeUser({ userReviewed: false });
    const result = handleReviewDone(user);
    expect(result.userReviewed).toBe(true);
  });

  it("does not mutate original user", () => {
    const user = makeUser({ userReviewed: false });
    const result = handleReviewDone(user);
    expect(user.userReviewed).toBe(false);
    expect(result.userReviewed).toBe(true);
  });
});
