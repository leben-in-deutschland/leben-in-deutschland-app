"use client";

import { useMemo } from "react";
import { IconBadge, type Accent } from "@/components/ui/icon-badge";
import { ArrowRightIcon, type IconComponent, BookOpenIcon, ClipboardCheckIcon, LayersIcon, TargetIcon } from "@/components/ui/icons";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { User } from "@/types/user";
import { fmt, plural } from "@/utils/i18n";
import { computeReadiness, type ReadinessStatus } from "@/utils/readiness-logic";
import { modeHref, suggestNextAction } from "@/utils/study-modes";
import { passMarkFor, prefsOf } from "@/utils/user-defaults";
import { useTranslations } from "@/utils/user-store";
import { LinkButton } from "./link-button";

const STATUS_LABEL: Record<ReadinessStatus, string> = {
    start: "readiness_start",
    building: "readiness_building",
    close: "readiness_close",
    ready: "readiness_ready",
};

const STATUS_HINT: Record<ReadinessStatus, string> = {
    start: "progress_status_hint_start",
    building: "progress_status_hint_building",
    close: "progress_status_hint_close",
    ready: "progress_status_hint_ready",
};

const STATUS_ACCENT: Record<ReadinessStatus, Accent> = {
    start: "default",
    building: "warning",
    close: "primary",
    ready: "success",
};

const RING_CLASS: Record<ReadinessStatus, string> = {
    start: "text-default-400",
    building: "text-warning",
    close: "text-primary",
    ready: "text-success",
};

const EXAM_QUESTIONS = 33;

type MetricProps = {
    icon: IconComponent;
    accent: Accent;
    label: string;
    value: string;
    description: string;
    ratio: number | null;
};

function Metric({ icon, accent, label, value, description, ratio }: MetricProps) {
    return (
        <li className="flex gap-3">
            <IconBadge icon={icon} accent={accent} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="shrink-0 font-display text-base font-semibold tabular text-foreground">{value}</p>
                </div>
                {ratio !== null ? (
                    <ProgressBar value={ratio} size="sm" label={`${label}: ${value}`} className="mt-1.5" />
                ) : null}
                <p className="mt-1 text-xs leading-relaxed text-default-500">{description}</p>
            </div>
        </li>
    );
}

type ReadinessSectionProps = {
    user: User;
    today: string;
};

/** How ready the learner is for the exam, and what goes into that number. */
export function ReadinessSection({ user, today }: ReadinessSectionProps) {
    const t = useTranslations();
    const prefs = prefsOf(user);
    const passMark = passMarkFor(prefs.examType);
    const readiness = useMemo(() => computeReadiness(user), [user]);
    const next = useMemo(() => suggestNextAction(user, today), [user, today]);
    const examName = prefs.examType === "lid" ? t.exam_type_lid : t.exam_type_einbuergerung;
    const percent = (value: number) => `${Math.round(value * 100)}%`;
    const nextHref = next.kind === "mock" ? "/mock" : modeHref(next.mode);
    const nextLabel = next.kind === "mock" ? t.progress_next_mock : t[`mode_${next.mode}_title`] ?? next.mode;

    return (
        <Surface as="section" className="animate-rise-in" aria-labelledby="progress-readiness-heading">
            <SectionHeading
                id="progress-readiness-heading"
                title={t.pass_readiness}
                description={fmt(t.progress_readiness_for, { exam: examName, passMark, total: EXAM_QUESTIONS })}
            />
            <div className="mt-5 grid gap-6 lg:grid-cols-[auto_1fr] lg:gap-10">
                <div className="flex items-center gap-5 lg:flex-col lg:items-center lg:text-center">
                    <ProgressRing
                        value={readiness.score / 100}
                        size={132}
                        strokeWidth={11}
                        indicatorClassName={RING_CLASS[readiness.status]}
                        label={fmt(t.pass_readiness_aria, { value: readiness.score })}
                    >
                        <div className="text-center">
                            <p className="font-display text-4xl font-bold leading-none tabular text-foreground">{readiness.score}</p>
                            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-default-500">%</p>
                        </div>
                    </ProgressRing>
                    <div className="min-w-0 lg:max-w-[14rem]">
                        <p className="font-display text-lg font-semibold leading-tight text-foreground">{t[STATUS_LABEL[readiness.status]]}</p>
                        <p className="mt-1 text-sm leading-relaxed text-default-500">{t[STATUS_HINT[readiness.status]]}</p>
                    </div>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2">
                    <Metric
                        icon={BookOpenIcon}
                        accent="primary"
                        label={t.progress_mastery_label}
                        value={percent(readiness.mastery)}
                        description={fmt(t.progress_mastery_desc, { known: readiness.known, total: readiness.total })}
                        ratio={readiness.mastery}
                    />
                    <Metric
                        icon={LayersIcon}
                        accent="secondary"
                        label={t.progress_coverage_label}
                        value={percent(readiness.coverage)}
                        description={fmt(t.progress_coverage_desc, { answered: readiness.answered, total: readiness.total })}
                        ratio={readiness.coverage}
                    />
                    <Metric
                        icon={ClipboardCheckIcon}
                        accent={readiness.mockAverage === null ? "default" : "warning"}
                        label={t.progress_mock_avg_label}
                        value={readiness.mockAverage === null ? t.progress_mock_avg_none : percent(readiness.mockAverage)}
                        description={
                            readiness.mockAverage === null ? t.progress_mock_avg_hint : plural(t, "progress_mock_avg_desc", readiness.recentMocks)
                        }
                        ratio={readiness.mockAverage}
                    />
                    <Metric
                        icon={TargetIcon}
                        accent={STATUS_ACCENT[readiness.status]}
                        label={t.progress_pass_chance_label}
                        value={percent(readiness.passChance)}
                        description={fmt(t.progress_pass_chance_desc, { passMark, total: EXAM_QUESTIONS })}
                        ratio={readiness.passChance}
                    />
                </ul>
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-xl bg-content2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-default-500">{t.progress_next_step}</p>
                    <p className="mt-0.5 text-sm text-foreground">
                        {next.kind === "mock" ? t.progress_next_mock_desc : plural(t, "progress_next_mode_desc", next.count, { mode: nextLabel })}
                    </p>
                </div>
                <LinkButton href={nextHref} variant="solid" size="sm" className="sm:shrink-0">
                    {nextLabel}
                    <ArrowRightIcon size={16} />
                </LinkButton>
            </div>
        </Surface>
    );
}
