"use client";

import { getUserData, saveUserData } from "@/services/user";
import { Question } from "@/types/question";
import { useEffect, useState } from "react";
import DashboardReports from "@/components/dashboard-report";
import { User, UserState } from "@/types/user";
import MockHistory from "@/components/mock-history";
import PrepareQuestion from "@/components/prepare-question";
import MockTest from "@/components/mock-test";
import StateSelect from "@/components/state-select";
import { PrepareQuestionActions, PrepareQuestionType } from "@/types/prepare-question";
import { ExamReadiness } from "@/components/exam-readiness";
import { QuizAnswer } from "@/components/quiz-answer";
import { questionsData } from "@/data/data";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { AppUpdate } from "@/components/app-update";

export default function Dashboard() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [user, setUser] = useState<User>();
  const [prepareQuestion, setPrepareQuestion] = useState<PrepareQuestionType>();
  const [mockExamSelected, setMockExam] = useState<boolean>(false);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [resultDateTime, setResultDateTime] = useState<string>("");
  const [permission, setPermission] = useState<string>("");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    LocalNotifications.checkPermissions().then((permission) => {
      setPermission(permission.display);
    });
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    (async () => {
      //'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'
      if (permission === "granted") {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "Don´t forget to study",
              body: "Continue your preparation for the Einbürgerungstest",
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
    })();
  }, [permission]);

  useEffect(() => {
    let tempUser = getUserData();
    if (tempUser !== null) {
      setUser(tempUser);
    }
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

  return (
    <div className="container mx-auto">
      {Capacitor.isNativePlatform() && <AppUpdate />}
      {!user?.state.stateName && <StateSelect />}
      {user && prepareQuestion &&
        <>
          <div hidden={prepareQuestion.selected || mockExamSelected || showResult}>
            <div className="flex flex-col gap-2">
              <PrepareQuestion questions={questions} user={user} />
              <MockTest user={user} />
              <ExamReadiness user={user} />
              {
                user && user.testProgress?.length > 0 &&
                <MockHistory user={user} handleHistoryPress={handleHistoryPress} />
              }
              <DashboardReports user={user} questions={questions} />
            </div>
          </div>
          {showResult &&
            <div hidden={!showResult}>
              {
                questions &&
                questions.length > 0 &&
                user &&
                user.testProgress.findIndex(x => x.datetime === resultDateTime) > -1 &&
                <QuizAnswer questions={questions} handleQuizCancel={handleMockCancel} mockExam={user.testProgress[user.testProgress.findIndex(x => x.datetime === resultDateTime)]} />}
            </div>
          }
        </>
      }
    </div>
  );
}
