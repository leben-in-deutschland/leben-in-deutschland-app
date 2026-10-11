"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { PassCard, type PassCardData } from "@/components/pass/pass-card";
import { refreshQuestions } from "@/services/questions";
import type { User } from "@/types/user";
import { dayKey } from "@/utils/date-utils";
import { fmt } from "@/utils/i18n";
import { computeReadiness } from "@/utils/readiness-logic";
import { computeStreak, goalProgress, isRestDay, weekView } from "@/utils/streak-logic";
import { modeCounts, suggestNextAction } from "@/utils/study-modes";
import { prefsOf } from "@/utils/user-defaults";
import { updateUser, useAppLanguage, useTranslations } from "@/utils/user-store";
import { ContinueAction, QuickActions } from "./continue-action";
import { EvaluationStatus } from "./evaluation-status";
import { ExamCountdownCard } from "./exam-countdown";
import { examCountdown, greetingKey, needsFirstOpenStamp, shouldCelebrateGoal } from "./home-logic";
import { ModeGrid } from "./mode-grid";
import { MockSummary } from "./mock-summary";
import { NoticeList } from "./notice-card";
import { ThanksDialog } from "@/components/support/thanks-dialog";
import { useEvaluation } from "./use-evaluation";
import { useNotices } from "./use-notices";
import { WeekStrip } from "./week-strip";

const CELEBRATED_KEY = "lid:home-goal-celebrated";

function readCelebrated(): string | null {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        return window.sessionStorage.getItem(CELEBRATED_KEY);
    } catch {
        return null;
    }
}

function writeCelebrated(day: string): void {
    try {
        window.sessionStorage.setItem(CELEBRATED_KEY, day);
    } catch {
        /* private mode or storage disabled: the sweep simply replays next time */
    }
}

/** Delay of the n-th block so the page settles from top to bottom. */
function rise(index: number): CSSProperties {
    return { animationDelay: `${index * 50}ms` };
}

/** The signed-in start page: the learner's pass, what to do next, and the week so far. */
export function HomeScreen({ user }: { user: User }) {
    const t = useTranslations();
    const language = useAppLanguage();
    const evaluation = useEvaluation();
    const { notices, dismiss } = useNotices();
    // A newer catalogue applies at the next catalogue load, never mid-session.
    useEffect(() => {
        void refreshQuestions();
    }, []);
    const today = dayKey();

    const prefs = prefsOf(user);
    const readiness = computeReadiness(user);
    const streak = computeStreak(user, today);
    const goal = goalProgress(user, today);
    const days = weekView(user, today);
    const counts = modeCounts(user, today);
    const action = suggestNextAction(user, today);
    const countdown = examCountdown(today, user.examDate);

    // Read once per mount; the sweep must not replay on every store update.
    const [celebratedBefore] = useState(readCelebrated);
    const celebrate = shouldCelebrateGoal(goal.met, today, celebratedBefore);
    useEffect(() => {
        if (celebrate) {
            writeCelebrated(today);
        }
    }, [celebrate, today]);

    // Records that never stored a first-open time get one now, like version 2.0 did,
    // so the in-app review prompt keeps its waiting period.
    const firstOpenMissing = needsFirstOpenStamp(user.appFirstTimeOpenDateTime);
    useEffect(() => {
        if (firstOpenMissing) {
            updateUser((draft) => {
                draft.appFirstTimeOpenDateTime = new Date();
            });
        }
    }, [firstOpenMissing]);

    const greeting = t[greetingKey(new Date().getHours())];
    const name = user.nickname?.trim();
    const passData: PassCardData = {
        greeting: name ? fmt(t.greet_named, { greeting, name }) : greeting,
        stateName: user.state.stateName,
        readiness: readiness.score,
        readinessLabel: t[`readiness_${readiness.status}`],
        known: readiness.known,
        total: readiness.total,
        streak: streak.current,
        streakAtRisk: streak.atRisk,
        freezes: streak.freezes,
        answeredToday: goal.answered,
        goal: goal.goal,
    };

    const clearExamDate = () => {
        updateUser((draft) => {
            draft.examDate = null;
        });
    };

    return (
        <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
            <NoticeList notices={notices} onDismiss={dismiss} t={t} className="animate-rise-in lg:col-span-12" />
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
                <PassCard data={passData} t={t} celebrate={celebrate} headingLevel="h1" className="animate-rise-in">
                    <ContinueAction action={action} t={t} />
                </PassCard>
                <div className="animate-rise-in" style={rise(1)}>
                    <QuickActions t={t} />
                </div>
                <ThanksDialog user={user} streakCurrent={streak.current} t={t} />
                <WeekStrip
                    days={days}
                    streak={streak}
                    goal={goal}
                    restToday={isRestDay(today, prefs)}
                    language={language}
                    t={t}
                    className="animate-rise-in"
                    style={rise(2)}
                />
                <ModeGrid counts={counts} t={t} className="animate-rise-in" style={rise(3)} />
            </div>
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
                <MockSummary tests={user.testProgress} language={language} t={t} className="animate-rise-in" style={rise(4)} />
                <ExamCountdownCard countdown={countdown} language={language} t={t} onClear={clearExamDate} className="animate-rise-in" style={rise(5)} />
                <EvaluationStatus data={evaluation} language={language} t={t} className="animate-rise-in" style={rise(6)} />
            </div>
        </div>
    );
}
