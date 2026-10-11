"use client";

import { Button } from "@heroui/react";
import clsx from "clsx";
import { AppLink } from "@/components/ui/app-link";
import { InlineNotice } from "@/components/ui/feedback";
import { HomeIcon, RotateCcwIcon } from "@/components/ui/icons";
import { ProgressRing } from "@/components/ui/progress";
import { SectionHeading, Surface } from "@/components/ui/surface";
import { fmt, type Translations } from "@/utils/i18n";
import type { AnswerOption } from "@/utils/question-bank";
import type { GoalProgress } from "@/utils/streak-logic";
import type { SessionSummary } from "./session-logic";

type SessionSummaryProps = {
    summary: SessionSummary;
    goal: GoalProgress;
    onRetry: () => void;
    t: Translations;
};

function ringColor(accuracy: number | null): string {
    if (accuracy === null) {
        return "text-default-300";
    }
    if (accuracy >= 70) {
        return "text-success";
    }
    return accuracy >= 40 ? "text-warning" : "text-danger";
}

/** End of a session: the score, the mistakes to look at again, and where to go next. */
export function SessionSummaryScreen({ summary, goal, onRetry, t }: SessionSummaryProps) {
    const stats: { label: string; value: number; className?: string }[] = [
        { label: t.practice_summary_answered, value: summary.answered },
        { label: t.common_correct, value: summary.correct, className: "text-success-700" },
        { label: t.common_wrong, value: summary.wrong, className: "text-danger-700" },
        { label: t.common_skipped, value: summary.skipped, className: "text-default-600" },
    ];
    const hasMistakes = summary.wrongQuestions.length > 0;

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-8 sm:py-12">
            <div className="flex flex-col items-center gap-3 text-center animate-pop-in">
                <ProgressRing
                    value={(summary.accuracy ?? 0) / 100}
                    size={120}
                    strokeWidth={9}
                    indicatorClassName={ringColor(summary.accuracy)}
                    label={`${t.practice_summary_accuracy}: ${summary.accuracy ?? 0}%`}
                >
                    <span className="font-display text-3xl font-bold tabular text-foreground">
                        {summary.accuracy === null ? "–" : `${summary.accuracy}%`}
                    </span>
                </ProgressRing>
                <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t.practice_summary_title}</h1>
                    <p className="mt-1 text-sm text-default-500">{t.practice_summary_accuracy}</p>
                </div>
            </div>

            {goal.met ? (
                <InlineNotice tone="success" title={t.pass_goal_met} className="animate-rise-in">
                    {fmt(t.practice_summary_goal_met, { answered: goal.answered, goal: goal.goal })}
                </InlineNotice>
            ) : null}

            <Surface as="dl" padding="sm" className="grid grid-cols-4 gap-2 text-center animate-rise-in">
                {stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col-reverse gap-0.5">
                        <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-default-500">{stat.label}</dt>
                        <dd className={clsx("font-display text-2xl font-bold tabular", stat.className ?? "text-foreground")}>{stat.value}</dd>
                    </div>
                ))}
            </Surface>

            <Surface as="section" aria-labelledby="summary-mistakes-title" className="flex flex-col gap-3 animate-rise-in">
                <SectionHeading id="summary-mistakes-title" title={t.practice_summary_mistakes_title} as="h2" />
                {hasMistakes ? (
                    <ul className="divide-y divide-divider">
                        {summary.wrongQuestions.map((question) => {
                            const solution = question.solution as AnswerOption;
                            return (
                                <li key={question.num} className="flex gap-3 py-3">
                                    <span className="w-9 shrink-0 pt-0.5 text-xs font-semibold tabular text-default-500">{question.num}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium leading-snug text-foreground" lang="de">
                                            {question.question}
                                        </p>
                                        <p className="mt-1 text-sm leading-snug text-success-700" lang="de">
                                            <span className="font-semibold">{solution.toUpperCase()}.</span> {question[solution]}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="text-sm text-default-500">{t.practice_summary_no_mistakes}</p>
                )}
            </Surface>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {hasMistakes ? (
                    <Button
                        color="primary"
                        size="lg"
                        onPress={onRetry}
                        className="h-12 font-semibold sm:flex-1"
                        startContent={<RotateCcwIcon size={18} aria-hidden="true" />}
                    >
                        {t.practice_summary_retry}
                    </Button>
                ) : null}
                <Button
                    as={AppLink}
                    href="/practice"
                    color={hasMistakes ? "default" : "primary"}
                    variant={hasMistakes ? "flat" : "solid"}
                    size="lg"
                    className="h-12 font-semibold sm:flex-1"
                >
                    {t.practice_back_to_practice}
                </Button>
                <Button
                    as={AppLink}
                    href="/dashboard"
                    variant="light"
                    size="lg"
                    className="h-12 font-semibold"
                    startContent={<HomeIcon size={18} aria-hidden="true" />}
                >
                    {t.nav_home}
                </Button>
            </div>
        </div>
    );
}
