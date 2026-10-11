"use client";

import type { CSSProperties } from "react";
import { AppLink } from "@/components/ui/app-link";
import { IconBadge } from "@/components/ui/icon-badge";
import { ChevronRightIcon, LandmarkIcon } from "@/components/ui/icons";
import { Surface } from "@/components/ui/surface";
import type { EvaluationData } from "@/types/evaluation";
import { fmt, formatDate, type Translations } from "@/utils/i18n";
import { evaluationDates } from "./home-logic";

type EvaluationStatusProps = {
    data: EvaluationData;
    language: "de" | "en";
    t: Translations;
    className?: string;
    style?: CSSProperties;
};

const LONG_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

/** Which exam day the BAMF is grading right now, from the bundled sync data or a fresher download (see `useEvaluation`). */
export function EvaluationStatus({ data, language, t, className, style }: EvaluationStatusProps) {
    const { examDate, lastChecked } = evaluationDates(data);

    return (
        <Surface as="section" aria-labelledby="home-eval-title" className={className} style={style}>
            <div className="flex items-start gap-3">
                <IconBadge icon={LandmarkIcon} accent="secondary" />
                <div className="min-w-0 flex-1">
                    <h2 id="home-eval-title" className="font-display text-base font-semibold leading-tight text-foreground">
                        {t.eval_section_title}
                    </h2>
                    {examDate ? (
                        <p className="mt-1 text-sm text-foreground">{fmt(t.home_eval_current, { date: formatDate(examDate, language, LONG_DATE) })}</p>
                    ) : (
                        <p className="mt-1 text-sm text-default-500">{t.home_eval_unknown}</p>
                    )}
                    {lastChecked ? (
                        <p className="mt-1 text-xs text-default-500">{fmt(t.home_eval_checked, { date: formatDate(lastChecked, language) })}</p>
                    ) : null}
                </div>
            </div>
            <AppLink href="/#bamf-evaluation" className="mt-3 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary">
                {t.home_eval_details}
                <ChevronRightIcon size={16} aria-hidden="true" />
            </AppLink>
        </Surface>
    );
}
