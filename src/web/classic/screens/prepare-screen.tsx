"use client";

// Adapted from 2.0 (app/prepare/page.tsx): a named component rendered by the
// classic shell instead of a Next.js page. The record comes from the shared
// `useUser()` hook, and the state picker waits for the first read instead of
// flashing before hydration. It still reads `?action=` through
// `useSearchParams`, so the caller wraps it in Suspense.
import PrepareQuiz from "@/classic/components/prepare-quiz";
import StateSelect from "@/classic/components/state-select";
import { getTranslations, questionsData } from "@/data/data";
import { PrepareQuestionActions } from "@/classic/types/prepare-question";
import { Question } from "@/types/question";
import { useUser } from "@/utils/user-store";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function PrepareScreen() {
    const [questions] = useState<Question[]>(() => questionsData());
    const stored = useUser();
    const user = stored ?? undefined;
    const searchParams = useSearchParams();
    const action = searchParams.get('action');

    const getAction = (action: string | null) => {
        switch (action) {
            case "correct": return PrepareQuestionActions.Correct;
            case "incorrect": return PrepareQuestionActions.Incorrect;
            case "flagged": return PrepareQuestionActions.Flagged;
            case "skipped": return PrepareQuestionActions.Skipped;
            case "state": return PrepareQuestionActions.State;
            case "mock": return PrepareQuestionActions.Mock;
            case "random": return PrepareQuestionActions.Random;
            case "failed": return PrepareQuestionActions.Failed
            case "prepare": return PrepareQuestionActions.Prepare;
            default: return PrepareQuestionActions.Prepare;
        };
    };

    const allTranslations = getTranslations(user?.appLanguage ?? "de");
    return (
        <div className="content-center">
            {stored !== undefined && !user?.state.stateName && <StateSelect translation={allTranslations} />}
            {questions && questions.length > 0 && user &&
                <PrepareQuiz
                    translations={allTranslations}
                    originalQuestions={questions}
                    user={user}
                    prepareQuestion={{ selected: false, action: getAction(action) }} />
            }
        </div>
    );
}
