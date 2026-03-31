import { PrepareQuestionActions } from "@/types/prepare-question";
import { Question } from "@/types/question";
import { User, UserQuestionProgress } from "@/types/user";

/**
 * Check if a string is numeric.
 */
export function isNumeric(val: string): boolean {
  return !isNaN(Number(val));
}

/**
 * Filter questions to those matching the user's state (state-specific + general numeric).
 */
export function filterQuestionsForUser(
  questions: Question[],
  stateCode: string
): Question[] {
  return questions.filter(
    (x) => x?.num.startsWith(stateCode) || isNumeric(x?.num)
  );
}

/**
 * Build the question list for "Prepare" mode — only unanswered questions.
 */
export function buildPrepareQuestions(
  questions: Question[],
  questionProgress: UserQuestionProgress[]
): Question[] {
  const tempQuestion: Question[] = [];
  for (let i = 0; i < questions.length; i++) {
    if (questionProgress.findIndex((x) => x?.num === questions[i]?.num) > -1) {
      continue;
    }
    tempQuestion.push(questions[i]);
  }
  return tempQuestion;
}

/**
 * Build the question list for "State" mode — prioritized order:
 * incorrect → skipped → flagged → remaining.
 */
export function buildStateQuestions(
  questions: Question[],
  questionProgress: UserQuestionProgress[],
  stateCode: string
): Question[] {
  const stateQuestion: Question[] = [];
  const current: Question[] = questions.filter((x) =>
    x?.num.startsWith(stateCode)
  );

  // Incorrect
  const incorrectStatesQuestion = questionProgress.filter(
    (x) => x?.num.startsWith(stateCode) && !x.answeredCorrectly
  );
  for (let i = 0; i < incorrectStatesQuestion.length; i++) {
    const incorrectQ = current.findIndex(
      (x) => x?.num === incorrectStatesQuestion[i]?.num
    );
    if (incorrectQ > -1) {
      stateQuestion.push(current[incorrectQ]);
      current.splice(incorrectQ, 1);
    }
  }

  // Skipped
  let skippedStateQuestion = questionProgress.filter(
    (x) => x?.num.startsWith(stateCode) && x.skipped
  );
  const otherSkipped = questionProgress.filter(
    (x) =>
      x?.num.startsWith(stateCode) &&
      x.answeredCorrectly === null &&
      !x.flagged
  );
  skippedStateQuestion = [...skippedStateQuestion, ...otherSkipped];
  for (let i = 0; i < skippedStateQuestion.length; i++) {
    const skippedQ = current.findIndex(
      (x) => x?.num === skippedStateQuestion[i]?.num
    );
    if (skippedQ > -1) {
      stateQuestion.push(current[skippedQ]);
      current.splice(skippedQ, 1);
    }
  }

  // Flagged
  const flaggedStateQuestion = questionProgress.filter(
    (x) => x?.num.startsWith(stateCode) && x.flagged
  );
  for (let i = 0; i < flaggedStateQuestion.length; i++) {
    const flaggedQ = current.findIndex(
      (x) => x?.num === flaggedStateQuestion[i]?.num
    );
    if (flaggedQ > -1) {
      stateQuestion.push(current[flaggedQ]);
      current.splice(flaggedQ, 1);
    }
  }

  // Remaining
  stateQuestion.push(...current);
  return stateQuestion;
}

/**
 * Build the question list for "Skipped" mode.
 */
export function buildSkippedQuestions(
  questions: Question[],
  questionProgress: UserQuestionProgress[]
): Question[] {
  const tempSkipped: Question[] = [];
  const otherSkipped = questionProgress.filter(
    (x) => x.answeredCorrectly === null && !x.flagged
  );
  const skipped = questionProgress.filter((x) => x.skipped);
  const allSkipped = [...otherSkipped, ...skipped];
  for (let i = 0; i < allSkipped.length; i++) {
    const indexSkipped = questions.findIndex(
      (x) => x?.num === allSkipped[i]?.num
    );
    if (indexSkipped > -1) {
      tempSkipped.push(questions[indexSkipped]);
    }
  }
  return tempSkipped;
}

/**
 * Build the question list for "Flagged" mode.
 */
export function buildFlaggedQuestions(
  questions: Question[],
  questionProgress: UserQuestionProgress[]
): Question[] {
  const tempFlagged: Question[] = [];
  const flagged = questionProgress.filter((x) => x.flagged);
  for (let i = 0; i < flagged.length; i++) {
    const indexFlagged = questions.findIndex(
      (x) => x?.num === flagged[i]?.num
    );
    if (indexFlagged > -1) {
      tempFlagged.push(questions[indexFlagged]);
    }
  }
  return tempFlagged;
}

/**
 * Build the question list for "Correct" mode.
 */
export function buildCorrectQuestions(
  questions: Question[],
  questionProgress: UserQuestionProgress[]
): Question[] {
  const tempCorrect: Question[] = [];
  const correct = questionProgress.filter((x) => x.answeredCorrectly);
  for (let i = 0; i < correct.length; i++) {
    const indexCorrect = questions.findIndex(
      (x) => x?.num === correct[i]?.num
    );
    if (indexCorrect > -1) {
      tempCorrect.push(questions[indexCorrect]);
    }
  }
  return tempCorrect;
}

/**
 * Build the question list for "Incorrect" mode.
 */
export function buildIncorrectQuestions(
  questions: Question[],
  questionProgress: UserQuestionProgress[]
): Question[] {
  const tempIncorrect: Question[] = [];
  const incorrect = questionProgress.filter(
    (x) => x.answeredCorrectly !== null && !x.answeredCorrectly
  );
  for (let i = 0; i < incorrect.length; i++) {
    const indexIncorrect = questions.findIndex(
      (x) => x?.num === incorrect[i]?.num
    );
    if (indexIncorrect > -1) {
      tempIncorrect.push(questions[indexIncorrect]);
    }
  }
  return tempIncorrect;
}

/**
 * Get the next question in a sequence, or null if at the end.
 */
export function getNextQuestion(
  questions: Question[],
  currentQuestion: Question
): Question | null {
  const indexCurrentQuestion = questions.findIndex(
    (e) => e?.num === currentQuestion?.num
  );
  if (indexCurrentQuestion >= 0 && indexCurrentQuestion !== questions.length - 1) {
    return questions[indexCurrentQuestion + 1];
  }
  return null;
}

/**
 * Build the question list for a given action.
 */
export function buildQuestionsForAction(
  action: PrepareQuestionActions,
  questions: Question[],
  questionProgress: UserQuestionProgress[],
  stateCode: string
): Question[] {
  switch (action) {
    case PrepareQuestionActions.Prepare:
      return buildPrepareQuestions(questions, questionProgress);
    case PrepareQuestionActions.State:
      return buildStateQuestions(questions, questionProgress, stateCode);
    case PrepareQuestionActions.Skipped:
      return buildSkippedQuestions(questions, questionProgress);
    case PrepareQuestionActions.Flagged:
      return buildFlaggedQuestions(questions, questionProgress);
    case PrepareQuestionActions.Correct:
      return buildCorrectQuestions(questions, questionProgress);
    case PrepareQuestionActions.Incorrect:
      return buildIncorrectQuestions(questions, questionProgress);
    default:
      return questions;
  }
}
