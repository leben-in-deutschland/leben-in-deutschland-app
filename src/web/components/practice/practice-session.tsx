"use client";

import { Button } from "@heroui/react";
import clsx from "clsx";
import { useEffect, useReducer, useRef, useState } from "react";
import { AppLink, useAppNavigate } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/feedback";
import { ArrowRightIcon, SkipIcon } from "@/components/ui/icons";
import { hapticError, hapticSuccess, hapticTap } from "@/services/haptics";
import type { Question } from "@/types/question";
import type { User } from "@/types/user";
import { dayKey } from "@/utils/date-utils";
import { fmt, type Translations } from "@/utils/i18n";
import { recordAnswer, recordSkip, toggleFlag } from "@/utils/practice-logic";
import type { AnswerOption } from "@/utils/question-bank";
import { goalProgress } from "@/utils/streak-logic";
import { buildModeQuestions, getStudyMode, modeHref, suggestNextAction, type StudyModeId } from "@/utils/study-modes";
import { prefsOf } from "@/utils/user-defaults";
import { readUser, updateUser, useAppLanguage, useIsNative, useTranslations } from "@/utils/user-store";
import { ExplanationPanel } from "./explanation-panel";
import { ListenButton } from "./listen-button";
import { QuestionCard } from "./question-card";
import {
    answerStates,
    createSession,
    isInteractiveTarget,
    isTypingTarget,
    keyAction,
    normalizeTranslationLanguage,
    sessionReducer,
    speechText,
    summarizeSession,
    type TranslationLanguage,
} from "./session-logic";
import { SessionSummaryScreen } from "./session-summary";
import { SessionTopBar } from "./session-top-bar";
import { TranslationPanel } from "./translation-panel";

const AUTO_ADVANCE_MS = 900;

type PracticeSessionProps = {
    user: User;
    mode: StudyModeId;
    category?: string;
    /** Questions in this session, 0 for all. Default: the learner's preference. */
    sessionSize?: number;
    /** Catalogue number of the question to open with, e.g. from a notification; see `ModeOptions.startNum`. */
    startNum?: string;
};

function isFlagged(user: User, num: string): boolean {
    return Boolean((user.questionProgress ?? []).find((entry) => entry?.num === num)?.flagged);
}

function saveTranslationLanguage(language: TranslationLanguage): void {
    updateUser((draft) => {
        draft.preferences = { ...prefsOf(draft), translationLanguage: language };
    });
}

type EmptySessionProps = {
    user: User;
    mode: StudyModeId;
    today: string;
    t: Translations;
};

/** A mode without questions: say so and offer a way on. */
function EmptySession({ user, mode, today, t }: EmptySessionProps) {
    const modeDef = getStudyMode(mode);
    const suggestion = suggestNextAction(user, today);
    const alternative =
        suggestion.kind === "mode" && suggestion.mode !== mode
            ? { href: modeHref(suggestion.mode), label: t[getStudyMode(suggestion.mode).titleKey] ?? suggestion.mode }
            : { href: "/mock", label: t.practice_take_mock };
    return (
        <div className="mx-auto w-full max-w-2xl py-10 animate-rise-in">
            <EmptyState
                icon={modeDef.icon}
                accent={modeDef.accent}
                title={t.practice_empty_title}
                description={t.practice_empty_body}
                action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button as={AppLink} href={alternative.href} color="primary" className="h-12 px-5 font-semibold">
                            {alternative.label}
                        </Button>
                        <Button as={AppLink} href="/practice" variant="flat" className="h-12 px-5 font-semibold">
                            {t.practice_back_to_practice}
                        </Button>
                    </div>
                }
            />
        </div>
    );
}

