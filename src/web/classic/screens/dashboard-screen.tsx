"use client";

// Adapted from 2.0 (app/dashboard/page.tsx): the shell owns reminder
// planning, the update and review prompts, and record normalization, so the
// LocalNotifications effects, `AppUpdate`, `InAppReview`, and the
// `appFirstTimeOpenDateTime` fix-up were removed. The record comes from the
// shared `useUser()` hook instead of a mount effect plus "user" listener.
// Everything else is the 2.0 dashboard.
import { Question } from "@/types/question";
import { useState } from "react";
import DashboardReports from "@/classic/components/dashboard-report";
import DashboardGreeting from "@/classic/components/dashboard-greeting";
import { useUser } from "@/utils/user-store";
import MockHistory from "@/classic/components/mock-history";
import PrepareQuestion from "@/classic/components/prepare-question";
import MockTest from "@/classic/components/mock-test";
import StateSelect from "@/classic/components/state-select";
import { PrepareQuestionActions, PrepareQuestionType } from "@/classic/types/prepare-question";
import { ExamReadiness } from "@/classic/components/exam-readiness";
import { getTranslations, questionsData } from "@/data/data";
import { filterQuestionsForUser } from "@/classic/utils/prepare-logic";
import { QuizAnswer } from "@/classic/components/quiz-answer";

export function DashboardScreen() {
  const [questions] = useState<Question[]>(() => questionsData());
  const stored = useUser();
  // 2.0 kept `user` undefined until a record was read; `loaded` marks the first read.
  const user = stored ?? undefined;
  const loaded = stored !== undefined;
  const [prepareQuestion, setPrepareQuestion] = useState<PrepareQuestionType>({ selected: false, action: PrepareQuestionActions.Random });
  const [mockExamSelected, setMockExam] = useState<boolean>(false);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [resultDateTime, setResultDateTime] = useState<string>("");

  const handleMockCancel = () => {
    setPrepareQuestion({ selected: false, action: PrepareQuestionActions.Random });
    setMockExam(false);
    setShowResult(false);
    setResultDateTime("");
  };

  const handleHistoryPress = (datetime: string) => {
    setShowResult(true);
    setResultDateTime(datetime);
  };
  const allTranslations = getTranslations(user?.appLanguage ?? "de");
  return (
    <div className="container mx-auto">
      {loaded && !user?.state.stateName && <StateSelect
        translation={allTranslations}
      />}
      {user && prepareQuestion &&
        <>
          <div hidden={prepareQuestion.selected || mockExamSelected || showResult}>
            <div className="flex flex-col gap-3">
              <div className="dashboard-section-enter dashboard-section-enter-1">
                <DashboardGreeting
                  user={user}
                  totalQuestions={filterQuestionsForUser(questions, user.state.stateCode).length}
                  translation={allTranslations} />
              </div>
              <PrepareQuestion
                questions={questions}
                user={user}
                translation={allTranslations} />
              <MockTest
                user={user}
                translation={allTranslations} />
              <ExamReadiness
                user={user}
                translation={allTranslations} />
              {
                user && user.testProgress?.length > 0 &&
                <MockHistory
                  user={user}
                  handleHistoryPress={handleHistoryPress}
                  translation={allTranslations} />
              }
              <DashboardReports
                user={user}
                questions={questions}
                translation={allTranslations} />
            </div>
          </div>
          {showResult &&
            <div hidden={!showResult}>
              {
                questions &&
                questions.length > 0 &&
                user &&
                user.testProgress.findIndex(x => x.datetime === resultDateTime) > -1 &&
                <QuizAnswer
                  translation={allTranslations}
                  questions={questions}
                  handleQuizCancel={handleMockCancel}
                  mockExam={user.testProgress[user.testProgress.findIndex(x => x.datetime === resultDateTime)]} />}
            </div>
          }
        </>
      }
    </div>
  );
}
