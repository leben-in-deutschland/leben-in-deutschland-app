"use client";

import { Chip } from "@heroui/react";
import clsx from "clsx";
import { useMemo } from "react";
import { IconBadge } from "@/components/ui/icon-badge";
import { Icon, TrophyIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { User } from "@/types/user";
import type { AchievementTier } from "@/utils/achievements";
import { fmt, formatDate } from "@/utils/i18n";
import { useAppLanguage, useTranslations } from "@/utils/user-store";
import { achievementOverview } from "./progress-stats";

const TIER_KEY: Record<AchievementTier, string> = {
    bronze: "ach_tier_bronze",
    silver: "ach_tier_silver",
    gold: "ach_tier_gold",
};

const TIER_COLOR: Record<AchievementTier, "warning" | "default" | "secondary"> = {
    bronze: "warning",
    silver: "default",
    gold: "secondary",
};

type AchievementsSectionProps = {
    user: User;
    today: string;
};

/** Every achievement: unlocked ones in gold, the rest with how far along they are. */
export function AchievementsSection({ user, today }: AchievementsSectionProps) {
    const t = useTranslations();
    const language = useAppLanguage();
    const overview = useMemo(() => achievementOverview(user, today), [user, today]);

    return (
        <Surface as="section" id="achievements" className="scroll-mt-24 animate-rise-in" aria-labelledby="progress-achievements-heading">
            <SectionHeading
                id="progress-achievements-heading"
                title={
                    <span className="inline-flex items-center gap-2">
                        <TrophyIcon size={20} className="shrink-0 text-pass-foil" />
                        {t.progress_achievements_title}
                    </span>
                }
                description={fmt(t.progress_achievements_count, { unlocked: overview.unlocked, total: overview.total })}
            />
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {overview.items.map(({ def, unlocked, progress, ratio }, index) => {
                    const title = t[def.titleKey] ?? def.id;
                    const description = t[def.descriptionKey] ?? "";
                    const unlockedDate = unlocked ? formatDate(unlocked.unlockedAt, language) : "";
                    return (
                        <li
                            key={def.id}
                            className={clsx(
                                "relative flex flex-col gap-2 rounded-xl border p-3 animate-pop-in",
                                unlocked
                                    ? "border-pass-foil/60 bg-gradient-to-br from-pass-foil/20 via-content1 to-content1 shadow-card"
                                    : "border-divider bg-content2/60",
                            )}
                            style={{ animationDelay: `${Math.min(index, 11) * 30}ms` }}
                            aria-label={
                                unlocked
                                    ? `${title}: ${fmt(t.progress_achievement_unlocked, { date: unlockedDate })}`
                                    : `${title}: ${fmt(t.progress_achievement_locked_aria, { progress, target: def.target })}`
                            }
                        >
                            <div className="flex items-start justify-between gap-2">
                                {unlocked ? (
                                    <span
                                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pass-foil text-pass-deep shadow-card"
                                        aria-hidden="true"
                                    >
                                        <Icon name={def.icon} size={20} />
                                    </span>
                                ) : (
                                    <IconBadge icon={def.icon} accent="default" className="opacity-70" />
                                )}
                                <Chip size="sm" variant="flat" color={TIER_COLOR[def.tier]} className="h-5 text-[11px]">
                                    {t[TIER_KEY[def.tier]]}
                                </Chip>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={clsx("text-sm font-semibold leading-snug", unlocked ? "text-foreground" : "text-default-600")}>{title}</p>
                                <p className="mt-0.5 text-xs leading-snug text-default-500">{description}</p>
                            </div>
                            {unlocked ? (
                                <p className="text-xs font-medium text-pass-deep dark:text-pass-foil">{fmt(t.progress_achievement_unlocked, { date: unlockedDate })}</p>
                            ) : (
                                <div>
                                    <ProgressBar
                                        value={ratio}
                                        size="sm"
                                        label={fmt(t.progress_achievement_progress, { progress, target: def.target })}
                                        indicatorClassName="bg-default-400"
                                    />
                                    <p className="mt-1 text-xs tabular text-default-500">
                                        {fmt(t.progress_achievement_progress, { progress, target: def.target })}
                                    </p>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Surface>
    );
}
