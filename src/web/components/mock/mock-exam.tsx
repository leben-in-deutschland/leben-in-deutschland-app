"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import type { Question } from "@/types/question";
import type { UserPreferences } from "@/types/user";
import { hapticTap } from "@/services/haptics";
import { fmt, formatClock, plural, type Translations } from "@/utils/i18n";
import { ANSWER_OPTIONS, type AnswerOption as AnswerLetter } from "@/utils/question-bank";
import { AnswerOption } from "@/components/question/answer-option";
import { QuestionHeading } from "@/components/question/question-heading";
import { ArrowLeftIcon, ArrowRightIcon, ClockIcon, FlagIcon, GridIcon, KeyboardIcon, XIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { useBackButton } from "@/components/shell/use-back-button";
import { Surface } from "@/components/ui/surface";
import { openItems, remainingSeconds, timerTone, type ExamAnswers, type TimerTone } from "./exam-logic";
import { QuestionMapGrid, QuestionMapModal } from "./question-map";

export type ExamFinishReason = "submitted" | "cancelled" | "timeout";

export interface ExamFinishPayload {
    answers: ExamAnswers;
    flagged: string[];
    reason: ExamFinishReason;
}

type MockExamProps = {
    questions: Question[];
    startedAt: Date;
    timed: boolean;
    prefs: UserPreferences;
    /** Native shells have no page reloads, so the leave warning is web only. */
    isNative: boolean;
    t: Translations;
    onFinish: (payload: ExamFinishPayload) => void;
};

const TIMER_STYLES: Record<TimerTone, string> = {
    default: "bg-default-100 text-foreground",
    warning: "bg-warning-100 text-warning-700",
    danger: "bg-danger-100 text-danger-700 motion-safe:animate-pulse",
};

/** 1–4 and A–D pick an answer; anything else returns -1. */
function answerIndexForKey(key: string): number {
    if (key.length !== 1) {
        return -1;
    }
    const digit = "1234".indexOf(key);
    return digit !== -1 ? digit : "abcd".indexOf(key.toLowerCase());
}

function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function toggleIn(set: ReadonlySet<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) {
        next.delete(value);
    } else {
        next.add(value);
    }
    return next;
}

