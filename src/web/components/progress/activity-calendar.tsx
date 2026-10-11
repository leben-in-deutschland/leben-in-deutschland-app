"use client";

import clsx from "clsx";
import { useMemo } from "react";
import type { DayStatus, CalendarDay } from "@/utils/streak-logic";
import { fmt, plural } from "@/utils/i18n";
import type { Translations } from "@/utils/i18n";
import { calendarWeeks, monthLabels, shortDate, weekdayName } from "./progress-stats";

const CELL_CLASS: Record<DayStatus, string> = {
    done: "bg-primary",
    partial: "bg-primary/40",
    frozen: "bg-secondary",
    rest: "bg-default-200",
    missed: "bg-default-100",
    today: "bg-default-100",
    future: "bg-transparent",
    none: "bg-transparent",
};

const LEGEND: { status: DayStatus; key: string }[] = [
    { status: "done", key: "progress_legend_done" },
    { status: "partial", key: "progress_legend_partial" },
    { status: "frozen", key: "progress_legend_frozen" },
    { status: "rest", key: "progress_legend_rest" },
    { status: "missed", key: "progress_legend_missed" },
    { status: "today", key: "progress_legend_today" },
];

const ACTIVE_STATUSES = new Set<DayStatus>(["done", "partial", "frozen"]);

/** Rows that get a weekday label on the left: Monday, Wednesday, Friday. */
const LABELED_ROWS = [0, 2, 4];

type CellProps = {
    status: DayStatus;
    isToday: boolean;
    title?: string;
    className?: string;
};

function Cell({ status, isToday, title, className }: CellProps) {
    return (
        <span
            title={title}
            className={clsx(
                "relative block aspect-square rounded-[3px]",
                CELL_CLASS[status],
                isToday && (status === "done" || status === "partial" ? "ring-2 ring-inset ring-pass-foil" : "ring-2 ring-inset ring-primary"),
                className,
            )}
        >
            {status === "rest" ? (
                <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-default-500" />
            ) : null}
        </span>
    );
}

type ActivityCalendarProps = {
    /** Oldest first, ending today. */
    days: CalendarDay[];
    today: string;
    locale: string;
    t: Translations;
    showPartial: boolean;
};

/** Twelve weeks of practice as a grid: one column per week, Monday at the top. */
export function ActivityCalendar({ days, today, locale, t, showPartial }: ActivityCalendarProps) {
    const weeks = useMemo(() => calendarWeeks(days), [days]);
    const months = useMemo(() => monthLabels(weeks, locale), [weeks, locale]);
    const active = days.filter((day) => ACTIVE_STATUSES.has(day.status)).length;
    const columns = { gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` };
    const legend = showPartial ? LEGEND : LEGEND.filter((item) => item.status !== "partial");

    return (
        <div>
            <div className="grid grid-cols-[auto_1fr] gap-x-1.5" role="img" aria-label={fmt(t.progress_calendar_aria, { active })}>
                <div aria-hidden="true" />
                <div className="grid h-4 text-[10px] leading-4 text-default-500" style={columns} aria-hidden="true">
                    {months.map((label, index) => (
                        <span key={index} className="overflow-visible whitespace-nowrap">
                            {label}
                        </span>
                    ))}
                </div>
                <div className="grid grid-rows-7 gap-[3px] text-[10px] leading-none text-default-500" aria-hidden="true">
                    {Array.from({ length: 7 }, (_, row) => (
                        <span key={row} className="flex items-center">
                            {LABELED_ROWS.includes(row) ? weekdayName((row + 1) % 7, locale, "short").slice(0, 2) : ""}
                        </span>
                    ))}
                </div>
                <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={columns}>
                    {weeks.flatMap((week, weekIndex) =>
                        week.map((cell, row) =>
                            cell ? (
                                <Cell
                                    key={cell.day}
                                    status={cell.status}
                                    isToday={cell.day === today}
                                    title={plural(t, "progress_calendar_cell", cell.answered, { date: shortDate(cell.day, locale) })}
                                    className="w-full"
                                />
                            ) : (
                                <span key={`pad-${weekIndex}-${row}`} className="block aspect-square w-full" />
                            ),
                        ),
                    )}
                </div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-default-500">
                {legend.map((item) => (
                    <li key={item.status} className="flex items-center gap-1.5">
                        <Cell status={item.status} isToday={item.status === "today"} className="w-3 shrink-0" />
                        {t[item.key]}
                    </li>
                ))}
            </ul>
        </div>
    );
}
