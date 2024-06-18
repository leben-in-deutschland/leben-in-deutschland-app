"use client";
import { getQuestions } from "@/services/question";
import { getUserData, saveUserData } from "@/services/user";
import { Question } from "@/types/question";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardReports from "@/components/dashboard-report";
import { User, UserState } from "@/types/user";
import MockHistory from "@/components/mock-history";
import PrepareQuestion from "@/components/prepare-question";
import MockTest from "@/components/mock-test";
import StateSelect from "@/components/state-select";
import { saveStateChange } from "@/utils/state-utils";
import { PrepareQuestionActions, PrepareQuestionType } from "@/types/prepare-question";
import { State } from "@/types/state";
import PrepareQuiz from "@/components/prepare-quiz";
import { Quiz } from "@/components/quiz";
import { ExamReadiness } from "@/components/exam-readiness";

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User>();
  const [prepareQuestion, setPrepareQuestion] = useState<PrepareQuestionType>();
  const [mockExamSelected, setMockExam] = useState<boolean>(false);
  let session = useSession();

  useEffect(() => {
    (async () => {
      let tempUser = await getUserData(isAuthenticated);
      if (tempUser !== null) {
        setUser(tempUser);
      }

      let questions = await getQuestions();
      setQuestions(questions);
    })();

  }, [session.status, isAuthenticated]);

  useEffect(() => {
    setIsAuthenticated(session.status === "authenticated")
  }, [session.status]);

  const handleSelectState = async (state: State) => {
    let userData = await saveStateChange(state, isAuthenticated)
    setUser(userData);
  };

  useEffect(() => {
    const handleUserChange = async () => {
      let tempUser = await getUserData(isAuthenticated);
      if (tempUser !== null) {
        setUser(tempUser);
      }
    }

    window.addEventListener('user', handleUserChange)
    return () => window.removeEventListener('storage', handleUserChange)
  }, [isAuthenticated]);

  useEffect(() => {
    setPrepareQuestion({ selected: false, action: PrepareQuestionActions.Random })
  }, []);

  const handleStalePress = (action: PrepareQuestionActions) => setPrepareQuestion({ selected: true, action: action });
  const handleHomePress = () => setPrepareQuestion({ selected: false, action: PrepareQuestionActions.Random });

  const handleMockExamPress = (action: PrepareQuestionActions) => {
    if (action === PrepareQuestionActions.Mock) {
      setMockExam(true);
    }
  };

  const handleMockCancel = () => {
    setPrepareQuestion({ selected: false, action: PrepareQuestionActions.Random });
    setMockExam(false);
  };

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      {!user?.state.stateName && <StateSelect handleSelectState={handleSelectState} />}
      {user && prepareQuestion &&
        <>
          <div hidden={prepareQuestion.selected || mockExamSelected}>
            <div className="grid gap-4 md:grid-cols-2 mb-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-4">
                  <PrepareQuestion questions={questions} user={user} handleStalePress={handleStalePress} />
                  <MockTest isAuthenticated={isAuthenticated} user={user} handlePress={handleMockExamPress} />
                </div>
                <div className="h-[100%]">
                  <ExamReadiness user={user} />
                </div>
              </div>
              <div >
                <MockHistory isAuthenticated={isAuthenticated} user={user} />
              </div>
            </div>
            <div>
              <DashboardReports isAuthenticated={isAuthenticated} user={user} handleStalePress={handleStalePress} questions={questions} />
            </div>
          </div>
          {prepareQuestion.selected && <div hidden={!prepareQuestion.selected} >
            {questions && questions.length > 0 && prepareQuestion.selected && <PrepareQuiz originalQuestions={questions} user={user}
              prepareQuestion={prepareQuestion}
              handleHomePress={handleHomePress}
              isAuthenticated={isAuthenticated} />}
          </div>}
          {mockExamSelected && <div hidden={!mockExamSelected}>
            {questions && questions.length > 0 && <Quiz questions={questions} user={user} isAuthenticated={isAuthenticated} handleCancel={handleMockCancel} />}
          </div>}
        </>
      }
    </section >
  );
}
