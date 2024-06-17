"use client";
import { getQuestions } from "@/services/question";
import { getUserData, saveUserData } from "@/services/user";
import { Question } from "@/types/question";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardReports from "@/components/dashboard-report";
import { User } from "@/types/user";
import MockHistory from "@/components/mock-history";
import PrepareQuestion from "@/components/prepare-question";
import MockTest from "@/components/mock-test";
import StateSelect from "@/components/state-select";
import { saveStateChange } from "@/utils/state-utils";
import Quiz from "@/components/quiz";
import { PrepareQuestionActions, PrepareQuestionType } from "@/types/prepare-question";

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User>();
  const [stateName, setStateName] = useState<string>();
  const [prepareQuestion, setPrepareQuestion] = useState<PrepareQuestionType>();

  let session = useSession();

  useEffect(() => {
    (async () => {
      if (isAuthenticated) {
        let tempUser = await getUserData(isAuthenticated);
        if (tempUser !== null) {
          setUser(tempUser);
        }
      }
      let questions = await getQuestions();
      setQuestions(questions);
    })();

  }, [session.status, isAuthenticated]);


  useEffect(() => {
    if (user) {
      setStateName(user.state);
    }
  }, [user]);

  useEffect(() => {
    setIsAuthenticated(session.status === "authenticated")
  }, [session.status]);

  const handleSelectState = async (state: string) => {
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
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      {!stateName && <StateSelect handleSelectState={handleSelectState} />}
      {user && prepareQuestion &&
        <>
          <div hidden={!prepareQuestion.selected} >
            {questions && <Quiz questions={questions} user={user} prepareQuestion={prepareQuestion} handleHomePress={handleHomePress} isAuthenticated={isAuthenticated} />}
          </div>
          <div hidden={prepareQuestion.selected} className="w-[100%]">
            <DashboardReports isAuthenticated={isAuthenticated} user={user} handleStalePress={handleStalePress} />
            <div className="grid gap-4 md:grid-cols-2 md:w-[100%]">
              <div className="grid gap-4">
                <PrepareQuestion isAuthenticated={isAuthenticated} user={user} />
                <MockTest isAuthenticated={isAuthenticated} user={user} />
              </div>
              <div className="md:w-[100%]">
                <MockHistory isAuthenticated={isAuthenticated} user={user} />
              </div>
            </div>
          </div>
        </>
      }
    </section >
  );
}
