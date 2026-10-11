"use client";

import { Button } from "@heroui/react";
import clsx from "clsx";
import type { CSSProperties } from "react";
import { AppLink } from "@/components/ui/app-link";
import { IconBadge } from "@/components/ui/icon-badge";
import { CalendarIcon, SparklesIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { SectionHeading, Surface } from "@/components/ui/surface";
import { parseDayKey } from "@/utils/date-utils";
import { fmt, formatDate, plural, type Translations } from "@/utils/i18n";
import type { ExamCountdown } from "./home-logic";

type ExamCountdownCardProps = {
    countdown: ExamCountdown;
    language: "de" | "en";
    t: Translations;
    /** Removes the stored exam date, offered once the day has passed. */
    onClear: () => void;
    className?: string;
    style?: CSSProperties;
};

const LONG_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

/** Days until the exam, or a quiet row that asks for the date. */
export function ExamCountdownCard({ countdown, language, t, onClear, className, style }: ExamCountdownCardProps) {
    if (countdown.kind === "none") {
        return (
            <Surface as="section" padding="none" className={clsx("overflow-hidden", className)} style={style} aria-label={t.home_exam_add_title}>
                <ListRow
                    href="/settings"
                    leading={<IconBadge icon={CalendarIcon} accent="default" />}
                    title={t.home_exam_add_title}
                    description={t.home_exam_add_body}
                />
            </Surface>
        );
    }

    const date = formatDate(parseDayKey(countdown.examDate), language, LONG_DATE);
    const past = countdown.kind === "past";
    const soon = countdown.kind === "today" || countdown.kind === "tomorrow";

    let headline: string;
    let hint: string;
    switch (countdown.kind) {
        case "today":
            headline = t.home_exam_today;
            hint = fmt(t.home_exam_on, { date });
            break;
        case "tomorrow":
            headline = t.home_exam_tomorrow;
            hint = fmt(t.home_exam_on, { date });
            break;
        case "past":
            headline = fmt(t.home_exam_past, { date });
            hint = t.home_exam_past_hint;
            break;
        default:
            headline = plural(t, "home_exam_days", countdown.days);
            hint = fmt(t.home_exam_on, { date });
    }

    return (
        <Surface as="section" aria-labelledby="home-exam-title" className={className} style={style}>
            <SectionHeading id="home-exam-title" title={t.home_exam_title} />
            <div className="mt-4 flex items-center gap-4">
                <div
                    className={clsx(
                        "grid h-16 w-16 shrink-0 place-items-center rounded-2xl font-display text-3xl font-bold tabular leading-none",
                        past ? "bg-default-100 text-default-500" : soon ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground",
                    )}
                    aria-hidden="true"
                >
                    {countdown.kind === "upcoming" ? countdown.days : countdown.kind === "tomorrow" ? 1 : soon ? <SparklesIcon size={28} /> : <CalendarIcon size={28} />}
                </div>
                <div className="min-w-0">
                    <p className="font-display text-lg font-semibold leading-tight text-foreground">{headline}</p>
                    <p className="mt-1 text-sm text-default-500">{hint}</p>
                    {countdown.kind === "upcoming" ? <p className="mt-1 text-sm text-default-500">{t.home_exam_upcoming_hint}</p> : null}
                </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                {past ? (
                    <Button variant="flat" color="default" className="h-11 font-medium" onPress={onClear}>
                        {t.home_exam_clear}
                    </Button>
                ) : null}
                <Button as={AppLink} href="/settings" variant={past ? "flat" : "light"} color="primary" className="h-11 font-medium">
                    {t.home_exam_change}
                </Button>
            </div>
        </Surface>
    );
}
