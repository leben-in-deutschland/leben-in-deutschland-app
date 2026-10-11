"use client";

import clsx from "clsx";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import type { Question } from "@/types/question";
import { fmt, type Translations } from "@/utils/i18n";
import { CheckIcon } from "@/components/ui/icons";
import type { ExamAnswers } from "./exam-logic";

type QuestionMapProps = {
    questions: readonly Question[];
    answers: ExamAnswers;
    flagged: ReadonlySet<string>;
    current: number;
    onJump: (index: number) => void;
    t: Translations;
};

function cellLabel(t: Translations, index: number, answered: boolean, isFlagged: boolean, isCurrent: boolean): string {
    const parts = [fmt(t.exam_map_cell_aria, { number: index + 1 }), answered ? t.exam_map_answered : t.common_unanswered];
    if (isFlagged) {
        parts.push(t.common_flagged);
    }
    if (isCurrent) {
        parts.push(t.exam_map_current);
    }
    return parts.join(", ");
}

/** Grid of all exam questions: filled = answered, dot = flagged, ring = current. */
export function QuestionMapGrid({ questions, answers, flagged, current, onJump, t }: QuestionMapProps) {
    return (
        <>
            <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-6 xl:grid-cols-7" aria-label={t.exam_map}>
                {questions.map((question, index) => {
                    const answered = Boolean(answers[question.num]);
                    const isFlagged = flagged.has(question.num);
                    const isCurrent = index === current;
                    return (
                        <li key={question.num} className="relative">
                            <button
                                type="button"
                                onClick={() => onJump(index)}
                                aria-current={isCurrent ? "step" : undefined}
                                aria-label={cellLabel(t, index, answered, isFlagged, isCurrent)}
                                className={clsx(
                                    "flex aspect-square min-h-[44px] w-full items-center justify-center rounded-xl text-sm font-semibold tabular transition-[background-color,box-shadow,transform] duration-200 active:scale-95",
                                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                                    answered
                                        ? "bg-primary text-primary-foreground shadow-glow"
                                        : "bg-content1 text-foreground shadow-card ring-1 ring-foreground/[0.07] hover:ring-default-400 dark:ring-white/[0.09]",
                                    isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                                )}
                            >
                                {index + 1}
                            </button>
                            {isFlagged ? (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 rounded-full border-2 border-background bg-warning"
                                />
                            ) : null}
                        </li>
                    );
                })}
            </ol>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-default-500">
                <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-primary text-primary-foreground">
                        <CheckIcon size={10} strokeWidth={3} />
                    </span>
                    {t.exam_map_answered}
                </li>
                <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block h-3.5 w-3.5 rounded border border-default-400 bg-content1" />
                    {t.common_unanswered}
                </li>
                <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-warning" />
                    {t.common_flagged}
                </li>
                <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block h-3.5 w-3.5 rounded border border-divider ring-2 ring-primary ring-offset-1 ring-offset-background" />
                    {t.exam_map_current}
                </li>
            </ul>
        </>
    );
}

type QuestionMapModalProps = QuestionMapProps & {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: () => void;
    summary: string;
};

/** The question map as a sheet on phones and a dialog on wide screens. */
export function QuestionMapModal({ isOpen, onOpenChange, onSubmit, summary, ...grid }: QuestionMapModalProps) {
    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside" size="lg">
            <ModalContent>
                {(close) => (
                    <>
                        <ModalHeader className="flex flex-col gap-0.5 font-display">
                            <span>{grid.t.exam_map}</span>
                            <span className="text-sm font-normal text-default-500">{summary}</span>
                        </ModalHeader>
                        <ModalBody>
                            <QuestionMapGrid
                                {...grid}
                                onJump={(index) => {
                                    grid.onJump(index);
                                    close();
                                }}
                            />
                        </ModalBody>
                        <ModalFooter className="pb-safe">
                            <Button variant="flat" onPress={close}>
                                {grid.t.common_close}
                            </Button>
                            <Button
                                color="primary"
                                onPress={() => {
                                    close();
                                    onSubmit();
                                }}
                            >
                                {grid.t.exam_submit}
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
