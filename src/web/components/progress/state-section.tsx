"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { CheckIcon, MapPinIcon, SkipIcon, XIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { User } from "@/types/user";
import { fmt } from "@/utils/i18n";
import { modeHref } from "@/utils/study-modes";
import { useTranslations } from "@/utils/user-store";
import { LinkButton } from "./link-button";
import { stateMastery, type AnswerState } from "./progress-stats";

const MARKER: Record<AnswerState, { className: string; key: string }> = {
    correct: { className: "bg-success text-success-foreground", key: "common_correct" },
    wrong: { className: "bg-danger text-danger-foreground", key: "common_wrong" },
    skipped: { className: "bg-warning text-warning-foreground", key: "common_skipped" },
    unanswered: { className: "border border-dashed border-default-400 text-default-400", key: "common_unanswered" },
};

function Marker({ state }: { state: AnswerState }) {
    const size = 12;
    return (
        <span className={clsx("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full", MARKER[state].className)} aria-hidden="true">
            {state === "correct" ? <CheckIcon size={size} strokeWidth={3} /> : null}
            {state === "wrong" ? <XIcon size={size} strokeWidth={3} /> : null}
            {state === "skipped" ? <SkipIcon size={size} strokeWidth={3} /> : null}
        </span>
    );
}

type StateSectionProps = {
    user: User;
};

/** The ten questions about the learner's state, each marked known or not. */
export function StateSection({ user }: StateSectionProps) {
    const t = useTranslations();
    const mastery = useMemo(() => stateMastery(user), [user]);
    const stateName = user.state?.stateName || user.state?.stateCode || "";

    return (
        <Surface as="section" className="animate-rise-in" aria-labelledby="progress-state-heading">
            <SectionHeading
                id="progress-state-heading"
                title={
                    <span className="inline-flex items-center gap-2">
                        <MapPinIcon size={20} className="shrink-0 text-primary" />
                        {fmt(t.progress_state_title, { state: stateName })}
                    </span>
                }
                description={fmt(t.progress_state_known, { known: mastery.known, total: mastery.total })}
                action={
                    <LinkButton href={modeHref("state")} size="sm" variant="flat">
                        {t.progress_state_practice}
                    </LinkButton>
                }
            />
            <ProgressBar
                value={mastery.total > 0 ? mastery.known / mastery.total : 0}
                size="sm"
                className="mt-4"
                label={fmt(t.progress_state_known, { known: mastery.known, total: mastery.total })}
                indicatorClassName={mastery.known === mastery.total && mastery.total > 0 ? "bg-success" : "bg-primary"}
            />
            <ol className="mt-4 space-y-2">
                {mastery.questions.map(({ question, state }, index) => (
                    <li key={question.num} className="flex items-start gap-3 text-sm">
                        <Marker state={state} />
                        <span className="sr-only">{t[MARKER[state].key]}</span>
                        <span className="w-5 shrink-0 text-right tabular text-default-400">{index + 1}</span>
                        <span className="min-w-0 flex-1 leading-snug text-foreground" lang="de">
                            {question.question}
                        </span>
                    </li>
                ))}
            </ol>
        </Surface>
    );
}
