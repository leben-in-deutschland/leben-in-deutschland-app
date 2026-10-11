"use client";

// Adapted from 2.0 (app/mock/page.tsx): a named component rendered by the
// classic shell instead of a Next.js page. The record comes from the shared
// `useUser()` hook, and the state picker waits for the first read instead of
// flashing before hydration.
import { Quiz } from "@/classic/components/quiz";
import StateSelect from "@/classic/components/state-select";
import { getTranslations, questionsData } from "@/data/data";
import { Question } from "@/types/question";
import { useUser } from "@/utils/user-store";
import { useState } from "react";

export function MockScreen() {
    const [questions] = useState<Question[]>(() => questionsData());
    const stored = useUser();
    const user = stored ?? undefined;
    const allTranslations = getTranslations(user?.appLanguage ?? "de");
    return (
        <div className="content-center">
            {stored !== undefined && !user?.state.stateName && <StateSelect translation={allTranslations} />}
            {user && questions && questions.length > 0 && <Quiz questions={questions} user={user} translation={allTranslations} />}
        </div>
    );
}
