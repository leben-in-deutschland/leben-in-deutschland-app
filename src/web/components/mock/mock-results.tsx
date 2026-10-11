"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Accordion, AccordionItem, Button, Chip } from "@heroui/react";
import type { MockTestProgress } from "@/types/user";
import { hapticError, hapticSuccess } from "@/services/haptics";
import { fmt, formatClock, formatDate, type Translations } from "@/utils/i18n";
import { mockScore } from "@/utils/practice-logic";
import { ANSWER_OPTIONS } from "@/utils/question-bank";
import { passMarkOf } from "@/utils/user-defaults";
import { AnswerOption } from "@/components/question/answer-option";
import { AppLink } from "@/components/ui/app-link";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { InlineNotice } from "@/components/ui/feedback";
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    ClockIcon,
    FlagIcon,
    HomeIcon,
    MinusIcon,
    RotateCcwIcon,
    TargetIcon,
    TrendingUpIcon,
    XCircleIcon,
} from "@/components/ui/icons";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { PageHeader, SectionHeading, Surface } from "@/components/ui/surface";
import {
    answerStates,
    durationOf,
    examTypeOf,
    filterReviewEntries,
    resultStatus,
    reviewCounts,
    REVIEW_FILTERS,
    scoreRatio,
    topicBreakdown,
    wasTimed,
    type ResultStatus,
    type ReviewEntry,
    type ReviewFilter,
} from "./exam-logic";

type MockResultsProps = {
    test: MockTestProgress;
    entries: ReviewEntry[];
    /** "fresh" right after an exam, "review" for a stored exam opened from history. */
    mode: "fresh" | "review";
    /** The clock ran out and the exam was submitted automatically. */
    timedOut?: boolean;
    haptics?: boolean;
    onNewExam?: () => void;
    t: Translations;
    language: string;
};

const HERO_STYLES: Record<ResultStatus, { surface: string; ring: string; track: string; chip: "success" | "danger" | "default" }> = {
    passed: { surface: "border-success-200 bg-success-50", ring: "text-success", track: "text-success-200", chip: "success" },
    failed: { surface: "border-danger-200 bg-danger-50", ring: "text-danger", track: "text-danger-200", chip: "danger" },
    cancelled: { surface: "border-divider bg-content2", ring: "text-default-500", track: "text-default-200", chip: "default" },
};

function barTone(ratio: number): string {
    if (ratio >= 0.75) {
        return "bg-success";
    }
    return ratio >= 0.5 ? "bg-warning" : "bg-danger";
}

function letterOf(option: string | null | undefined): string {
    return option ? option.toUpperCase() : "–";
}

function StatTile({ value, label, className }: { value: number; label: string; className: string }) {
    return (
        <Surface tone="sunken" padding="sm" className="flex flex-col items-center gap-0.5 text-center">
            <span className={clsx("font-display text-2xl font-bold tabular", className)}>{value}</span>
            <span className="text-xs font-medium text-default-500">{label}</span>
        </Surface>
    );
}

function EntryIcon({ entry }: { entry: ReviewEntry }) {
    if (!entry.answered) {
        return (
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-default-100 text-default-500">
                <MinusIcon size={16} />
            </span>
        );
    }
    return entry.correct ? (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700">
            <CheckCircleIcon size={18} />
        </span>
    ) : (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-100 text-danger-700">
            <XCircleIcon size={18} />
        </span>
    );
}

function EntryAnswers({ entry, t }: { entry: ReviewEntry; t: Translations }) {
    const question = entry.question;
    if (!question) {
        return <p className="pb-2 text-sm text-default-500">{t.exam_question_missing}</p>;
    }
    const states = answerStates(entry);
    const hasImage = Boolean(question.image) && question.image !== "-";
    return (
        <div className="flex flex-col gap-3 pb-2">
            {hasImage ? (
                // Images come from the question source and are not bundled.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={question.image}
                    alt={t.question_image_alt ?? ""}
                    loading="lazy"
                    className="max-h-72 w-auto self-start rounded-2xl bg-white object-contain p-1 shadow-card ring-1 ring-foreground/[0.06]"
                />
            ) : null}
            <div className="flex flex-col gap-2">
                {ANSWER_OPTIONS.map((letter) => {
                    const state = states[letter];
                    const srStatus = state === "correct" || state === "reveal" ? t.answer_correct_sr : state === "wrong" ? t.answer_wrong_sr : undefined;
                    return (
                        <AnswerOption key={letter} letter={letter} state={state} disabled srStatus={srStatus}>
                            {question[letter]}
                        </AnswerOption>
                    );
                })}
            </div>
        </div>
    );
}

