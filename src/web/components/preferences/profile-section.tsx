"use client";

import { useDisclosure } from "@heroui/react";
import { useTheme } from "next-themes";
import type { State } from "@/types/state";
import type { User } from "@/types/user";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { ChevronRightIcon, GlobeIcon, MapPinIcon, MonitorIcon, MoonIcon, SunIcon, TextSizeIcon, TranslateIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { IconBadge } from "@/components/ui/icon-badge";
import { changeUserState, prefsOf } from "@/utils/user-defaults";
import { setAppLanguage, updateUser, useAppLanguage, useHydrated, useTranslations } from "@/utils/user-store";
import { TRANSLATION_LANGUAGE_OPTIONS } from "./preferences-logic";
import { SettingBlock, SettingsSection, SwitchRow, ValuePill } from "./settings-shared";
import { StateDialog } from "./state-dialog";

const THEMES = ["system", "light", "dark"] as const;
type ThemeName = (typeof THEMES)[number];

function themeName(value: string | undefined): ThemeName {
    return THEMES.includes(value as ThemeName) ? (value as ThemeName) : "system";
}

export function ProfileSection({ user }: { user: User }) {
    const t = useTranslations();
    const language = useAppLanguage();
    const hydrated = useHydrated();
    const { theme, setTheme } = useTheme();
    const picker = useDisclosure();
    const prefs = prefsOf(user);
    const currentTheme = hydrated ? themeName(theme) : null;

    const chooseState = (state: State) => {
        updateUser((draft) => changeUserState(draft, state));
        picker.onClose();
    };

    const themeLabels: Record<ThemeName, string> = {
        system: t.settings_theme_system,
        light: t.settings_theme_light,
        dark: t.settings_theme_dark,
    };
    const themeIcons = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

    return (
        <SettingsSection id="profile" title={t.settings_section_profile}>
            <ListRow
                leading={<IconBadge icon={MapPinIcon} accent="primary" />}
                title={t.settings_state}
                description={t.settings_state_hint}
                trailing={
                    <span className="flex shrink-0 items-center gap-1.5">
                        <ValuePill tone="primary">{user.state?.stateName || "—"}</ValuePill>
                        <ChevronRightIcon size={18} className="text-default-400" aria-hidden="true" />
                    </span>
                }
                onPress={picker.onOpen}
            />

            <SettingBlock icon={GlobeIcon} title={t.settings_app_language} description={t.settings_app_language_hint}>
                <ChoiceChips
                    label={t.settings_app_language}
                    value={language}
                    onChange={(next) => setAppLanguage(next)}
                    fill
                    options={[
                        { value: "de", label: "Deutsch" },
                        { value: "en", label: "English" },
                    ]}
                />
            </SettingBlock>

            <SettingBlock icon={TranslateIcon} title={t.settings_translation_language} description={t.settings_translation_language_hint}>
                <ChoiceChips
                    label={t.settings_translation_language}
                    size="sm"
                    value={prefs.translationLanguage}
                    onChange={(next) =>
                        updateUser((draft) => {
                            draft.preferences = prefsOf(draft);
                            draft.preferences.translationLanguage = next;
                        })
                    }
                    options={TRANSLATION_LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                />
            </SettingBlock>

            <SettingBlock
                icon={currentTheme ? themeIcons[currentTheme] : MonitorIcon}
                title={t.settings_theme}
                trailing={currentTheme ? themeLabels[currentTheme] : null}
            >
                {/* Theme is only known on the client; render the chips once hydrated to avoid a mismatch. */}
                {currentTheme ? (
                    <ChoiceChips
                        label={t.settings_theme}
                        value={currentTheme}
                        onChange={(next) => setTheme(next)}
                        fill
                        options={THEMES.map((value) => ({ value, label: themeLabels[value] }))}
                    />
                ) : (
                    <div aria-hidden="true" className="h-11 animate-pulse rounded-xl bg-default-100" />
                )}
            </SettingBlock>

            <SwitchRow
                icon={TextSizeIcon}
                title={t.settings_large_text}
                description={t.settings_large_text_hint}
                checked={prefs.largeText}
                onChange={(checked) =>
                    updateUser((draft) => {
                        draft.preferences = prefsOf(draft);
                        draft.preferences.largeText = checked;
                    })
                }
            />

            <StateDialog isOpen={picker.isOpen} onOpenChange={picker.onOpenChange} selectedCode={user.state?.stateCode} onSelect={chooseState} />
        </SettingsSection>
    );
}
