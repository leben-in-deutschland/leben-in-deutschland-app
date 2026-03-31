import { describe, it, expect } from "vitest";
import {
  isNumeric,
  filterQuestionsForUser,
  buildPrepareQuestions,
  buildStateQuestions,
  buildSkippedQuestions,
  buildFlaggedQuestions,
  buildCorrectQuestions,
  buildIncorrectQuestions,
  getNextQuestion,
  buildQuestionsForAction,
} from "@/utils/prepare-logic";
import { PrepareQuestionActions } from "@/types/prepare-question";
import type { Question } from "@/types/question";
import type { UserQuestionProgress } from "@/types/user";

function makeQuestion(num: string): Question {
  return {
    num,
    id: `q-${num}`,
    question: `Question ${num}`,
    a: "A",
    b: "B",
    c: "C",
    d: "D",
    solution: "a",
    image: "-",
    translation: null,
    context: "",
    category: "General",
  };
}

function makeProgress(num: string, overrides: Partial<UserQuestionProgress> = {}): UserQuestionProgress {
  return {
    num,
    answeredCorrectly: null,
    skipped: false,
    answerSelected: null,
    flagged: false,
    ...overrides,
  };
}

describe("isNumeric", () => {
  it("returns true for numeric strings", () => {
    expect(isNumeric("1")).toBe(true);
    expect(isNumeric("300")).toBe(true);
  });
  it("returns false for state-prefixed strings", () => {
    expect(isNumeric("BE1")).toBe(false);
  });
});

describe("filterQuestionsForUser", () => {
  it("returns general + user state questions", () => {
    const questions = [makeQuestion("1"), makeQuestion("2"), makeQuestion("BE1"), makeQuestion("BY1")];
    const result = filterQuestionsForUser(questions, "BE");
    expect(result.map((q) => q.num)).toEqual(["1", "2", "BE1"]);
  });

  it("returns empty for no matching questions", () => {
    const result = filterQuestionsForUser([], "BE");
    expect(result).toEqual([]);
  });
});

describe("buildPrepareQuestions", () => {
  it("returns only unanswered questions", () => {
    const questions = [makeQuestion("1"), makeQuestion("2"), makeQuestion("3")];
    const progress = [makeProgress("1", { answeredCorrectly: true, answerSelected: "a" })];
    const result = buildPrepareQuestions(questions, progress);
    expect(result.map((q) => q.num)).toEqual(["2", "3"]);
  });

  it("returns all questions when no progress", () => {
    const questions = [makeQuestion("1"), makeQuestion("2")];
    const result = buildPrepareQuestions(questions, []);
    expect(result).toHaveLength(2);
  });

  it("returns empty when all answered", () => {
    const questions = [makeQuestion("1")];
    const progress = [makeProgress("1")];
    const result = buildPrepareQuestions(questions, progress);
    expect(result).toHaveLength(0);
  });
});

describe("buildStateQuestions", () => {
  it("prioritizes incorrect, then skipped, then flagged, then remaining", () => {
    const questions = [
      makeQuestion("BE1"),
      makeQuestion("BE2"),
      makeQuestion("BE3"),
      makeQuestion("BE4"),
    ];
    // Note: !x.answeredCorrectly is truthy for both null and false,
    // so the "incorrect" pass picks up items in questionProgress order.
    // BE1 is explicitly incorrect (answeredCorrectly=false).
    // BE3 is flagged with answeredCorrectly=true so it won't match incorrect filter.
    const progress = [
      makeProgress("BE3", { flagged: true, answeredCorrectly: true, answerSelected: "a" }),
      makeProgress("BE1", { answeredCorrectly: false, answerSelected: "b" }),
      makeProgress("BE2", { skipped: true }),
    ];
    const result = buildStateQuestions(questions, progress, "BE");
    // BE1 (incorrect) → BE2 (skipped) → BE3 (flagged) → BE4 (remaining)
    expect(result[0].num).toBe("BE1");
    expect(result[1].num).toBe("BE2");
    expect(result[2].num).toBe("BE3");
    expect(result[3].num).toBe("BE4");
  });

  it("only includes state-specific questions", () => {
    const questions = [makeQuestion("1"), makeQuestion("BE1"), makeQuestion("BY1")];
    const result = buildStateQuestions(questions, [], "BE");
    expect(result.map((q) => q.num)).toEqual(["BE1"]);
  });
});

