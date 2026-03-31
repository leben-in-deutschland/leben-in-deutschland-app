"use client";

import { getUserData, saveUserData } from "@/services/user";
import { Question } from "@/types/question";
import { useEffect, useState } from "react";
import DashboardReports from "@/components/dashboard-report";
import DashboardGreeting from "@/components/dashboard-greeting";
import { User, UserState } from "@/types/user";
import MockHistory from "@/components/mock-history";
import PrepareQuestion from "@/components/prepare-question";
import MockTest from "@/components/mock-test";
import StateSelect from "@/components/state-select";
import { PrepareQuestionActions, PrepareQuestionType } from "@/types/prepare-question";
import { ExamReadiness } from "@/components/exam-readiness";
import { getTranslations, questionsData } from "@/data/data";
import { filterQuestionsForUser } from "@/utils/prepare-logic";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { AppUpdate } from "@/components/app-update";
import { QuizAnswer } from "@/components/quiz-answer";
import { InAppReview } from "@/components/modals/in-app-review";

export default function Dashboard() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [user, setUser] = useState<User>();
  const [prepareQuestion, setPrepareQuestion] = useState<PrepareQuestionType>();
  const [mockExamSelected, setMockExam] = useState<boolean>(false);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [resultDateTime, setResultDateTime] = useState<string>("");
  const [permission, setPermission] = useState<string>("");
  const [isNative, setIsNative] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    LocalNotifications.checkPermissions().then((permission) => {
      setPermission(permission.display);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !loaded) {
      return;
    }
    (async () => {
      try {
        //'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'
        if (permission === "granted") {
          const notifTranslations = getTranslations(user?.appLanguage ?? "de");
          await LocalNotifications.schedule({
            notifications: [
              {
                title: notifTranslations.notification_title,
                body: notifTranslations.notification_body,
                id: 65241,
                schedule: {
                  allowWhileIdle: true,
                  on: {
                    hour: 8,
                    minute: 0,
                    second: 0,
                  }
                },
              }
            ]
          });
          return;
        }
        else if (permission === "prompt" || permission === "prompt-with-rationale") {
          const resp = await LocalNotifications.requestPermissions();
          setPermission(resp.display);
        }
        if (permission === "denied") {
          LocalNotifications.requestPermissions();
        }
      } catch { /* plugin unavailable */ }
    })();
  }, [permission, user?.appLanguage, loaded]);

  useEffect(() => {
    let tempUser = getUserData();
    if (tempUser !== null) {
      if (!tempUser.appFirstTimeOpenDateTime) {
        tempUser.appFirstTimeOpenDateTime = new Date(Date.now());
      }
      setUser(tempUser);
      saveUserData(tempUser);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    let questions = questionsData();
    setQuestions(questions);
  }, []);

  useEffect(() => {
    const handleUserChange = () => {
      let tempUser = getUserData();
      if (tempUser !== null) {
        setUser(tempUser);
      }
    }

    window.addEventListener('user', handleUserChange)
    return () => window.removeEventListener('user', handleUserChange)
  }, []);

  useEffect(() => {
    setPrepareQuestion({ selected: false, action: PrepareQuestionActions.Random })
  }, []);

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
      {isNative && <AppUpdate
        translation={allTranslations}
      />}
      {loaded && !user?.state.stateName && <StateSelect
        translation={allTranslations}
      />}
      {isNative &&
        user && <InAppReview translation={allTranslations} user={user} />
      }
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
