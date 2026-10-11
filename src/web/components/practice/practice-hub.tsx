"use client";

import { useSearchParams } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { ChoiceChips, type ChoiceOption } from "@/components/ui/choice-chips";
import { FoldOut } from "@/components/ui/fold-out";
import { ProgressBar } from "@/components/ui/progress";
import { PageHeader, SectionHeading, Surface } from "@/components/ui/surface";
import type { User } from "@/types/user";
import { dayKey } from "@/utils/date-utils";
import { fmt, plural } from "@/utils/i18n";
import { getCategoryCounts } from "@/utils/question-bank";
import { goalProgress } from "@/utils/streak-logic";
import {
    modeCounts,
    modeHref,
    splitStudyModes,
    STUDY_MODES,
    suggestNextAction,
    type StudyModeDef,
    type StudyModeId,
} from "@/utils/study-modes";
import { prefsOf, SESSION_SIZE_OPTIONS } from "@/utils/user-defaults";
import { updateUser, useTranslations } from "@/utils/user-store";
import { ModeCard } from "./mode-card";
import { TopicPicker } from "./topic-picker";

/** Modes that always have questions, whatever the learner's progress. */
const ALWAYS_AVAILABLE: ReadonlySet<StudyModeId> = new Set<StudyModeId>(["quick", "marathon"]);

function rise(index: number): CSSProperties {
    return { animationDelay: `${Math.min(index, 8) * 40}ms` };
}

function saveSessionSize(size: number): void {
    updateUser((draft) => {
        draft.preferences = { ...prefsOf(draft), sessionSize: size };
    });
}

/** The practice hub: today's goal, the session size, the four main study modes, and the rest behind a fold-out. */
export function PracticeHub({ user }: { user: User }) {
    const t = useTranslations();
    const searchParams = useSearchParams();
    const [pickerOpen, setPickerOpen] = useState(() => searchParams.get("mode") === "category");

    const today = dayKey();
    const prefs = prefsOf(user);
    const goal = goalProgress(user, today);
    const counts = modeCounts(user, today);
    const suggestion = suggestNextAction(user, today);
    const recommendedMode = suggestion.kind === "mode" ? suggestion.mode : null;
    const { primary, more } = splitStudyModes(STUDY_MODES, recommendedMode);
    const topicCount = getCategoryCounts(user.state?.stateCode ?? "").length;

    const sizeOptions: ChoiceOption<number>[] = SESSION_SIZE_OPTIONS.map((size) => ({
        value: size,
        label: size === 0 ? t.practice_session_size_all : String(size),
    }));

    const renderMode = (mode: StudyModeDef, riseIndex: number) => {
        const count = counts[mode.id] ?? 0;
        const available = count > 0 || ALWAYS_AVAILABLE.has(mode.id);
        const isCategory = mode.id === "category";
        const meta = !available
            ? t.practice_mode_empty_hint
            : isCategory
              ? `${plural(t, "practice_topics_count", topicCount)} · ${plural(t, "common_questions", count)}`
              : plural(t, "common_questions", count);
        return (
            <ModeCard
                key={mode.id}
                mode={mode}
                title={t[mode.titleKey] ?? mode.id}
                description={fmt(t[mode.descriptionKey], { state: user.state?.stateName ?? "" })}
                meta={meta}
                recommended={mode.id === recommendedMode}
                recommendedLabel={t.practice_recommended}
                disabled={!available}
                actionLabel={isCategory ? t.practice_topic_picker_title : t.common_start}
                href={isCategory ? undefined : modeHref(mode.id)}
                onPress={isCategory ? () => setPickerOpen(true) : undefined}
                style={rise(riseIndex)}
            />
        );
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader title={t.practice_title} description={t.practice_subtitle} className="animate-rise-in" />

            <Surface as="section" aria-labelledby="practice-goal-title" className="flex flex-col gap-4 animate-rise-in" style={rise(1)}>
                <div className="flex items-center justify-between gap-3">
                    <h2 id="practice-goal-title" className="font-display text-base font-semibold text-foreground">
                        {t.practice_goal_title}
                    </h2>
                    <span className="text-sm tabular text-default-500">
                        <span className="font-semibold text-foreground">{goal.answered}</span>
                        {` / ${goal.goal}`}
                    </span>
                </div>
                <ProgressBar
                    value={goal.ratio}
                    label={fmt(t.practice_goal_progress, { answered: goal.answered, goal: goal.goal })}
                    indicatorClassName={goal.met ? "bg-success" : "bg-primary"}
                />
                <p className={goal.met ? "text-sm font-medium text-success-700" : "text-sm text-default-500"}>
                    {goal.met ? t.practice_goal_done : fmt(t.practice_goal_progress, { answered: goal.answered, goal: goal.goal })}
                </p>
                <div className="flex flex-col gap-2 border-t border-divider pt-4">
                    <p className="text-sm font-medium text-foreground">{t.practice_session_size_label}</p>
                    <ChoiceChips
                        options={sizeOptions}
                        value={prefs.sessionSize}
                        onChange={saveSessionSize}
                        label={t.practice_session_size_label}
                        size="sm"
                        fill
                    />
                </div>
            </Surface>

            <section aria-labelledby="practice-modes-title" className="flex flex-col gap-3">
                <SectionHeading id="practice-modes-title" title={t.practice_modes_title} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {primary.map((mode, index) => renderMode(mode, index + 2))}
                </div>
                {more.length > 0 ? (
                    <div className="animate-rise-in" style={rise(primary.length + 2)}>
                        <FoldOut variant="card" title={plural(t, "practice_more_modes", more.length)}>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{more.map((mode, index) => renderMode(mode, index))}</div>
                        </FoldOut>
                    </div>
                ) : null}
            </section>

            <TopicPicker user={user} t={t} isOpen={pickerOpen} onOpenChange={setPickerOpen} />
        </div>
    );
}
