"use client";

import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import type { ExamType, User } from "@/types/user";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { InlineNotice } from "@/components/ui/feedback";
import { CalendarIcon, ClipboardCheckIcon, TimerIcon, XIcon } from "@/components/ui/icons";
import { dayKey, parseDayKey } from "@/utils/date-utils";
import { formatDate, plural } from "@/utils/i18n";
import { PASS_MARKS, prefsOf } from "@/utils/user-defaults";
import { updateUser, useAppLanguage, useTranslations } from "@/utils/user-store";
import { dayKeyFromInput, examCountdown } from "./preferences-logic";
import { DateInput, SettingBlock, SettingsSection, SwitchRow, ValuePill } from "./settings-shared";

const EXAM_TYPES = Object.keys(PASS_MARKS) as ExamType[];

export function ExamSection({ user }: { user: User }) {
    const t = useTranslations();
    const language = useAppLanguage();
    const prefs = prefsOf(user);
    const today = dayKey();
    const examDate = user.examDate ?? null;
    const countdown = examCountdown(examDate, today);

    const setExamDate = (value: string | null) => {
        updateUser((draft) => {
            draft.examDate = value;
        });
    };

    const typeLabels: Record<ExamType, { label: string; hint: string }> = {
        einbuergerung: { label: t.exam_type_einbuergerung, hint: t.exam_type_einbuergerung_hint },
        lid: { label: t.exam_type_lid, hint: t.exam_type_lid_hint },
    };

    let countdownPill: ReactNode = <ValuePill>{t.settings_exam_date_none}</ValuePill>;
    if (countdown.kind === "future") {
        countdownPill = <ValuePill tone="primary">{plural(t, "settings_exam_date_in", countdown.days)}</ValuePill>;
    } else if (countdown.kind === "today") {
        countdownPill = <ValuePill tone="success">{t.settings_exam_date_today}</ValuePill>;
    } else if (countdown.kind === "past") {
        countdownPill = <ValuePill tone="warning">{formatDate(parseDayKey(examDate as string), language)}</ValuePill>;
    }

    return (
        <SettingsSection id="exam" title={t.settings_section_exam}>
            <SettingBlock icon={ClipboardCheckIcon} accent="primary" title={t.settings_exam_type}>
                <ChoiceChips
                    label={t.settings_exam_type}
                    value={prefs.examType}
                    onChange={(next) =>
                        updateUser((draft) => {
                            draft.preferences = prefsOf(draft);
                            draft.preferences.examType = next;
                        })
                    }
                    fill
                    options={EXAM_TYPES.map((type) => ({ value: type, label: typeLabels[type].label, hint: typeLabels[type].hint }))}
                />
            </SettingBlock>

            <SettingBlock icon={CalendarIcon} title={t.settings_exam_date} description={t.settings_exam_date_hint} trailing={countdownPill}>
                <div className="flex flex-wrap items-center gap-2">
                    <DateInput
                        id="settings-exam-date"
                        label={t.settings_exam_date}
                        value={examDate ?? ""}
                        min={today}
                        onChange={(value) => setExamDate(dayKeyFromInput(value))}
                    />
                    {examDate ? (
                        <Button variant="flat" onPress={() => setExamDate(null)} className="min-h-[44px]" startContent={<XIcon size={16} />}>
                            {t.settings_exam_date_clear}
                        </Button>
                    ) : null}
                </div>
                {countdown.kind === "past" ? (
                    <InlineNotice tone="warning" className="mt-3">
                        {t.settings_exam_date_past}
                    </InlineNotice>
                ) : null}
            </SettingBlock>

            <SwitchRow
                icon={TimerIcon}
                title={t.settings_mock_timer}
                description={t.settings_mock_timer_hint}
                checked={prefs.mockTimer}
                onChange={(checked) =>
                    updateUser((draft) => {
                        draft.preferences = prefsOf(draft);
                        draft.preferences.mockTimer = checked;
                    })
                }
            />
        </SettingsSection>
    );
}
