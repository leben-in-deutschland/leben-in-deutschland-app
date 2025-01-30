"use client";

import { Quiz } from "@/components/quiz";
import StateSelect from "@/components/state-select";
import { questionsData } from "@/data/data";
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

        window.addEventListener('storage', handleUserChange)
        return () => window.removeEventListener('storage', handleUserChange)
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

    return (
        <div className="content-center">
            {!user?.state.stateName && <StateSelect />}
            {user && questions && questions.length > 0 && <Quiz questions={questions} user={user} />}
        </div>
    );
}