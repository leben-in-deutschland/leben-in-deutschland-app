import { Question } from "@/types/question";
import { MockTestProgress, User, UserQuestionProgress } from "@/types/user";

/**
 * Check if a string is numeric.
 */
export function isNumeric(val: string): boolean {
  return !isNaN(Number(val));
}

/**
 * Check if a question is already in an array (by num).
 */
export function checkIfQuestionAlreadyPresentInArray(
  questions: Question[],
  current: Question
): boolean {
  return questions.findIndex((x) => x?.num === current?.num) > -1;
}

/**
 * Generate 33 random quiz questions: 30 general + 3 state-specific.
 * Pure logic extracted from quiz.tsx — deterministic when given a
 * custom randomFn for testing.
 */
export function generateRandomQuizQuestions(
  user: User,
  questions: Question[],
  randomFn: () => number = Math.random
): Question[] {
  const allNonStateQuestions = questions.filter((x) => isNumeric(x?.num));
  const allStateQuestions = questions.filter((x) =>
    x?.num.startsWith(user.state.stateCode)
  );

  const tempQuestions: Question[] = [];

  for (let i = 0; i < 30; ) {
    const idx = Math.floor(randomFn() * allNonStateQuestions.length);
    const currentRandom = allNonStateQuestions[idx];
    if (!checkIfQuestionAlreadyPresentInArray(tempQuestions, currentRandom)) {
      tempQuestions.push(currentRandom);
      i++;
    }
  }

  for (let i = 0; i < 3; ) {
    const idx = Math.floor(randomFn() * allStateQuestions.length);
    const currentRandom = allStateQuestions[idx];
    if (!checkIfQuestionAlreadyPresentInArray(tempQuestions, currentRandom)) {
      tempQuestions.push(currentRandom);
      i++;
    }
  }

  return tempQuestions;
}

/**
 * Handle option selection — update mock data with the selected answer.
 */
export function handleOptionSelectedLogic(
  currentMockData: MockTestProgress,
  currentQuizQuestion: Question,
  option: string
): MockTestProgress {
  const index = currentMockData.questions.findIndex(
    (x) => x?.num === currentQuizQuestion?.num
  );
  if (index > -1) {
    const temp = currentMockData.questions[index];
    temp.answeredCorrectly = currentQuizQuestion.solution === option;
    temp.answerSelected = option;
    temp.num = currentQuizQuestion?.num;
  } else {
    currentMockData.questions.push({
      answeredCorrectly: currentQuizQuestion.solution === option,
      answerSelected: option,
      num: currentQuizQuestion?.num,
      skipped: false,
      flagged: false,
    });
  }
  return currentMockData;
}

/**
 * Handle next — record the current answer/skip/flag state and return the next question index.
 * Returns the next question index, or -1 if already on the last question.
 */
export function handleNextLogic(
  currentMockData: MockTestProgress,
  currentQuizQuestion: Question,
  quizQuestions: Question[],
  optionSelected: string,
  flagPressed: boolean
): { updatedMockData: MockTestProgress; nextIndex: number } {
  const index = currentMockData.questions.findIndex(
    (x) => x?.num === currentQuizQuestion?.num
  );
  if (index > -1) {
    const temp = currentMockData.questions[index];
    temp.answeredCorrectly =
      currentQuizQuestion.solution === optionSelected;
    temp.answerSelected = optionSelected;
    temp.skipped = optionSelected === "";
    temp.flagged = flagPressed;
  } else {
    currentMockData.questions.push({
      answeredCorrectly:
        currentQuizQuestion.solution === optionSelected,
      answerSelected: optionSelected,
      num: currentQuizQuestion?.num,
      skipped: optionSelected === "",
      flagged: flagPressed,
    });
  }

  const indexCurrentQuestion = quizQuestions.findIndex(
    (e) => e?.num === currentQuizQuestion?.num
  );
  let nextIndex = -1;
  if (
    indexCurrentQuestion >= 0 &&
    indexCurrentQuestion !== quizQuestions.length - 1
  ) {
    nextIndex = indexCurrentQuestion + 1;
  }

  return { updatedMockData: currentMockData, nextIndex };
}

/**
 * Sync user's questionProgress with mock test answers.
 */
export function syncUserCorrectIncorrectWithMock(
  user: User,
  currentMockData: MockTestProgress
): User {
  if (user && currentMockData.questions && currentMockData.questions.length > 0) {
    for (const question of currentMockData.questions) {
      const tempQuestionIndex = user.questionProgress.findIndex(
        (x) => x.num === question.num
      );
      if (tempQuestionIndex > -1) {
        if (question.answeredCorrectly !== null) {
          user.questionProgress[tempQuestionIndex].answeredCorrectly =
            question.answeredCorrectly;
        }
      } else {
        user.questionProgress.push({
          num: question.num,
          answeredCorrectly: question.answeredCorrectly,
          skipped: false,
          answerSelected: question.answerSelected,
          flagged: false,
        });
      }
    }
  }
  return user;
}

/**
 * Update daily progress stats from mock test data.
 */
export function changeQuestionState(
  userData: User,
  mockQuestions: UserQuestionProgress[]
): User {
  const today = new Date().toDateString();
  let dailyStats = userData.dailyProgress.find(
    (dp) => new Date(dp.date).toDateString() === today
  );
  if (!dailyStats) {
    dailyStats = {
      date: today,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      skipped: 0,
      flagged: 0,
    };
    userData.dailyProgress.push(dailyStats);
  }
  for (const question of mockQuestions) {
    dailyStats.attempted++;
    if (question.answerSelected) {
      if (question.answeredCorrectly) {
        dailyStats.correct++;
      } else {
        dailyStats.incorrect++;
      }
    }
  }
  return userData;
}

/**
 * Determine if the mock test passed (17+ correct out of 33).
 */
export function didMockTestPass(mockData: MockTestProgress): boolean {
  return mockData.questions.filter((x) => x.answeredCorrectly).length >= 17;
}
