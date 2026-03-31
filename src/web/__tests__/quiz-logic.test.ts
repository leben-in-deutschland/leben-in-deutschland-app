import { describe, it, expect } from "vitest";
import {
  isNumeric,
  checkIfQuestionAlreadyPresentInArray,
  generateRandomQuizQuestions,
  handleOptionSelectedLogic,
  handleNextLogic,
  syncUserCorrectIncorrectWithMock,
  changeQuestionState,
  didMockTestPass,
} from "@/utils/quiz-logic";
import type { Question } from "@/types/question";
import type { User, MockTestProgress } from "@/types/user";

function makeQuestion(num: string, solution: string = "a"): Question {
  return {
    num,
    id: `q-${num}`,
    question: `Question ${num}`,
    a: "Option A",
    b: "Option B",
    c: "Option C",
    d: "Option D",
    solution,
    image: "-",
    translation: null,
    context: "",
    category: "General",
  };
}

function makeUser(): User {
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
  };
}

function makeMockData(questions: any[] = []): MockTestProgress {
  return {
    datetime: new Date().toISOString(),
    timeTake: "",
    passed: false,
    cancelled: false,
    questions,
  };
}

describe("isNumeric", () => {
  it("returns true for numeric strings", () => {
    expect(isNumeric("1")).toBe(true);
    expect(isNumeric("123")).toBe(true);
    expect(isNumeric("0")).toBe(true);
  });

  it("returns false for non-numeric strings", () => {
    expect(isNumeric("BE1")).toBe(false);
    expect(isNumeric("abc")).toBe(false);
  });
});

describe("checkIfQuestionAlreadyPresentInArray", () => {
  it("returns true when question is in array", () => {
    const q = makeQuestion("1");
    expect(checkIfQuestionAlreadyPresentInArray([q], q)).toBe(true);
  });

  it("returns false when question is not in array", () => {
    const q1 = makeQuestion("1");
    const q2 = makeQuestion("2");
    expect(checkIfQuestionAlreadyPresentInArray([q1], q2)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(checkIfQuestionAlreadyPresentInArray([], makeQuestion("1"))).toBe(false);
  });
});

describe("generateRandomQuizQuestions", () => {
  // Create enough questions for the random selection
  const questions: Question[] = [];
  for (let i = 1; i <= 50; i++) questions.push(makeQuestion(String(i)));
  for (let i = 1; i <= 10; i++) questions.push(makeQuestion(`BE${i}`));

  it("generates exactly 33 questions (30 general + 3 state)", () => {
    const user = makeUser();
    // Use a sequential random function that cycles through indices
    let counter = 0;
    const result = generateRandomQuizQuestions(user, questions, () => {
      return (counter++ % 100) / 100;
    });
    expect(result).toHaveLength(33);
  });

  it("contains only unique questions", () => {
    const user = makeUser();
    let counter = 0;
    const result = generateRandomQuizQuestions(user, questions, () => {
      return (counter++ % 100) / 100;
    });
    const nums = result.map((q) => q.num);
    expect(new Set(nums).size).toBe(33);
  });

  it("contains 3 state-specific questions", () => {
    const user = makeUser();
    let counter = 0;
    const result = generateRandomQuizQuestions(user, questions, () => {
      return (counter++ % 100) / 100;
    });
    const stateQuestions = result.filter((q) => q.num.startsWith("BE"));
    expect(stateQuestions).toHaveLength(3);
  });
});

describe("handleOptionSelectedLogic", () => {
  it("updates existing question in mock data", () => {
    const q = makeQuestion("1", "a");
    const mockData = makeMockData([
      { num: "1", answeredCorrectly: false, answerSelected: "", skipped: false, flagged: false },
    ]);
    const result = handleOptionSelectedLogic(mockData, q, "a");
    expect(result.questions[0].answeredCorrectly).toBe(true);
    expect(result.questions[0].answerSelected).toBe("a");
  });

  it("adds new question to mock data when not found", () => {
    const q = makeQuestion("2", "b");
    const mockData = makeMockData([]);
    const result = handleOptionSelectedLogic(mockData, q, "b");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].answeredCorrectly).toBe(true);
  });

  it("marks as incorrect for wrong answer", () => {
    const q = makeQuestion("1", "a");
    const mockData = makeMockData([]);
    const result = handleOptionSelectedLogic(mockData, q, "c");
    expect(result.questions[0].answeredCorrectly).toBe(false);
  });
});