describe("buildSkippedQuestions", () => {
  it("returns skipped questions", () => {
    const questions = [makeQuestion("1"), makeQuestion("2"), makeQuestion("3")];
    const progress = [
      makeProgress("2", { skipped: true }),
    ];
    const result = buildSkippedQuestions(questions, progress);
    expect(result.map((q) => q.num)).toContain("2");
  });

  it("includes unanswered non-flagged as skipped", () => {
    const questions = [makeQuestion("1"), makeQuestion("2")];
    const progress = [
      makeProgress("1", { answeredCorrectly: null, flagged: false }),
    ];
    const result = buildSkippedQuestions(questions, progress);
    expect(result.map((q) => q.num)).toContain("1");
  });

  it("returns empty when nothing skipped", () => {
    const questions = [makeQuestion("1")];
    const progress = [makeProgress("1", { answeredCorrectly: true, answerSelected: "a" })];
    const result = buildSkippedQuestions(questions, progress);
    expect(result).toHaveLength(0);
  });
});

describe("buildFlaggedQuestions", () => {
  it("returns only flagged questions", () => {
    const questions = [makeQuestion("1"), makeQuestion("2")];
    const progress = [
      makeProgress("1", { flagged: true }),
      makeProgress("2", { flagged: false }),
    ];
    const result = buildFlaggedQuestions(questions, progress);
    expect(result).toHaveLength(1);
    expect(result[0].num).toBe("1");
  });

  it("returns empty when nothing flagged", () => {
    const questions = [makeQuestion("1")];
    const result = buildFlaggedQuestions(questions, []);
    expect(result).toHaveLength(0);
  });
});

describe("buildCorrectQuestions", () => {
  it("returns correctly answered questions", () => {
    const questions = [makeQuestion("1"), makeQuestion("2")];
    const progress = [
      makeProgress("1", { answeredCorrectly: true }),
      makeProgress("2", { answeredCorrectly: false }),
    ];
    const result = buildCorrectQuestions(questions, progress);
    expect(result).toHaveLength(1);
    expect(result[0].num).toBe("1");
  });
});

describe("buildIncorrectQuestions", () => {
  it("returns incorrectly answered questions", () => {
    const questions = [makeQuestion("1"), makeQuestion("2"), makeQuestion("3")];
    const progress = [
      makeProgress("1", { answeredCorrectly: true }),
      makeProgress("2", { answeredCorrectly: false, answerSelected: "c" }),
      makeProgress("3", { answeredCorrectly: null }),
    ];
    const result = buildIncorrectQuestions(questions, progress);
    expect(result).toHaveLength(1);
    expect(result[0].num).toBe("2");
  });
});

describe("getNextQuestion", () => {
  it("returns next question in sequence", () => {
    const questions = [makeQuestion("1"), makeQuestion("2"), makeQuestion("3")];
    expect(getNextQuestion(questions, questions[0])?.num).toBe("2");
    expect(getNextQuestion(questions, questions[1])?.num).toBe("3");
  });

  it("returns null at end of list", () => {
    const questions = [makeQuestion("1"), makeQuestion("2")];
    expect(getNextQuestion(questions, questions[1])).toBeNull();
  });

  it("returns null for question not in list", () => {
    const questions = [makeQuestion("1")];
    expect(getNextQuestion(questions, makeQuestion("99"))).toBeNull();
  });
});

describe("buildQuestionsForAction", () => {
  const questions = [makeQuestion("1"), makeQuestion("2"), makeQuestion("BE1")];

  it("dispatches to Prepare action", () => {
    const progress = [makeProgress("1")];
    const result = buildQuestionsForAction(PrepareQuestionActions.Prepare, questions, progress, "BE");
    expect(result.map((q) => q.num)).toEqual(["2", "BE1"]);
  });

  it("dispatches to State action", () => {
    const result = buildQuestionsForAction(PrepareQuestionActions.State, questions, [], "BE");
    expect(result.map((q) => q.num)).toEqual(["BE1"]);
  });

  it("dispatches to Flagged action", () => {
    const progress = [makeProgress("1", { flagged: true })];
    const result = buildQuestionsForAction(PrepareQuestionActions.Flagged, questions, progress, "BE");
    expect(result).toHaveLength(1);
  });

  it("returns original questions for unhandled action", () => {
    const result = buildQuestionsForAction(PrepareQuestionActions.Random, questions, [], "BE");
    expect(result).toEqual(questions);
  });
});