/** One practice session: question by question, then the summary. */
export function PracticeSession({ user, mode, category, sessionSize, startNum }: PracticeSessionProps) {
    const t = useTranslations();
    const appLanguage = useAppLanguage();
    const isNative = useIsNative();
    const navigate = useAppNavigate();
    const today = dayKey();
    const prefs = prefsOf(user);

    // The question list is built once; later changes to the record do not
    // reorder it. The page remounts this component (its key holds mode,
    // category, size, and start question) when the URL asks for another session.
    const [session, dispatch] = useReducer(sessionReducer, null, () =>
        createSession(buildModeQuestions(readUser() ?? user, mode, { today: dayKey(), category, sessionSize, startNum })),
    );
    const [flagNotice, setFlagNotice] = useState<{ id: number; num: string; text: string } | null>(null);

    const advanceTimer = useRef<number | null>(null);
    const clearAdvance = () => {
        if (advanceTimer.current !== null) {
            window.clearTimeout(advanceTimer.current);
            advanceTimer.current = null;
        }
    };
    useEffect(() => clearAdvance, []);

    const question: Question | undefined = session.questions[session.index];
    const total = session.questions.length;
    const isLast = session.index >= total - 1;
    const flagged = question ? isFlagged(user, question.num) : false;
    const translationLanguage = normalizeTranslationLanguage(prefs.translationLanguage);

    const modeDef = getStudyMode(mode);
    const topic = (category ?? "").replace(/['"]/g, "").trim();
    const title =
        session.round > 0 ? t.practice_retry_title : mode === "category" && topic ? (t[topic] ?? topic) : (t[modeDef.titleKey] ?? modeDef.id);

    const goNext = () => {
        clearAdvance();
        dispatch({ type: "next" });
    };

    const grade = (option: AnswerOption) => {
        if (!question || session.graded) {
            return;
        }
        const correct = option === question.solution;
        updateUser((draft) => recordAnswer(draft, question, option, new Date()).user);
        void (correct ? hapticSuccess(prefs.haptics) : hapticError(prefs.haptics));
        dispatch({ type: "answer", option, correct });
        if (correct && prefs.autoAdvance) {
            clearAdvance();
            advanceTimer.current = window.setTimeout(() => {
                advanceTimer.current = null;
                dispatch({ type: "next" });
            }, AUTO_ADVANCE_MS);
        }
    };

    const choose = (option: AnswerOption) => {
        if (!question || session.graded) {
            return;
        }
        // Instant mode grades right away; confirm mode selects first and
        // grades on "Check" or on a second tap of the same answer.
        if (!prefs.confirmAnswers || session.selected === option) {
            grade(option);
            return;
        }
        void hapticTap(prefs.haptics);
        dispatch({ type: "select", option });
    };

    const check = () => {
        if (session.selected) {
            grade(session.selected);
        }
    };

    const skip = () => {
        if (!question || session.graded) {
            return;
        }
        clearAdvance();
        updateUser((draft) => recordSkip(draft, question, new Date()));
        dispatch({ type: "skip" });
    };

    const flag = () => {
        if (!question) {
            return;
        }
        const next = updateUser((draft) => toggleFlag(draft, question, new Date()).user);
        const nowFlagged = next ? isFlagged(next, question.num) : !flagged;
        void hapticTap(prefs.haptics);
        setFlagNotice((previous) => ({
            id: (previous?.id ?? 0) + 1,
            num: question.num,
            text: nowFlagged ? t.practice_flag_added : t.practice_flag_removed,
        }));
    };

    const primary = () => {
        if (session.graded) {
            goNext();
        } else if (prefs.confirmAnswers) {
            check();
        }
    };

    const close = () => {
        clearAdvance();
        navigate("/practice");
    };

    const retry = (questions: Question[]) => {
        clearAdvance();
        dispatch({ type: "restart", questions });
    };

    // Keyboard shortcuts read the latest handlers through a ref, so the
    // listener is attached once.
    const actions = { choose, primary, skip, flag };
    const actionsRef = useRef(actions);
    useEffect(() => {
        actionsRef.current = actions;
    });
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.repeat || isTypingTarget(event.target)) {
                return;
            }
            const action = keyAction(event);
            if (!action) {
                return;
            }
            // Buttons and links act on Enter themselves.
            if (action.type === "primary" && isInteractiveTarget(event.target)) {
                return;
            }
            event.preventDefault();
            const current = actionsRef.current;
            switch (action.type) {
                case "select":
                    current.choose(action.option);
                    break;
                case "primary":
                    current.primary();
                    break;
                case "skip":
                    current.skip();
                    break;
                case "flag":
                    current.flag();
                    break;
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    if (total === 0) {
        return <EmptySession user={user} mode={mode} today={today} t={t} />;
    }

    if (session.finished || !question) {
        const summary = summarizeSession(session.log, session.questions);
        return (
            <SessionSummaryScreen
                summary={summary}
                goal={goalProgress(user, today)}
                onRetry={() => retry(summary.wrongQuestions)}
                t={t}
            />
        );
    }

    const graded = session.graded;
    const questionKey = `${session.round}:${question.num}`;

    return (
        <div className="flex flex-col">
            <SessionTopBar
                title={title}
                current={session.index + 1}
                total={total}
                flagged={flagged}
                onClose={close}
                onToggleFlag={flag}
                t={t}
            />
            <span className="sr-only" role="status" aria-live="polite">
                {flagNotice && flagNotice.num === question.num ? <span key={flagNotice.id}>{flagNotice.text}</span> : null}
            </span>

            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-32 pt-4">
                <QuestionCard
                    key={`card:${questionKey}`}
                    question={question}
                    states={answerStates(question, session.selected, graded)}
                    locked={graded !== null}
                    onSelect={choose}
                    t={t}
                />

                <div role="status" aria-live="assertive" className="empty:hidden">
                    {graded ? (
                        <p
                            className={clsx(
                                "rounded-xl px-4 py-3 text-sm font-semibold animate-pop-in",
                                graded.correct ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700",
                            )}
                        >
                            {graded.correct
                                ? t.practice_feedback_correct
                                : fmt(t.practice_feedback_wrong, { letter: question.solution.toUpperCase() })}
                        </p>
                    ) : null}
                </div>

                {!graded && prefs.confirmAnswers ? <p className="text-center text-sm text-default-500">{t.practice_confirm_hint}</p> : null}

                {graded ? (
                    <ExplanationPanel
                        key={`explain:${questionKey}:${appLanguage}`}
                        num={question.num}
                        language={appLanguage}
                        defaultOpen={!graded.correct}
                        t={t}
                    />
                ) : null}

                <TranslationPanel
                    key={`translate:${questionKey}`}
                    num={question.num}
                    language={translationLanguage}
                    onLanguageChange={saveTranslationLanguage}
                    t={t}
                />

                {isNative ? (
                    <div className="flex justify-end">
                        <ListenButton key={`listen:${questionKey}`} text={speechText(question)} t={t} />
                    </div>
                ) : null}

                <p className="hidden text-center text-xs text-default-400 md:block">{t.practice_keyboard_hint}</p>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-background/95 backdrop-blur-md pb-safe">
                <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-3 sm:px-6">
                    {graded ? (
                        <Button
                            color="primary"
                            size="lg"
                            onPress={goNext}
                            className="h-12 flex-1 font-semibold"
                            endContent={<ArrowRightIcon size={18} aria-hidden="true" />}
                        >
                            {isLast ? t.practice_finish : t.next}
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="flat"
                                size="lg"
                                onPress={skip}
                                className={clsx("h-12 font-semibold", prefs.confirmAnswers ? "px-5" : "flex-1")}
                                startContent={<SkipIcon size={18} aria-hidden="true" />}
                            >
                                {t.skip}
                            </Button>
                            {prefs.confirmAnswers ? (
                                <Button
                                    color="primary"
                                    size="lg"
                                    isDisabled={!session.selected}
                                    onPress={check}
                                    className="h-12 flex-1 font-semibold"
                                >
                                    {t.practice_check}
                                </Button>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