describe("handleNextLogic", () => {
  it("returns next index when not at end", () => {
    const questions = [makeQuestion("1"), makeQuestion("2"), makeQuestion("3")];
    const mockData = makeMockData([
      { num: "1", answeredCorrectly: false, answerSelected: "", skipped: false, flagged: false },
    ]);
    const { nextIndex } = handleNextLogic(mockData, questions[0], questions, "a", false);
    expect(nextIndex).toBe(1);
  });

  it("returns -1 when at end", () => {
    const questions = [makeQuestion("1")];
    const mockData = makeMockData([
      { num: "1", answeredCorrectly: false, answerSelected: "", skipped: false, flagged: false },
    ]);
    const { nextIndex } = handleNextLogic(mockData, questions[0], questions, "a", false);
    expect(nextIndex).toBe(-1);
  });

  it("marks question as skipped when no option selected", () => {
    const questions = [makeQuestion("1"), makeQuestion("2")];
    const mockData = makeMockData([
      { num: "1", answeredCorrectly: false, answerSelected: "", skipped: false, flagged: false },
    ]);
    const { updatedMockData } = handleNextLogic(mockData, questions[0], questions, "", false);
    expect(updatedMockData.questions[0].skipped).toBe(true);
  });

  it("records flag state", () => {
    const questions = [makeQuestion("1"), makeQuestion("2")];
    const mockData = makeMockData([
      { num: "1", answeredCorrectly: false, answerSelected: "", skipped: false, flagged: false },
    ]);
    const { updatedMockData } = handleNextLogic(mockData, questions[0], questions, "a", true);
    expect(updatedMockData.questions[0].flagged).toBe(true);
  });
});

describe("syncUserCorrectIncorrectWithMock", () => {
  it("adds new question progress from mock data", () => {
    const user = makeUser();
    const mockData = makeMockData([
      { num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
    ]);
    const result = syncUserCorrectIncorrectWithMock(user, mockData);
    expect(result.questionProgress).toHaveLength(1);
    expect(result.questionProgress[0].answeredCorrectly).toBe(true);
  });

  it("updates existing question progress", () => {
    const user = makeUser();
    user.questionProgress.push({
      num: "1", answeredCorrectly: false, skipped: false, answerSelected: "b", flagged: false,
    });
    const mockData = makeMockData([
      { num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
    ]);
    const result = syncUserCorrectIncorrectWithMock(user, mockData);
    expect(result.questionProgress).toHaveLength(1);
    expect(result.questionProgress[0].answeredCorrectly).toBe(true);
  });

  it("does not update when answeredCorrectly is null", () => {
    const user = makeUser();
    user.questionProgress.push({
      num: "1", answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false,
    });
    const mockData = makeMockData([
      { num: "1", answeredCorrectly: null, answerSelected: "", skipped: true, flagged: false },
    ]);
    const result = syncUserCorrectIncorrectWithMock(user, mockData);
    expect(result.questionProgress[0].answeredCorrectly).toBe(true); // unchanged
  });
});

describe("changeQuestionState", () => {
  it("creates daily progress if none exists", () => {
    const user = makeUser();
    const mockQuestions = [
      { num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
    ];
    const result = changeQuestionState(user, mockQuestions);
    expect(result.dailyProgress).toHaveLength(1);
    expect(result.dailyProgress[0].attempted).toBe(1);
    expect(result.dailyProgress[0].correct).toBe(1);
  });

  it("increments incorrect for wrong answers", () => {
    const user = makeUser();
    const mockQuestions = [
      { num: "1", answeredCorrectly: false, answerSelected: "b", skipped: false, flagged: false },
    ];
    const result = changeQuestionState(user, mockQuestions);
    expect(result.dailyProgress[0].incorrect).toBe(1);
  });

  it("handles mix of correct and incorrect", () => {
    const user = makeUser();
    const mockQuestions = [
      { num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
      { num: "2", answeredCorrectly: false, answerSelected: "c", skipped: false, flagged: false },
      { num: "3", answeredCorrectly: true, answerSelected: "b", skipped: false, flagged: false },
    ];
    const result = changeQuestionState(user, mockQuestions);
    expect(result.dailyProgress[0].attempted).toBe(3);
    expect(result.dailyProgress[0].correct).toBe(2);
    expect(result.dailyProgress[0].incorrect).toBe(1);
  });
});

describe("didMockTestPass", () => {
  it("returns true when 17+ correct", () => {
    const questions = Array.from({ length: 33 }, (_, i) => ({
      num: String(i + 1),
      answeredCorrectly: i < 17,
      answerSelected: "a",
      skipped: false,
      flagged: false,
    }));
    expect(didMockTestPass(makeMockData(questions))).toBe(true);
  });

  it("returns false when fewer than 17 correct", () => {
    const questions = Array.from({ length: 33 }, (_, i) => ({
      num: String(i + 1),
      answeredCorrectly: i < 16,
      answerSelected: "a",
      skipped: false,
      flagged: false,
    }));
    expect(didMockTestPass(makeMockData(questions))).toBe(false);
  });

  it("returns false for empty questions", () => {
    expect(didMockTestPass(makeMockData([]))).toBe(false);
  });
});
