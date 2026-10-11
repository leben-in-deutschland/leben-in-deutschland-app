"use client";

import type { User } from "@/types/user";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { CheckCircleIcon, LayersIcon, TargetIcon, VibrateIcon, ZapIcon } from "@/components/ui/icons";
import { plural } from "@/utils/i18n";
import { DAILY_GOAL_OPTIONS, prefsOf, SESSION_SIZE_OPTIONS } from "@/utils/user-defaults";
import { updateUser, useIsNative, useTranslations } from "@/utils/user-store";
import { SettingBlock, SettingsSection, SwitchRow } from "./settings-shared";

export function PracticeSection({ user }: { user: User }) {
    const t = useTranslations();
    const isNative = useIsNative();
    const prefs = prefsOf(user);

    const setPref = <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
        updateUser((draft) => {
            draft.preferences = prefsOf(draft);
            draft.preferences[key] = value;
        });
    };

    return (
        <SettingsSection id="practice" title={t.settings_section_practice}>
            <SettingBlock
                icon={TargetIcon}
                accent="primary"
                title={t.settings_daily_goal}
                trailing={plural(t, "settings_daily_goal_value", prefs.dailyGoal)}
            >
                <ChoiceChips
                    label={t.settings_daily_goal}
                    value={prefs.dailyGoal}
                    onChange={(next) => setPref("dailyGoal", next)}
                    fill
                    options={DAILY_GOAL_OPTIONS.map((goal) => ({ value: goal, label: String(goal) }))}
                />
            </SettingBlock>

            <SettingBlock icon={LayersIcon} title={t.settings_session_size} description={t.settings_session_size_hint}>
                <ChoiceChips
                    label={t.settings_session_size}
                    value={prefs.sessionSize}
                    onChange={(next) => setPref("sessionSize", next)}
                    fill
                    options={SESSION_SIZE_OPTIONS.map((size) => ({ value: size, label: size === 0 ? t.settings_session_size_all : String(size) }))}
                />
            </SettingBlock>

            <SwitchRow
                icon={CheckCircleIcon}
                title={t.settings_confirm_answers}
                description={t.settings_confirm_answers_hint}
                checked={prefs.confirmAnswers}
                onChange={(checked) => setPref("confirmAnswers", checked)}
            />
            <SwitchRow
                icon={ZapIcon}
                title={t.settings_auto_advance}
                description={t.settings_auto_advance_hint}
                checked={prefs.autoAdvance}
                onChange={(checked) => setPref("autoAdvance", checked)}
            />
            {isNative ? (
                <SwitchRow
                    icon={VibrateIcon}
                    title={t.settings_haptics}
                    description={t.settings_haptics_hint}
                    checked={prefs.haptics}
                    onChange={(checked) => setPref("haptics", checked)}
                />
            ) : null}
        </SettingsSection>
    );
}
