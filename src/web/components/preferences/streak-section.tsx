"use client";

import clsx from "clsx";
import type { StreakRule, User } from "@/types/user";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { CoffeeIcon, FlameIcon, SnowflakeIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { IconBadge } from "@/components/ui/icon-badge";
import { fmt } from "@/utils/i18n";
import { MAX_REST_DAYS, MAX_STREAK_FREEZES, prefsOf } from "@/utils/user-defaults";
import { updateUser, useAppLanguage, useTranslations } from "@/utils/user-store";
import { streakSummary, toggleRestDay, WEEKDAY_ORDER, weekdayLabel } from "./preferences-logic";
import { SettingBlock, SettingsFoldOut, SettingsSection, ValuePill } from "./settings-shared";

export function StreakSection({ user }: { user: User }) {
    const t = useTranslations();
    const language = useAppLanguage();
    const prefs = prefsOf(user);
    const restDays = prefs.restDays;
    const limitReached = restDays.length >= MAX_REST_DAYS;
    const freezes = Math.max(0, Math.min(MAX_STREAK_FREEZES, user.streak?.freezes ?? 0));

    const rules: { value: StreakRule; label: string; hint: string }[] = [
        { value: "activity", label: t.settings_streak_rule_activity, hint: t.settings_streak_rule_activity_hint },
        { value: "goal", label: t.settings_streak_rule_goal, hint: fmt(t.settings_streak_rule_goal_hint, { count: prefs.dailyGoal }) },
    ];

    return (
        <SettingsSection id="streak" title={t.settings_section_streak} description={t.settings_section_streak_hint}>
            <SettingsFoldOut title={t.settings_streak_advanced} summary={streakSummary(t, prefs, freezes)}>
                <SettingBlock icon={FlameIcon} accent="warning" title={t.settings_streak_rule}>
                    <ChoiceChips
                        label={t.settings_streak_rule}
                        value={prefs.streakRule}
                        onChange={(next) =>
                            updateUser((draft) => {
                                draft.preferences = prefsOf(draft);
                                draft.preferences.streakRule = next;
                            })
                        }
                        fill
                        options={rules}
                    />
                </SettingBlock>

                <SettingBlock
                    icon={CoffeeIcon}
                    title={t.settings_rest_days}
                    description={t.settings_rest_days_hint}
                    trailing={<ValuePill tone={restDays.length ? "primary" : "default"}>{fmt(t.settings_rest_days_count, { count: restDays.length, max: MAX_REST_DAYS })}</ValuePill>}
                >
                    <div role="group" aria-label={t.settings_rest_days} className="grid grid-cols-7 gap-1.5">
                        {WEEKDAY_ORDER.map((weekday) => {
                            const selected = restDays.includes(weekday);
                            const disabled = !selected && limitReached;
                            return (
                                <button
                                    key={weekday}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={selected}
                                    disabled={disabled}
                                    onClick={() =>
                                        updateUser((draft) => {
                                            draft.preferences = prefsOf(draft);
                                            draft.preferences.restDays = toggleRestDay(draft.preferences.restDays, weekday);
                                        })
                                    }
                                    className={clsx(
                                        "flex min-h-[44px] items-center justify-center rounded-xl px-1 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-200 active:scale-95",
                                        selected
                                            ? "bg-primary text-primary-foreground shadow-glow"
                                            : "bg-content1 text-foreground shadow-card ring-1 ring-foreground/[0.07] hover:ring-default-400 dark:ring-white/[0.09]",
                                        disabled && "cursor-not-allowed opacity-45",
                                    )}
                                >
                                    {weekdayLabel(weekday, language)}
                                </button>
                            );
                        })}
                    </div>
                </SettingBlock>

                <div className="flex items-start gap-3 px-4 py-3">
                    <IconBadge icon={SnowflakeIcon} accent="secondary" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                            <p className="font-medium leading-snug text-foreground">{t.settings_freezes}</p>
                            <ValuePill tone={freezes > 0 ? "primary" : "default"}>{fmt(t.settings_freezes_saved, { count: freezes })}</ValuePill>
                        </div>
                        <p className="mt-0.5 text-sm leading-snug text-default-500">{fmt(t.settings_freezes_hint, { max: MAX_STREAK_FREEZES })}</p>
                    </div>
                </div>
            </SettingsFoldOut>

            <ListRow title={t.settings_streak_link} href="/progress#streak" />
        </SettingsSection>
    );
}
