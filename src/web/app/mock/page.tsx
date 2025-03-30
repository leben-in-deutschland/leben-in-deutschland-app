"use client";

import { Quiz } from "@/components/quiz";
import StateSelect from "@/components/state-select";
import { getTranslations, questionsData } from "@/data/data";
import { getUserData } from "@/services/user";
import { Question } from "@/types/question";
import { User } from "@/types/user";
import { useEffect, useState } from "react";

export default function Mock() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [user, setUser] = useState<User>();

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
        let tempUser = getUserData();
        if (tempUser !== null) {
            setUser(tempUser);
        }
    }, []);

    useEffect(() => {
        let questions = questionsData();
        setQuestions(questions);
    }, []);
    const allTranslations = getTranslations(user?.appLanguage ?? "de");
    return (
        <div className="content-center">
            {!user?.state.stateName && <StateSelect translation={allTranslations} />}
            {user && questions && questions.length > 0 && <Quiz questions={questions} user={user} translation={allTranslations} />}
        </div>
    );
}