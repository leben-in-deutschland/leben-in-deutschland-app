"use client";

import { useMemo } from "react";
import { AppLink } from "@/components/ui/app-link";
import { IconBadge } from "@/components/ui/icon-badge";
import { ArrowRightIcon, ChevronRightIcon, RepeatIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { User } from "@/types/user";
import { fmt, plural } from "@/utils/i18n";
import { getRelevantQuestions } from "@/utils/question-bank";
import { dueCount } from "@/utils/review-schedule";
import { modeHref } from "@/utils/study-modes";
import { useTranslations } from "@/utils/user-store";
import { LinkButton } from "./link-button";
import { masteryDistribution, topicMastery } from "./progress-stats";
import { StackedBar } from "./stacked-bar";

type TopicsSectionProps = {
    user: User;
    today: string;
};

/** Known questions per topic, the review levels, and what is due today. */
export function TopicsSection({ user, today }: TopicsSectionProps) {
    const t = useTranslations();
    const topics = useMemo(() => topicMastery(user), [user]);
    const levels = useMemo(() => masteryDistribution(user), [user]);
    const due = useMemo(() => {
        const relevant = new Set(getRelevantQuestions(user.state?.stateCode ?? "").map((question) => question.num));
        return dueCount(user.reviewSchedule, today, (num) => relevant.has(num));
    }, [user, today]);

    return (
        <Surface as="section" padding="none" className="animate-rise-in" aria-labelledby="progress-topics-heading">
            <div className="p-4 pb-2 sm:p-5 sm:pb-2">
                <SectionHeading id="progress-topics-heading" title={t.progress_topics_title} description={t.progress_topics_subtitle} />
            </div>
            <ul className="divide-y divide-divider">
                {topics.map((topic) => {
                    const name = t[topic.category] ?? topic.category;
                    const ratio = topic.total > 0 ? topic.known / topic.total : 0;
                    return (
                        <li key={topic.category}>
                            <AppLink
                                href={modeHref("category", topic.category)}
                                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-default-100 active:bg-default-200 sm:px-5"
                                aria-label={`${name}: ${fmt(t.progress_topic_known, { known: topic.known, total: topic.total })}`}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="truncate font-medium text-foreground">{name}</p>
                                        <p className="shrink-0 text-sm tabular text-default-600">
                                            <span className="font-semibold text-foreground">{topic.known}</span>/{topic.total}
                                        </p>
                                    </div>
                                    <ProgressBar
                                        value={ratio}
                                        size="sm"
                                        className="mt-2"
                                        indicatorClassName={ratio >= 0.8 ? "bg-success" : "bg-primary"}
                                    />
                                    <div className="mt-1 flex justify-between gap-3 text-xs text-default-500">
                                        <span>{fmt(t.progress_topic_known, { known: topic.known, total: topic.total })}</span>
                                        {topic.wrong > 0 ? <span className="text-danger">{plural(t, "progress_topic_wrong", topic.wrong)}</span> : null}
                                    </div>
                                </div>
                                <ChevronRightIcon size={18} className="shrink-0 text-default-400" />
                            </AppLink>
                        </li>
                    );
                })}
            </ul>
            <div className="border-t border-divider p-4 sm:p-5">
                <h3 className="font-display text-base font-semibold leading-tight text-foreground">{t.progress_levels_title}</h3>
                <p className="mt-0.5 text-sm text-default-500">{t.progress_levels_desc}</p>
                <StackedBar
                    className="mt-3"
                    total={levels.total}
                    label={`${t.progress_levels_title}: ${t.progress_level_new} ${levels.new}, ${t.progress_level_learning} ${levels.learning}, ${t.progress_level_known} ${levels.known}, ${t.progress_level_mastered} ${levels.mastered}`}
                    segments={[
                        { key: "mastered", value: levels.mastered, className: "bg-success", label: t.progress_level_mastered },
                        { key: "known", value: levels.known, className: "bg-primary", label: t.progress_level_known },
                        { key: "learning", value: levels.learning, className: "bg-warning", label: t.progress_level_learning },
                        { key: "new", value: levels.new, className: "bg-default-300", label: t.progress_level_new },
                    ]}
                />
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-content2 px-3 py-3">
                    <IconBadge icon={RepeatIcon} accent={due > 0 ? "warning" : "success"} size="sm" />
                    <p className="min-w-0 flex-1 text-sm text-foreground">{due > 0 ? plural(t, "progress_due", due) : t.progress_due_none}</p>
                    {due > 0 ? (
                        <LinkButton href={modeHref("review")} size="sm" variant="solid">
                            {t.mode_review_title}
                            <ArrowRightIcon size={16} />
                        </LinkButton>
                    ) : null}
                </div>
            </div>
        </Surface>
    );
}
