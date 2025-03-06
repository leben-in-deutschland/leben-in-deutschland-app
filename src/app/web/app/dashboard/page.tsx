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
import { getTranslations, questionsData } from "@/data/data";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { AppUpdate } from "@/components/app-update";
import { Filesystem } from "@capacitor/filesystem";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { QuizAnswer } from "@/components/quiz-answer";

export default function Dashboard() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [user, setUser] = useState<User>();
  const [prepareQuestion, setPrepareQuestion] = useState<PrepareQuestionType>();
  const [mockExamSelected, setMockExam] = useState<boolean>(false);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [resultDateTime, setResultDateTime] = useState<string>("");
  const [permission, setPermission] = useState<string>("");
  const [filePermission, setFilePermission] = useState<string>("");
  const [filePickerPermission, setFilePickerPermission] = useState<string>("");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    LocalNotifications.checkPermissions().then((permission) => {
      setPermission(permission.display);
    });
    Filesystem.checkPermissions().then((permission) => {
      setFilePermission(permission.publicStorage);
    });
    FilePicker.checkPermissions().then((permission) => {
      setFilePickerPermission(permission.readExternalStorage);
    });
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    (async () => {
      if (filePickerPermission === "prompt" || filePickerPermission === "prompt-with-rationale") {
        const resp = await FilePicker.requestPermissions();
        setPermission(resp.readExternalStorage);
      }
      if (filePickerPermission === "denied") {
        FilePicker.requestPermissions();
      }
    }
    )();
  }, [filePickerPermission]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    (async () => {
      if (filePermission === "prompt" || filePermission === "prompt-with-rationale") {
        const resp = await Filesystem.requestPermissions();
        setPermission(resp.publicStorage);
      }
      if (filePermission === "denied") {
        Filesystem.requestPermissions();
      }
    }
    )();
  }, [filePermission]);

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
      if (permission === "denied") {
        LocalNotifications.requestPermissions();
      }
    })();
  }, [permission]);

  const syncUserCorrectIncorrectWithMock = (user: User) => {
    if (user) {
      if (user.testProgress && user.testProgress.length > 0) {
        for (let mock of user.testProgress) {
          if (mock.questions && mock.questions.length > 0) {
            for (let question of mock.questions) {
              let tempQuestionIndex = user.questionProgress.findIndex(x => x.num === question.num);
              if (tempQuestionIndex > -1) {
                if (question.answeredCorrectly !== null) {
                  user.questionProgress[tempQuestionIndex].answeredCorrectly = question.answeredCorrectly;
                }
              }
            }
          }
        }
      }
    }
    return user;
  };

  useEffect(() => {
    let tempUser = getUserData();
    if (tempUser !== null) {
      tempUser = syncUserCorrectIncorrectWithMock(tempUser);
      setUser(tempUser);
      saveUserData(tempUser);
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
  const allTranslations = getTranslations(user?.appLanguage ?? "de");
  return (
    <div className="container mx-auto">
      {Capacitor.isNativePlatform() && <AppUpdate
        translation={allTranslations}
      />}
      {!user?.state.stateName && <StateSelect
        translation={allTranslations}
      />}
      {user && prepareQuestion &&
        <>
          <div hidden={prepareQuestion.selected || mockExamSelected || showResult}>
            <div className="flex flex-col gap-2">
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
