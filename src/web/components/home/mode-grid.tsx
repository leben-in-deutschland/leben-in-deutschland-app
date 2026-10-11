"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import { AppLink } from "@/components/ui/app-link";
import { ACCENT_TINT, IconBadge } from "@/components/ui/icon-badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { CARD, CARD_INTERACTIVE, SectionHeading } from "@/components/ui/surface";
import { plural, type Translations } from "@/utils/i18n";
import { modeHref, STUDY_MODES, type StudyModeId } from "@/utils/study-modes";

type ModeGridProps = {
    counts: Record<StudyModeId, number>;
    t: Translations;
    className?: string;
    style?: CSSProperties;
};

const SHOWN_MODES = STUDY_MODES.slice(0, 6);

/** Modes that always have questions, whatever the learner's progress. */
const ALWAYS_AVAILABLE: ReadonlySet<StudyModeId> = new Set<StudyModeId>(["quick", "marathon"]);

const tileClass = `flex min-h-[76px] items-center gap-3 bg-gradient-to-br via-content1 to-content1 p-3 ${CARD}`;

/** The first six study modes with their question counts. */
export function ModeGrid({ counts, t, className, style }: ModeGridProps) {
    return (
        <section aria-labelledby="home-modes-title" className={className} style={style}>
            <SectionHeading
                id="home-modes-title"
                title={t.home_modes_title}
                action={
                    <AppLink href="/practice" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary">
                        {t.home_modes_all}
                        <ChevronRightIcon size={16} aria-hidden="true" />
                    </AppLink>
                }
            />
            <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                {SHOWN_MODES.map((mode) => {
                    const count = counts[mode.id] ?? 0;
                    const available = count > 0 || ALWAYS_AVAILABLE.has(mode.id);
                    const body = (
                        <>
                            <IconBadge icon={mode.icon} accent={mode.accent} size="lg" className="transition-transform duration-300 group-hover:scale-105" />
                            <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{t[mode.titleKey]}</span>
                                <span className="mt-0.5 block text-xs tabular text-default-500">
                                    {available ? plural(t, "common_questions", count) : t.home_modes_empty}
                                </span>
                            </span>
                        </>
                    );
                    return (
                        <li key={mode.id} className="min-w-0">
                            {available ? (
                                <AppLink href={modeHref(mode.id)} className={clsx("group", tileClass, ACCENT_TINT[mode.accent], CARD_INTERACTIVE)}>
                                    {body}
                                </AppLink>
                            ) : (
                                <div className={clsx(tileClass, ACCENT_TINT.default, "opacity-60")} aria-disabled="true">
                                    {body}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
