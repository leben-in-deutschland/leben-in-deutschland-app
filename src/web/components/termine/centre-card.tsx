"use client";

import clsx from "clsx";
import type { TerminCentre, TerminSlot } from "@/types/termine";
import { FoldOut } from "@/components/ui/fold-out";
import { BellIcon, BellOffIcon, ExternalLinkIcon, MapPinIcon } from "@/components/ui/icons";
import { Surface } from "@/components/ui/surface";
import { parseDayKey } from "@/utils/date-utils";
import { fmt, formatDate, plural, type Translations } from "@/utils/i18n";
import { centreSummary, isUnconfirmed, splitSlots, townsOf, upcomingSlots } from "@/utils/termine-logic";
import { StatusChip } from "./status-chip";

/** Dates shown before "more dates". */
export const VISIBLE_SLOTS = 3;

const DAY: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
const SHORT_DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const READ_AT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

const actionClass =
    "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

type CentreCardProps = {
    centre: TerminCentre;
    /** "YYYY-MM-DD" */
    today: string;
    now: Date;
    language: "de" | "en";
    t: Translations;
    watched: boolean;
    onToggleWatch: (centre: TerminCentre) => void;
};

function SlotRow({ slot, language, t }: { slot: TerminSlot; language: "de" | "en"; t: Translations }) {
    const date = formatDate(parseDayKey(slot.date), language, DAY);
    const details = [
        slot.place,
        slot.booking ? t[`termine_booking_${slot.booking}`] : null,
        slot.deadline ? fmt(t.termine_deadline, { date: formatDate(parseDayKey(slot.deadline), language, SHORT_DAY) }) : null,
    ].filter(Boolean);
    return (
        <li>
            <a
                href={slot.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={fmt(t.termine_open_date_aria, { title: slot.title, date })}
                className="-mx-2 flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-default-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
                <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-medium leading-snug text-foreground">
                        <span className="tabular">{date}</span>
                        {slot.time ? <span className="tabular text-default-600"> · {fmt(t.termine_time, { time: slot.time })}</span> : null}
                    </span>
                    {details.length > 0 ? <span className="block break-words text-xs leading-snug text-default-500">{details.join(" · ")}</span> : null}
                </span>
                <StatusChip status={slot.status} t={t} size="sm" />
            </a>
        </li>
    );
}

/** One exam centre: what is known about places, its next dates, when it was read, and the way to its page. */
export function CentreCard({ centre, today, now, language, t, watched, onToggleWatch }: CentreCardProps) {
    const slots = upcomingSlots(centre, today);
    const { shown, more } = splitSlots(slots, VISIBLE_SLOTS);
    const summary = centreSummary(centre, today);
    const others = townsOf(centre).filter((town) => town !== centre.city);
    const readAt = centre.checkedAt ? formatDate(centre.checkedAt, language, READ_AT) : null;
    const unconfirmed = isUnconfirmed(centre, now);
    const WatchIcon = watched ? BellIcon : BellOffIcon;

    return (
        <Surface as="li" className="flex flex-col gap-3" data-testid={`termine-centre-${centre.id}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-default-500">
                        <MapPinIcon size={14} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{centre.city}</span>
                    </p>
                    <h2 className="mt-0.5 font-display text-base font-semibold leading-tight text-foreground">{centre.name}</h2>
                    {others.length > 0 ? <p className="mt-0.5 text-xs text-default-500">{fmt(t.termine_also_in, { towns: others.join(", ") })}</p> : null}
                </div>
                <StatusChip status={summary} t={t} />
            </div>

            {slots.length > 0 ? (
                <div>
                    <ul className="flex flex-col">
                        {shown.map((slot) => (
                            <SlotRow key={slot.id} slot={slot} language={language} t={t} />
                        ))}
                    </ul>
                    {more.length > 0 ? (
                        <FoldOut title={plural(t, "termine_more_dates", more.length)}>
                            <ul className="flex flex-col">
                                {more.map((slot) => (
                                    <SlotRow key={slot.id} slot={slot} language={language} t={t} />
                                ))}
                            </ul>
                        </FoldOut>
                    ) : null}
                </div>
            ) : (
                <p className="text-sm text-default-500">{readAt ? t.termine_no_dates : t.termine_never_read}</p>
            )}

            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <p className={clsx("text-xs", unconfirmed ? "text-warning-700" : "text-default-500")}>
                    {readAt ? fmt(unconfirmed ? t.termine_unconfirmed : t.termine_checked, { time: readAt }) : null}
                </p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onToggleWatch(centre)}
                        aria-pressed={watched}
                        aria-label={fmt(watched ? t.termine_unwatch_aria : t.termine_watch_aria, { centre: centre.name })}
                        className={clsx(actionClass, watched ? "bg-primary text-primary-foreground" : "bg-content2 text-foreground hover:bg-primary-50 hover:text-primary")}
                    >
                        <WatchIcon size={16} aria-hidden="true" />
                        {watched ? t.termine_watching : t.termine_watch}
                    </button>
                    <a href={centre.url} target="_blank" rel="noopener noreferrer" className={clsx(actionClass, "bg-content2 text-foreground hover:bg-primary-50 hover:text-primary")}>
                        <ExternalLinkIcon size={16} aria-hidden="true" />
                        {t.termine_open_centre}
                    </a>
                </div>
            </div>
        </Surface>
    );
}
