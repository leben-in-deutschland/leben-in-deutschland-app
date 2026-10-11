import clsx from "clsx";
import type { ReactNode } from "react";
import { fmt, plural, type Translations } from "@/utils/i18n";
import { ProgressRing } from "@/components/ui/progress";
import { FlameIcon, MapPinIcon, SnowflakeIcon, TargetIcon } from "@/components/ui/icons";

export type PassCardData = {
    /** Already translated, e.g. "Guten Abend, Amira". */
    greeting: string;
    stateName: string;
    /** 0 to 100. */
    readiness: number;
    /** Already translated readiness status, e.g. "Almost ready". */
    readinessLabel: string;
    known: number;
    total: number;
    streak: number;
    streakAtRisk: boolean;
    freezes: number;
    answeredToday: number;
    goal: number;
};

type PassCardProps = {
    data: PassCardData;
    t: Translations;
    /** Plays one sweep of light across the cover, e.g. when the daily goal is reached. */
    celebrate?: boolean;
    /** Content under the facts, e.g. the main call to action. */
    children?: ReactNode;
    headingLevel?: "h1" | "h2";
    className?: string;
};

/**
 * The learner's "pass": a passport-cover card with three plain facts, top to
 * bottom: how ready you are, your streak, and today's goal. The cover color
 * and foil line are the only passport touches; there is no decoration that
 * competes with the numbers.
 */
export function PassCard({ data, t, celebrate = false, children, headingLevel: Heading = "h2", className }: PassCardProps) {
    const goalRatio = data.goal > 0 ? Math.min(1, data.answeredToday / data.goal) : 0;
    const goalMet = data.goal > 0 && data.answeredToday >= data.goal;

    return (
        <section
            aria-label={t.pass_aria_label}
            className={clsx("pass-cover relative isolate overflow-hidden rounded-[26px] shadow-pass", celebrate && "pass-sweep", className)}
        >
            <div className="px-5 py-5 sm:px-6 sm:py-6">
                <p className="pass-foil flex items-center gap-1.5 text-sm font-medium">
                    <MapPinIcon size={14} aria-hidden="true" />
                    <span className="truncate">{data.stateName}</span>
                </p>
                <Heading className="mt-0.5 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]">
                    {data.greeting}
                </Heading>

                <div className="pass-foil-rule my-4" />

                <div className="flex items-center gap-4">
                    <ProgressRing
                        value={data.readiness / 100}
                        size={88}
                        strokeWidth={8}
                        trackClassName="text-white/15"
                        indicatorClassName="pass-foil"
                        label={fmt(t.pass_readiness_aria, { value: data.readiness })}
                    >
                        <span className="font-display text-2xl font-bold tabular">
                            {data.readiness}
                            <span className="text-sm font-semibold opacity-80">%</span>
                        </span>
                    </ProgressRing>
                    <div className="min-w-0">
                        <p className="text-sm opacity-80">{t.pass_readiness}</p>
                        <p className="font-display text-xl font-semibold leading-tight">{data.readinessLabel}</p>
                        <p className="mt-1 text-sm tabular opacity-80">{fmt(t.pass_known_detail, { known: data.known, total: data.total })}</p>
                    </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3">
                    <div className="min-w-0 rounded-2xl bg-white/10 p-3 ring-1 ring-inset ring-white/10">
                        <dt className="flex items-center gap-1.5 text-xs font-medium opacity-80">
                            <FlameIcon size={14} className={clsx("pass-foil", data.streakAtRisk && "motion-safe:animate-pulse")} />
                            <span className="truncate">{t.pass_streak}</span>
                        </dt>
                        <dd className="mt-1.5 flex items-baseline gap-2 font-display text-xl font-bold tabular leading-none">
                            {plural(t, "common_days", data.streak)}
                            {data.freezes > 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-xs font-semibold opacity-80" title={fmt(t.pass_freezes_title, { count: data.freezes })}>
                                    <SnowflakeIcon size={12} aria-hidden="true" />
                                    {data.freezes}
                                    <span className="sr-only">{fmt(t.pass_freezes_title, { count: data.freezes })}</span>
                                </span>
                            ) : null}
                        </dd>
                    </div>
                    <div className="min-w-0 rounded-2xl bg-white/10 p-3 ring-1 ring-inset ring-white/10">
                        <dt className="flex items-center gap-1.5 text-xs font-medium opacity-80">
                            <TargetIcon size={14} className="pass-foil" />
                            <span className="truncate">{goalMet ? t.pass_goal_met : t.pass_today}</span>
                        </dt>
                        <dd className="mt-1.5 font-display text-xl font-bold tabular leading-none">
                            {data.answeredToday}
                            <span className="text-sm font-semibold opacity-70">/{data.goal}</span>
                        </dd>
                        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                            <div className="h-full rounded-full bg-[color:var(--pass-foil)] transition-[width] duration-500" style={{ width: `${Math.round(goalRatio * 100)}%` }} />
                        </div>
                    </div>
                </dl>

                {children ? <div className="mt-4">{children}</div> : null}
            </div>
        </section>
    );
}