/** The running exam: top bar with clock and tools, one question at a time, map and dialogs. */
export function MockExam({ questions, startedAt, timed, prefs, isNative, t, onFinish }: MockExamProps) {
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState<ExamAnswers>({});
    const [flagged, setFlagged] = useState<ReadonlySet<string>>(() => new Set());
    const [now, setNow] = useState(() => startedAt.getTime());
    const [mapOpen, setMapOpen] = useState(false);
    const [exitOpen, setExitOpen] = useState(false);
    const [submitOpen, setSubmitOpen] = useState(false);
    useBackButton(() => setExitOpen(true));

    const total = questions.length;
    const question = questions[index];
    const selected = question ? answers[question.num] : undefined;
    const isFlagged = question ? flagged.has(question.num) : false;
    const isLast = index >= total - 1;
    const open = openItems(questions, answers, flagged);
    const remaining = remainingSeconds(startedAt, now);
    const tone = timerTone(remaining);
    const anyDialogOpen = mapOpen || exitOpen || submitOpen;
    const progressLabel = fmt(t.exam_answered_progress, { answered: open.answered, total });

    const finishedRef = useRef(false);
    const finish = (reason: ExamFinishReason) => {
        if (finishedRef.current) {
            return;
        }
        finishedRef.current = true;
        onFinish({ answers, flagged: [...flagged], reason });
    };

    // The clock needs the latest answers when it submits for the learner.
    const finishRef = useRef(finish);
    useEffect(() => {
        finishRef.current = finish;
    });

    useEffect(() => {
        if (!timed) {
            return;
        }
        const id = window.setInterval(() => {
            const tick = Date.now();
            setNow(tick);
            if (remainingSeconds(startedAt, tick) <= 0) {
                window.clearInterval(id);
                finishRef.current("timeout");
            }
        }, 1000);
        return () => window.clearInterval(id);
    }, [timed, startedAt]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [index]);

    useEffect(() => {
        if (isNative) {
            return;
        }
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = t.exam_leave_warning;
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [isNative, t.exam_leave_warning]);

    useEffect(() => {
        if (anyDialogOpen || !question) {
            return;
        }
        const num = question.num;
        const haptics = prefs.haptics;
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
                return;
            }
            const answerIndex = answerIndexForKey(event.key);
            if (answerIndex !== -1) {
                event.preventDefault();
                setAnswers((prev) => ({ ...prev, [num]: ANSWER_OPTIONS[answerIndex] }));
                void hapticTap(haptics);
                return;
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                setIndex((current) => Math.min(current + 1, total - 1));
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                setIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "f" || event.key === "F") {
                event.preventDefault();
                setFlagged((prev) => toggleIn(prev, num));
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [anyDialogOpen, question, total, prefs.haptics]);

    if (!question) {
        return null;
    }

    const select = (letter: AnswerLetter) => {
        setAnswers((prev) => ({ ...prev, [question.num]: letter }));
        void hapticTap(prefs.haptics);
    };

    const toggleFlag = () => setFlagged((prev) => toggleIn(prev, question.num));

    const jumpTo = (next: number) => setIndex(Math.min(Math.max(next, 0), total - 1));

    const requestSubmit = () => {
        setMapOpen(false);
        setSubmitOpen(true);
    };

    const reviewOpenItems = () => {
        setSubmitOpen(false);
        const target = open.firstUnanswered !== -1 ? open.firstUnanswered : open.firstFlagged;
        if (target !== -1) {
            jumpTo(target);
        }
        // Wide screens show the map next to the question already.
        const wide = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1024px)").matches;
        if (!wide) {
            setMapOpen(true);
        }
    };

    const positionText = fmt(t.exam_position_aria, { current: index + 1, total });
    const mapProps = { questions, answers, flagged, current: index, onJump: jumpTo, t };
    // Announced once when 5 minutes and once when 1 minute are left, not every second.
    const timeAnnouncement = timed && tone !== "default" ? fmt(t.exam_time_left_aria, { time: formatClock(tone === "danger" ? 60 : 300) }) : "";

    return (
        <div className="flex flex-1 flex-col">
            <p className="sr-only" role="status">
                {timeAnnouncement}
            </p>
            <header className="sticky top-0 z-30 -mx-4 border-b border-divider bg-background/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
                <div className="flex h-14 items-center gap-1">
                    <Button
                        isIconOnly
                        variant="light"
                        radius="full"
                        aria-label={t.exam_exit}
                        className="h-11 w-11 min-w-11"
                        onPress={() => setExitOpen(true)}
                    >
                        <XIcon size={22} />
                    </Button>
                    <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3">
                        {timed ? (
                            <span
                                role="timer"
                                aria-live="off"
                                aria-label={fmt(t.exam_time_left_aria, { time: formatClock(remaining) })}
                                className={clsx(
                                    "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold tabular transition-colors",
                                    TIMER_STYLES[tone],
                                )}
                            >
                                <ClockIcon size={16} />
                                <span aria-hidden="true">{formatClock(remaining)}</span>
                            </span>
                        ) : null}
                        <p className="text-sm font-semibold tabular text-foreground">
                            <span className="sr-only">{positionText}</span>
                            <span aria-hidden="true">
                                {index + 1} / {total}
                            </span>
                        </p>
                    </div>
                    <Button
                        isIconOnly
                        variant="light"
                        radius="full"
                        aria-pressed={isFlagged}
                        aria-label={isFlagged ? t.exam_unflag : t.exam_flag}
                        className={clsx("h-11 w-11 min-w-11", isFlagged && "text-warning-600")}
                        onPress={toggleFlag}
                    >
                        <FlagIcon size={22} fill={isFlagged ? "currentColor" : "none"} />
                    </Button>
                    <Button
                        isIconOnly
                        variant="light"
                        radius="full"
                        aria-label={t.exam_map}
                        className="h-11 w-11 min-w-11 lg:hidden"
                        onPress={() => setMapOpen(true)}
                    >
                        <GridIcon size={22} />
                    </Button>
                </div>
                <div className="pb-2">
                    <ProgressBar value={total > 0 ? open.answered / total : 0} size="sm" label={progressLabel} />
                </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6 lg:pt-6">
                <div className="flex flex-col gap-4">
                    <section key={question.num} className="flex flex-col gap-5 animate-rise-in">
                        <QuestionHeading question={question} t={t} position={positionText} id="exam-question" className="px-1" />
                        <div role="group" aria-labelledby="exam-question" className="flex flex-col gap-3">
                            {ANSWER_OPTIONS.map((letter) => (
                                <AnswerOption
                                    key={letter}
                                    letter={letter}
                                    state={selected === letter ? "selected" : "idle"}
                                    onSelect={() => select(letter)}
                                    srStatus={selected === letter ? t.answer_selected_sr : undefined}
                                >
                                    {question[letter]}
                                </AnswerOption>
                            ))}
                        </div>
                    </section>
                    <p className="hidden items-center gap-1.5 text-xs text-default-400 lg:flex">
                        <KeyboardIcon size={14} />
                        {t.exam_keyboard_hint}
                    </p>
                </div>

                <aside className="hidden lg:block">
                    <Surface padding="md" className="sticky top-24 flex flex-col gap-3">
                        <div className="flex items-baseline justify-between gap-2">
                            <h2 className="font-display text-base font-semibold text-foreground">{t.exam_map}</h2>
                            <span className="text-xs text-default-500">{progressLabel}</span>
                        </div>
                        <QuestionMapGrid {...mapProps} />
                        <Button color="primary" className="mt-1 font-semibold" onPress={requestSubmit}>
                            {t.exam_submit}
                        </Button>
                    </Surface>
                </aside>
            </div>

            <nav className="sticky bottom-0 z-20 -mx-4 -mb-10 mt-4 border-t border-divider bg-background/90 px-4 pb-safe backdrop-blur-md sm:-mx-6 sm:px-6">
                <div className="flex items-center gap-3 py-3">
                    <Button
                        variant="flat"
                        size="lg"
                        className="h-12 flex-1 font-semibold"
                        startContent={<ArrowLeftIcon size={18} />}
                        isDisabled={index === 0}
                        onPress={() => jumpTo(index - 1)}
                    >
                        {t.common_back}
                    </Button>
                    {isLast ? (
                        <Button color="primary" size="lg" className="h-12 flex-1 font-semibold" onPress={requestSubmit}>
                            {t.exam_submit}
                        </Button>
                    ) : (
                        <Button
                            color="primary"
                            size="lg"
                            className="h-12 flex-1 font-semibold"
                            endContent={<ArrowRightIcon size={18} />}
                            onPress={() => jumpTo(index + 1)}
                        >
                            {t.next}
                        </Button>
                    )}
                </div>
            </nav>

            <QuestionMapModal {...mapProps} isOpen={mapOpen} onOpenChange={setMapOpen} onSubmit={requestSubmit} summary={progressLabel} />

            <Modal isOpen={exitOpen} onOpenChange={setExitOpen} placement="center">
                <ModalContent>
                    {(close) => (
                        <>
                            <ModalHeader className="font-display">{t.exam_exit_title}</ModalHeader>
                            <ModalBody>
                                <p className="text-default-600">{t.exam_exit_desc}</p>
                            </ModalBody>
                            <ModalFooter className="pb-safe">
                                <Button variant="flat" onPress={close}>
                                    {t.exam_exit_stay}
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={() => {
                                        close();
                                        finish("cancelled");
                                    }}
                                >
                                    {t.exam_exit_confirm}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={submitOpen} onOpenChange={setSubmitOpen} placement="center">
                <ModalContent>
                    {(close) => (
                        <>
                            <ModalHeader className="font-display">{t.exam_submit_title}</ModalHeader>
                            <ModalBody>
                                {open.unanswered === 0 && open.flagged === 0 ? (
                                    <p className="text-default-600">{fmt(t.exam_submit_all_answered, { total })}</p>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {open.unanswered > 0 ? (
                                            <li className="flex items-center gap-2 text-default-700">
                                                <span aria-hidden="true" className="inline-block h-3.5 w-3.5 shrink-0 rounded border border-default-400 bg-content1" />
                                                {plural(t, "exam_submit_unanswered", open.unanswered)}
                                            </li>
                                        ) : null}
                                        {open.flagged > 0 ? (
                                            <li className="flex items-center gap-2 text-default-700">
                                                <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full bg-warning" />
                                                {plural(t, "exam_submit_flagged", open.flagged)}
                                            </li>
                                        ) : null}
                                    </ul>
                                )}
                                {open.unanswered > 0 ? <p className="text-sm text-default-500">{t.exam_submit_hint}</p> : null}
                            </ModalBody>
                            <ModalFooter className="pb-safe">
                                {open.unanswered > 0 || open.flagged > 0 ? (
                                    <Button variant="flat" onPress={reviewOpenItems}>
                                        {t.exam_submit_review}
                                    </Button>
                                ) : (
                                    <Button variant="flat" onPress={close}>
                                        {t.common_cancel}
                                    </Button>
                                )}
                                <Button
                                    color="primary"
                                    onPress={() => {
                                        close();
                                        finish("submitted");
                                    }}
                                >
                                    {open.unanswered > 0 || open.flagged > 0 ? t.exam_submit_anyway : t.exam_submit}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
