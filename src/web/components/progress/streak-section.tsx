"use client";

import clsx from "clsx";
import { useMemo, type ReactNode } from "react";
import { FlameIcon, SettingsIcon, SnowflakeIcon, TargetIcon, TrophyIcon, type IconComponent } from "@/components/ui/icons";
import { ProgressRing } from "@/components/ui/progress";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { User } from "@/types/user";
import { fmt, localeFor, plural } from "@/utils/i18n";
import { activityCalendar, computeStreak, goalProgress } from "@/utils/streak-logic";
import { MAX_STREAK_FREEZES, prefsOf } from "@/utils/user-defaults";
import { useAppLanguage, useTranslations } from "@/utils/user-store";
import { ActivityCalendar } from "./activity-calendar";
import { LinkButton } from "./link-button";
import { daysToNextFreeze, STREAK_MILESTONES, weekdayName } from "./progress-stats";

const CALENDAR_DAYS = 84;

type StatProps = {
    icon: IconComponent;
    iconClassName: string;
    label: string;
    value: string;
    detail?: string;
    children?: ReactNode;
};

function Stat({ icon: StatIcon, iconClassName, label, value, detail, children }: StatProps) {
    return (
        <li className="flex items-center gap-3 rounded-xl bg-content2 px-3 py-3">
            {children ?? (
                <span className={clsx("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconClassName)} aria-hidden="true">
                    <StatIcon size={20} />
                </span>
            )}
            <div className="min-w-0">
                <p className="text-xs font-medium text-default-500">{label}</p>
                <p className="font-display text-xl font-semibold leading-tight tabular text-foreground">{value}</p>
                {detail ? <p className="truncate text-xs text-default-500">{detail}</p> : null}
            </div>
        </li>
    );
}

type StreakSectionProps = {
    user: User;
    today: string;
};

/** The learner's streak: numbers, the rule behind it, and the last twelve weeks. */
export function StreakSection({ user, today }: StreakSectionProps) {
    const t = useTranslations();
    const language = useAppLanguage();
    const locale = localeFor(language);
    const prefs = prefsOf(user);
    const streak = useMemo(() => computeStreak(user, today), [user, today]);
    const goal = useMemo(() => goalProgress(user, today), [user, today]);
    const days = useMemo(() => activityCalendar(user, today, CALENDAR_DAYS), [user, today]);
    const restDays = [...prefs.restDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const restDayNames = restDays.map((day) => weekdayName(day, locale)).join(", ");
    const nextFreeze =
        streak.freezes >= MAX_STREAK_FREEZES ? t.progress_streak_freezes_full : plural(t, "progress_streak_next_freeze", daysToNextFreeze(streak.current));

    return (
        <Surface as="section" id="streak" className="scroll-mt-24 animate-rise-in" aria-labelledby="progress-streak-heading">
            <SectionHeading
                id="progress-streak-heading"
                title={t.pass_streak}
                description={prefs.streakRule === "goal" ? fmt(t.progress_streak_rule_goal, { goal: prefs.dailyGoal }) : t.progress_streak_rule_activity}
                action={
                    <LinkButton href="/settings" variant="light" size="sm" aria-label={t.progress_streak_settings}>
                        <SettingsIcon size={16} />
                        <span className="hidden sm:inline">{t.progress_streak_settings}</span>
                    </LinkButton>
                }
            />
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                <Stat
                    icon={FlameIcon}
                    iconClassName="bg-pass-foil/20 text-pass-foil"
                    label={t.progress_streak_current}
                    value={plural(t, "common_days", streak.current)}
                    detail={streak.todayDone ? t.pass_goal_met : streak.atRisk ? t.progress_streak_at_risk : undefined}
                />
                <Stat icon={TrophyIcon} iconClassName="bg-pass-foil/20 text-pass-foil" label={t.progress_streak_best} value={plural(t, "common_days", streak.best)} />
                <Stat
                    icon={SnowflakeIcon}
                    iconClassName="bg-secondary-50 text-secondary-600"
                    label={t.progress_streak_freezes}
                    value={fmt(t.progress_count_of, { count: streak.freezes, total: MAX_STREAK_FREEZES })}
                    detail={nextFreeze}
                />
                <Stat
                    icon={TargetIcon}
                    iconClassName=""
                    label={t.progress_streak_today_goal}
                    value={fmt(t.progress_count_of, { count: goal.answered, total: goal.goal })}
                    detail={goal.met ? t.pass_goal_met : plural(t, "progress_streak_today_remaining", goal.remaining)}
                >
                    <ProgressRing
                        value={goal.ratio}
                        size={40}
                        strokeWidth={5}
                        indicatorClassName={goal.met ? "text-success" : "text-primary"}
                        label={fmt(t.progress_count_of, { count: goal.answered, total: goal.goal })}
                    >
                        <TargetIcon size={16} className={goal.met ? "text-success" : "text-primary"} />
                    </ProgressRing>
                </Stat>
            </ul>
            <p className="mt-3 text-sm text-default-500">
                {restDays.length > 0 ? fmt(t.progress_streak_rest_days, { days: restDayNames }) : t.progress_streak_no_rest_days}
            </p>

            <h3 className="mt-5 text-sm font-semibold text-foreground">{t.progress_calendar_title}</h3>
            <div className="mt-2">
                <ActivityCalendar days={days} today={today} locale={locale} t={t} showPartial={prefs.streakRule === "goal"} />
            </div>

            <h3 className="mt-5 text-sm font-semibold text-foreground">{t.progress_milestones}</h3>
            <p className="mt-0.5 text-xs text-default-500">{t.progress_milestones_hint}</p>
            <ol className="mt-2 flex flex-wrap gap-2" aria-label={t.progress_milestones}>
                {STREAK_MILESTONES.map((milestone) => {
                    const reached = streak.best >= milestone;
                    return (
                        <li
                            key={milestone}
                            className={clsx(
                                "inline-flex h-9 min-w-[3.25rem] items-center justify-center gap-1 rounded-full border px-3 text-sm font-semibold tabular",
                                reached
                                    ? "border-pass-foil bg-pass-foil/15 text-foreground shadow-card"
                                    : "border-dashed border-default-300 text-default-400",
                            )}
                            aria-label={fmt(reached ? t.progress_milestone_reached : t.progress_milestone_open, { count: milestone })}
                        >
                            <FlameIcon size={14} className={reached ? "text-pass-foil" : "text-default-300"} />
                            {milestone}
                        </li>
                    );
                })}
            </ol>
        </Surface>
    );
}
