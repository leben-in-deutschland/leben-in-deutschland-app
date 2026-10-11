"use client";

import { AnswerOption, type AnswerState } from "@/components/question/answer-option";
import { QuestionHeading } from "@/components/question/question-heading";
import type { Question } from "@/types/question";
import type { Translations } from "@/utils/i18n";
import { ANSWER_OPTIONS, type AnswerOption as AnswerKey } from "@/utils/question-bank";

type QuestionCardProps = {
    question: Question;
    states: Record<AnswerKey, AnswerState>;
    /** True once the question is graded: answers can no longer be picked. */
    locked: boolean;
    onSelect: (option: AnswerKey) => void;
    t: Translations;
};

function statusFor(state: AnswerState, t: Translations): string | undefined {
    switch (state) {
        case "correct":
        case "reveal":
            return t.answer_correct_sr;
        case "wrong":
            return t.answer_wrong_sr;
        case "selected":
            return t.answer_selected_sr;
        default:
            return undefined;
    }
}

/** The question with its image and the four answers. */
export function QuestionCard({ question, states, locked, onSelect, t }: QuestionCardProps) {
    const headingId = `question-${question.num}-text`;
    return (
        <section className="flex flex-col gap-5 animate-rise-in">
            <QuestionHeading question={question} t={t} id={headingId} className="px-1" />
            <div role="group" aria-labelledby={headingId} data-answer-list="" className="flex flex-col gap-3">
                {ANSWER_OPTIONS.map((option) => {
                    const state = states[option];
                    return (
                        <AnswerOption
                            key={option}
                            letter={option}
                            state={state}
                            disabled={locked}
                            onSelect={() => onSelect(option)}
                            srStatus={statusFor(state, t)}
                        >
                            {question[option]}
                        </AnswerOption>
                    );
                })}
            </div>
        </section>
    );
}
