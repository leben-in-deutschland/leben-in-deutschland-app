"use client";

import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { AppLink } from "@/components/ui/app-link";
import { CheckIcon, ChevronRightIcon, CoffeeIcon, FlameIcon, SnowflakeIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { SectionHeading, Surface } from "@/components/ui/surface";
import { parseDayKey } from "@/utils/date-utils";
import { fmt, formatDate, plural, type Translations } from "@/utils/i18n";
import type { DayStatus, GoalProgress, StreakInfo, WeekDay } from "@/utils/streak-logic";

type WeekStripProps = {
    days: WeekDay[];
    streak: StreakInfo;
    goal: GoalProgress;
    /** Today is one of the learner's rest days. */
    restToday: boolean;
    language: "de" | "en";
    t: Translations;
    className?: string;
    style?: CSSProperties;
};

const STATUS_KEY: Record<DayStatus, string> = {
    done: "pass_goal_met",
    partial: "home_day_partial",
    frozen: "home_day_frozen",
    rest: "home_day_rest",
    missed: "home_day_missed",
    today: "pass_today",
    future: "home_day_future",
    none: "home_day_none",
};

const PILL_CLASS: Record<DayStatus, string> = {
    done: "bg-primary text-primary-foreground",
    partial: "bg-primary-100 text-primary-700",
    frozen: "bg-secondary-100 text-secondary-700",
    rest: "bg-default-100 text-default-400",
    missed: "border-2 border-dashed border-default-300 text-default-400",
    today: "bg-content2 font-semibold text-foreground",
    future: "bg-content2 text-default-400",
    none: "bg-content2 text-default-300",
};

function DayPill({ day, language, t }: { day: WeekDay; language: "de" | "en"; t: Translations }) {
    const date = parseDayKey(day.day);
    const shortLabel = formatDate(date, language, { weekday: "short" }).replace(/\.$/, "");
    const longLabel = formatDate(date, language, { weekday: "long", day: "numeric", month: "long" });
    const status = t[STATUS_KEY[day.status]];
    const dayNumber = date.getDate();

    let content: ReactNode;
    switch (day.status) {
        case "done":
            content = <CheckIcon size={16} strokeWidth={2.5} />;
            break;
        case "frozen":
            content = <SnowflakeIcon size={16} />;
            break;
        case "rest":
            content = <CoffeeIcon size={16} />;
            break;
        case "partial":
            content = <span className="text-xs font-semibold tabular">{day.answered}</span>;
            break;
        case "today":
            content = <span className="text-xs tabular">{day.answered > 0 ? day.answered : dayNumber}</span>;
            break;
        default:
            content = <span className="text-xs tabular">{dayNumber}</span>;
    }

    return (
        <li className="flex min-w-0 flex-col items-center gap-1.5" title={status}>
            <span className="sr-only">{`${longLabel}: ${status}`}</span>
            <span className={clsx("text-[11px] font-medium uppercase tracking-wide", day.isToday ? "text-primary" : "text-default-500")} aria-hidden="true">
                {shortLabel}
            </span>
            <span
                className={clsx(
                    "grid h-9 w-9 place-items-center rounded-full",
                    PILL_CLASS[day.status],
                    day.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-content1",
                )}
                aria-hidden="true"
            >
                {content}
            </span>
        </li>
    );
}

/** Seven day pills, the streak, and today's goal. */
export function WeekStrip({ days, streak, goal, restToday, language, t, className, style }: WeekStripProps) {
    const hint = streak.atRisk ? t.home_week_at_risk : restToday && !streak.todayDone ? t.home_week_rest_today : null;

    return (
        <Surface as="section" aria-labelledby="home-week-title" className={className} style={style}>
            <SectionHeading
                id="home-week-title"
                title={t.home_week_title}
                action={
                    <AppLink href="/progress#streak" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary">
                        {t.common_see_all}
                        <ChevronRightIcon size={16} aria-hidden="true" />
                    </AppLink>
                }
            />

            <ol className="mt-4 grid grid-cols-7 gap-1" aria-label={t.home_week_aria}>
                {days.map((day) => (
                    <DayPill key={day.day} day={day} language={language} t={t} />
                ))}
            </ol>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <FlameIcon size={16} className={clsx(streak.current > 0 ? "text-primary" : "text-default-400", streak.atRisk && "motion-safe:animate-pulse")} aria-hidden="true" />
                    <span className="tabular">{plural(t, "home_week_streak", streak.current)}</span>
                </span>
                {streak.freezes > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-default-500">
                        <SnowflakeIcon size={16} className="text-secondary-600" aria-hidden="true" />
                        <span className="tabular">{plural(t, "home_week_freezes", streak.freezes)}</span>
                    </span>
                ) : null}
            </div>
            {hint ? <p className={clsx("mt-1 text-sm", streak.atRisk ? "text-warning-600" : "text-default-500")}>{hint}</p> : null}

            <div className="mt-4 border-t border-divider pt-4">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{t.home_goal_label}</span>
                    <span className="tabular text-default-500">{fmt(t.home_goal_progress, { answered: goal.answered, goal: goal.goal })}</span>
                </div>
                <ProgressBar
                    value={goal.ratio}
                    label={t.home_goal_label}
                    className="mt-2"
                    indicatorClassName={goal.met ? "bg-success" : "bg-primary"}
                />
                <p className={clsx("mt-1.5 text-xs", goal.met ? "font-medium text-success-600" : "text-default-500")}>
                    {goal.met ? t.pass_goal_met : plural(t, "home_goal_remaining", goal.remaining)}
                </p>
            </div>
        </Surface>
    );
}