/** Result of a mock exam: verdict, score, topics, and every answer next to the solution. */
export function MockResults({ test, entries, mode, timedOut = false, haptics = false, onNewExam, t, language }: MockResultsProps) {
    const [filter, setFilter] = useState<ReviewFilter>("all");
    const status = resultStatus(test);
    const score = mockScore(test);
    const passMark = passMarkOf(test);
    const styles = HERO_STYLES[status];
    const counts = reviewCounts(entries);
    const visible = filterReviewEntries(entries, filter);
    const topics = topicBreakdown(entries);
    const missingNums = entries.filter((entry) => !entry.question).map((entry) => entry.num);
    const titleKey = `exam_result_${status}_title` as const;
    const descKey = `exam_result_${status}_desc` as const;
    const statusLabel = status === "passed" ? t.passed : status === "failed" ? t.failed : t.cancelled;
    // Review mode already has a page title above the hero.
    const HeroHeading = mode === "review" ? "h2" : "h1";

    useEffect(() => {
        if (mode !== "fresh") {
            return;
        }
        if (status === "passed") {
            void hapticSuccess(haptics);
        } else if (status === "failed") {
            void hapticError(haptics);
        }
    }, [mode, status, haptics]);

    const filterLabels: Record<ReviewFilter, string> = {
        all: t.exam_filter_all,
        wrong: t.common_wrong,
        unanswered: t.common_unanswered,
        flagged: t.common_flagged,
    };

    return (
        <div className="flex flex-col gap-6 animate-rise-in">
            {mode === "review" ? (
                <PageHeader
                    title={t.exam_review_heading}
                    description={formatDate(test.datetime, language, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    leading={
                        <AppLink href="/mock" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            <ArrowLeftIcon size={16} />
                            {t.common_back}
                        </AppLink>
                    }
                    actions={
                        <Button as={AppLink} href="/progress" variant="flat" startContent={<TrendingUpIcon size={18} />} className="h-11 font-medium">
                            {t.nav_progress}
                        </Button>
                    }
                />
            ) : null}

            {timedOut ? (
                <InlineNotice tone="warning" title={t.exam_time_up_title}>
                    {t.exam_time_up_desc}
                </InlineNotice>
            ) : null}

            <Surface as="section" padding="lg" className={clsx("animate-pop-in", styles.surface)} aria-labelledby="exam-result-title">
                <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-7 sm:text-left">
                    <ProgressRing
                        value={scoreRatio(test)}
                        size={136}
                        strokeWidth={11}
                        indicatorClassName={styles.ring}
                        trackClassName={styles.track}
                        label={fmt(t.exam_result_score_aria, { correct: score.correct, total: score.total })}
                    >
                        <span className="flex flex-col items-center leading-none">
                            <span className="font-display text-4xl font-bold tabular text-foreground">{score.correct}</span>
                            <span className="mt-1 text-sm font-medium tabular text-default-500">/ {score.total}</span>
                        </span>
                    </ProgressRing>
                    <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
                        <Chip color={styles.chip} variant="solid" size="sm" className="font-semibold uppercase tracking-wide">
                            {statusLabel}
                        </Chip>
                        <HeroHeading id="exam-result-title" className="font-display text-3xl font-bold text-foreground">
                            {t[titleKey]}
                        </HeroHeading>
                        <p className="text-default-600">{t[descKey]}</p>
                        <p className="text-sm font-medium text-default-600">{fmt(t.exam_result_pass_mark, { count: passMark, total: score.total })}</p>
                        <ul className="mt-1 flex flex-wrap justify-center gap-2 sm:justify-start">
                            <li>
                                <Chip size="sm" variant="flat" startContent={<TargetIcon size={14} />} className="gap-1 pl-1.5">
                                    {t[`exam_type_${examTypeOf(test)}`] ?? examTypeOf(test)}
                                </Chip>
                            </li>
                            <li>
                                <Chip size="sm" variant="flat" startContent={<ClockIcon size={14} />} className="gap-1 pl-1.5 tabular">
                                    <span className="sr-only">{t.exam_result_time_label}: </span>
                                    {formatClock(durationOf(test))}
                                </Chip>
                            </li>
                            {!wasTimed(test) ? (
                                <li>
                                    <Chip size="sm" variant="flat">
                                        {t.exam_timer_off}
                                    </Chip>
                                </li>
                            ) : null}
                            {mode === "fresh" ? (
                                <li>
                                    <Chip size="sm" variant="flat">
                                        {formatDate(test.datetime, language)}
                                    </Chip>
                                </li>
                            ) : null}
                        </ul>
                    </div>
                </div>
            </Surface>

            <div className="grid grid-cols-3 gap-3">
                <StatTile value={score.correct} label={t.common_correct} className="text-success-700" />
                <StatTile value={score.wrong} label={t.common_wrong} className="text-danger-700" />
                <StatTile value={score.unanswered} label={t.common_unanswered} className="text-default-600" />
            </div>

            <div className="flex flex-wrap gap-3">
                {mode === "fresh" ? (
                    <Button color="primary" size="lg" className="h-12 flex-1 basis-40 font-semibold" startContent={<RotateCcwIcon size={18} />} onPress={onNewExam}>
                        {t.exam_new}
                    </Button>
                ) : (
                    <Button as={AppLink} href="/mock" color="primary" size="lg" className="h-12 flex-1 basis-40 font-semibold" startContent={<RotateCcwIcon size={18} />}>
                        {t.exam_new}
                    </Button>
                )}
                {score.wrong + score.unanswered > 0 ? (
                    <Button as={AppLink} href="/prepare?action=incorrect" variant="flat" color="primary" size="lg" className="h-12 flex-1 basis-40 font-semibold">
                        {t.exam_practice_mistakes}
                    </Button>
                ) : null}
                <Button as={AppLink} href="/dashboard" variant="light" size="lg" className="h-12 flex-1 basis-32 font-medium" startContent={<HomeIcon size={18} />}>
                    {t.nav_home}
                </Button>
            </div>

            {topics.length > 0 ? (
                <Surface padding="lg" as="section" aria-labelledby="exam-topics-heading" className="flex flex-col gap-4">
                    <SectionHeading id="exam-topics-heading" title={t.exam_topics_title} description={t.exam_topics_desc} />
                    <ul className="flex flex-col gap-3">
                        {topics.map((stat) => {
                            const name = t[stat.category] ?? stat.category;
                            const ratio = stat.total > 0 ? stat.correct / stat.total : 0;
                            return (
                                <li key={stat.category} className="flex flex-col gap-1.5">
                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="font-medium text-foreground">{name}</span>
                                        <span className="shrink-0 tabular text-default-500">
                                            {stat.correct} / {stat.total}
                                        </span>
                                    </div>
                                    <ProgressBar value={ratio} size="sm" indicatorClassName={barTone(ratio)} label={`${name}: ${stat.correct} / ${stat.total}`} />
                                </li>
                            );
                        })}
                    </ul>
                </Surface>
            ) : null}

            <section className="flex flex-col gap-4" aria-labelledby="exam-review-heading">
                <SectionHeading id="exam-review-heading" title={t.exam_review_title} description={t.exam_review_desc} />
                <ChoiceChips<ReviewFilter>
                    label={t.exam_filter_aria}
                    size="sm"
                    value={filter}
                    onChange={setFilter}
                    options={REVIEW_FILTERS.map((key) => ({
                        value: key,
                        label: `${filterLabels[key]} · ${counts[key]}`,
                        disabled: key !== "all" && counts[key] === 0,
                    }))}
                />
                {visible.length === 0 ? (
                    <Surface tone="sunken" padding="md" className="text-center text-sm text-default-500">
                        {t.exam_review_empty}
                    </Surface>
                ) : (
                    <Accordion
                        variant="splitted"
                        selectionMode="multiple"
                        disabledKeys={missingNums}
                        className="px-0"
                        itemClasses={{
                            base: "px-4 shadow-card bg-content1 rounded-card ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]",
                            trigger: "py-3.5 gap-3 items-start",
                            startContent: "mt-0.5",
                            titleWrapper: "min-w-0",
                            title: "text-base font-medium text-foreground line-clamp-3",
                            subtitle: "text-xs text-default-500 mt-1",
                            indicator: "mt-1.5 text-default-400",
                            content: "pt-0 pb-2",
                        }}
                    >
                        {visible.map((entry) => {
                            const question = entry.question;
                            const solution = letterOf(question?.solution);
                            const subtitle = entry.answered
                                ? fmt(t.exam_review_answer_line, { answer: letterOf(entry.selected), solution })
                                : fmt(t.exam_review_unanswered_line, { solution });
                            return (
                                <AccordionItem
                                    key={entry.num}
                                    aria-label={`${t.question_number_label} ${entry.num}`}
                                    startContent={<EntryIcon entry={entry} />}
                                    title={
                                        <span lang="de" className="block">
                                            <span className="mr-1.5 text-xs font-semibold tabular text-default-400">{entry.num}</span>
                                            {question ? question.question : t.exam_question_missing}
                                        </span>
                                    }
                                    subtitle={
                                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                                            {question ? <span>{subtitle}</span> : null}
                                            {entry.flagged ? (
                                                <span className="inline-flex items-center gap-1 text-warning-700">
                                                    <FlagIcon size={12} fill="currentColor" />
                                                    {t.common_flagged}
                                                </span>
                                            ) : null}
                                        </span>
                                    }
                                >
                                    <EntryAnswers entry={entry} t={t} />
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                )}
            </section>
        </div>
    );
}
