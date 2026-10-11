"use client";

import { Suspense, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import type { Question } from "@/types/question";
import type { ExamType, MockTestProgress } from "@/types/user";
import { useFocusMode } from "@/components/shell/focus-mode";
import { useBackButton } from "@/components/shell/use-back-button";
import { AppLink, useAppNavigate } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/feedback";
import { ClipboardCheckIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/surface";
import { MockExam, type ExamFinishPayload } from "@/components/mock/mock-exam";
import { buildExamQuestions, buildReviewEntries, findExam } from "@/components/mock/exam-logic";
import { MockIntro } from "@/components/mock/mock-intro";
import { MockResults } from "@/components/mock/mock-results";
import { applyMockToUser, gradeMock } from "@/utils/practice-logic";
import { passMarkFor, prefsOf } from "@/utils/user-defaults";
import { updateUser, useAppLanguage, useIsNative, useTranslations, useUser } from "@/utils/user-store";

interface ExamSession {
    questions: Question[];
    startedAt: Date;
    examType: ExamType;
    timed: boolean;
}

interface ExamOutcome {
    test: MockTestProgress;
    questions: Question[];
    timedOut: boolean;
}

function MockScreen() {
    const user = useUser();
    const t = useTranslations();
    const language = useAppLanguage();
    const isNative = useIsNative();
    const searchParams = useSearchParams();
    const reviewKey = searchParams.get("review");
    const [session, setSession] = useState<ExamSession | null>(null);
    const [outcome, setOutcome] = useState<ExamOutcome | null>(null);
    const navigate = useAppNavigate();
    useFocusMode(session !== null);
    // Android back: fresh results return to the intro, a review returns to the exam hub.
    useBackButton(() => setOutcome(null), session === null && !reviewKey && outcome !== null);
    useBackButton(() => navigate("/mock"), session === null && reviewKey !== null);

    if (!user) {
        return null;
    }
    const prefs = prefsOf(user);

    const startExam = ({ examType, timed }: { examType: ExamType; timed: boolean }) => {
        const questions = buildExamQuestions(user.state.stateCode);
        if (questions.length === 0) {
            return;
        }
        setOutcome(null);
        setSession({ questions, startedAt: new Date(), examType, timed });
    };

    const finishExam = (current: ExamSession, { answers, flagged, reason }: ExamFinishPayload) => {
        const finishedAt = new Date();
        const graded = gradeMock(current.questions, answers, flagged, {
            passMark: passMarkFor(current.examType),
            examType: current.examType,
            timed: current.timed,
            startedAt: current.startedAt,
            finishedAt,
            cancelled: reason === "cancelled",
        });
        updateUser((draft) => applyMockToUser(draft, graded, finishedAt));
        setSession(null);
        setOutcome({ test: graded, questions: current.questions, timedOut: reason === "timeout" });
    };

    if (session) {
        return (
            <MockExam
                key={session.startedAt.toISOString()}
                questions={session.questions}
                startedAt={session.startedAt}
                timed={session.timed}
                prefs={prefs}
                isNative={isNative}
                t={t}
                onFinish={(payload) => finishExam(session, payload)}
            />
        );
    }

    if (reviewKey) {
        const test = findExam(user, reviewKey);
        if (!test) {
            return (
                <div className="flex flex-col gap-6 animate-rise-in">
                    <PageHeader title={t.exam_review_heading} />
                    <EmptyState
                        icon={ClipboardCheckIcon}
                        title={t.exam_review_not_found_title}
                        description={t.exam_review_not_found_desc}
                        action={
                            <Button as={AppLink} href="/mock" color="primary" className="h-11 font-semibold">
                                {t.exam_title}
                            </Button>
                        }
                    />
                </div>
            );
        }
        return <MockResults key={test.datetime} test={test} entries={buildReviewEntries(test)} mode="review" t={t} language={language} />;
    }

    if (outcome) {
        const lookup = new Map(outcome.questions.map((question) => [question.num, question]));
        return (
            <MockResults
                key={outcome.test.datetime}
                test={outcome.test}
                entries={buildReviewEntries(outcome.test, (num) => lookup.get(num))}
                mode="fresh"
                timedOut={outcome.timedOut}
                haptics={prefs.haptics}
                onNewExam={() => setOutcome(null)}
                t={t}
                language={language}
            />
        );
    }

    return <MockIntro user={user} t={t} language={language} onStart={startExam} />;
}

export default function MockPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[50vh] items-center justify-center">
                    <Spinner size="lg" />
                </div>
            }
        >
            <MockScreen />
        </Suspense>
    );
}
