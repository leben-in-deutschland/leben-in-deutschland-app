"use client";

import { useMemo } from "react";
import { FlagIcon, SkipIcon, XCircleIcon, type IconComponent } from "@/components/ui/icons";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { User } from "@/types/user";
import { fmt } from "@/utils/i18n";
import { modeHref, type StudyModeId } from "@/utils/study-modes";
import { useTranslations } from "@/utils/user-store";
import { LinkButton } from "./link-button";
import { answerBreakdown } from "./progress-stats";
import { StackedBar } from "./stacked-bar";

type AnswersSectionProps = {
    user: User;
};

/** Every question of the catalogue by its latest answer, with shortcuts to the modes that fix things. */
export function AnswersSection({ user }: AnswersSectionProps) {
    const t = useTranslations();
    const answers = useMemo(() => answerBreakdown(user), [user]);
    const shortcuts: { mode: StudyModeId; icon: IconComponent; label: string; count: number }[] = [
        { mode: "incorrect", icon: XCircleIcon, label: t.mode_incorrect_title, count: answers.wrong },
        { mode: "flagged", icon: FlagIcon, label: t.mode_flagged_title, count: answers.flagged },
        { mode: "skipped", icon: SkipIcon, label: t.mode_skipped_title, count: answers.skipped },
    ];

    return (
        <Surface as="section" className="animate-rise-in" aria-labelledby="progress-answers-heading">
            <SectionHeading
                id="progress-answers-heading"
                title={t.progress_answers_title}
                description={fmt(t.progress_answers_subtitle, { total: answers.total })}
            />
            <StackedBar
                className="mt-4"
                total={answers.total}
                label={`${t.progress_answers_title}: ${t.common_correct} ${answers.correct}, ${t.common_wrong} ${answers.wrong}, ${t.common_skipped} ${answers.skipped}, ${t.common_unanswered} ${answers.unanswered}`}
                segments={[
                    { key: "correct", value: answers.correct, className: "bg-success", label: t.common_correct },
                    { key: "wrong", value: answers.wrong, className: "bg-danger", label: t.common_wrong },
                    { key: "skipped", value: answers.skipped, className: "bg-warning", label: t.common_skipped },
                    { key: "unanswered", value: answers.unanswered, className: "bg-default-300", label: t.common_unanswered },
                ]}
            />
            <p className="mt-3 flex items-center gap-2 text-sm text-default-500">
                <FlagIcon size={16} className="shrink-0 text-warning-600" />
                {fmt(t.progress_answers_flagged_note, { count: answers.flagged })}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
                {shortcuts.map(({ mode, icon: ShortcutIcon, label, count }) => (
                    <li key={mode}>
                        <LinkButton href={modeHref(mode)} variant="bordered" size="sm" aria-label={`${label}: ${count}`}>
                            <ShortcutIcon size={16} className="text-default-500" />
                            {label}
                            <span className="rounded-full bg-default-100 px-1.5 text-xs font-semibold tabular text-default-600">{count}</span>
                        </LinkButton>
                    </li>
                ))}
            </ul>
        </Surface>
    );
}
