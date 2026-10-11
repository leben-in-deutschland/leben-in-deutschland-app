"use client";

import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { ReminderPreferences, User } from "@/types/user";
import { InlineNotice } from "@/components/ui/feedback";
import {
    BellIcon,
    BellOffIcon,
    CalendarIcon,
    ChartIcon,
    ClipboardCheckIcon,
    ClockIcon,
    FlameIcon,
    LightbulbIcon,
    RouteIcon,
} from "@/components/ui/icons";
import { getNotificationPermission, requestNotificationPermission, sendTestNotification, type NotificationPermission } from "@/services/notifications";
import { isDayKey } from "@/utils/date-utils";
import { fmt } from "@/utils/i18n";
import { prefsOf } from "@/utils/user-defaults";
import { updateUser, useIsNative, useTranslations } from "@/utils/user-store";
import { countActiveReminders, timeFromInput } from "./preferences-logic";
import { SettingsFoldOut, SettingsSection, SwitchRow, TimeInput, ValuePill } from "./settings-shared";

/** Reads the Android permission after mount and again when the app comes back to the foreground. */
function useNotificationPermission(enabled: boolean): [NotificationPermission | null, (next: NotificationPermission) => void] {
    const [permission, setPermission] = useState<NotificationPermission | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        let cancelled = false;
        const refresh = () => {
            if (document.visibilityState === "hidden") {
                return;
            }
            void getNotificationPermission().then((next) => {
                if (!cancelled) {
                    setPermission(next);
                }
            });
        };
        refresh();
        document.addEventListener("visibilitychange", refresh);
        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [enabled]);

    return [permission, setPermission];
}

export function NotificationsSection({ user }: { user: User }) {
    const t = useTranslations();
    const isNative = useIsNative();
    const prefs = prefsOf(user);
    const reminders = prefs.reminders;
    const [permission, setPermission] = useNotificationPermission(isNative);
    const [sending, setSending] = useState(false);
    const blocked = permission === "denied";
    /** Reminders only fire when the switch is on and Android allows them. */
    const enabled = prefs.notificationsEnabled && !blocked;
    const hasExamDate = isDayKey(user.examDate);
    const activeReminders = countActiveReminders(reminders);

    const setPref = (mutate: (draft: NonNullable<User["preferences"]>) => void) => {
        updateUser((draft) => {
            draft.preferences = prefsOf(draft);
            mutate(draft.preferences);
        });
    };
    const setReminder = <K extends keyof ReminderPreferences>(key: K, value: ReminderPreferences[K]) => {
        setPref((draft) => {
            draft.reminders[key] = value;
        });
    };

    const toggleMaster = async (checked: boolean) => {
        if (!checked) {
            setPref((draft) => {
                draft.notificationsEnabled = false;
            });
            return;
        }
        const result = await requestNotificationPermission();
        setPermission(result);
        if (result === "granted") {
            setPref((draft) => {
                draft.notificationsEnabled = true;
            });
        }
    };

    const sendTest = async () => {
        setSending(true);
        try {
            const ok = await sendTestNotification(t, user);
            if (ok) {
                toast.success(t.settings_test_notification_sent);
            } else {
                toast.error(t.settings_test_notification_failed);
            }
        } finally {
            setSending(false);
        }
    };

    const permissionLabels: Record<NotificationPermission, { label: string; tone: "success" | "danger" | "default" }> = {
        granted: { label: t.settings_permission_granted, tone: "success" },
        denied: { label: t.settings_permission_denied, tone: "danger" },
        prompt: { label: t.settings_permission_prompt, tone: "default" },
        unsupported: { label: t.settings_permission_unsupported, tone: "default" },
    };

    const footer = (
        <div className="space-y-3">
            {isNative && blocked ? (
                <InlineNotice tone="warning" title={t.settings_permission_denied}>
                    {t.settings_permission_denied_help}
                </InlineNotice>
            ) : null}
            <InlineNotice tone="info">{t.settings_inbox_note}</InlineNotice>
        </div>
    );

    return (
        <SettingsSection id="notifications" title={t.notifications_title} footer={footer}>
            {!isNative ? (
                <div className="px-4 py-3">
                    <InlineNotice tone="info">{t.settings_notifications_web}</InlineNotice>
                </div>
            ) : (
                <>
                    <SwitchRow
                        icon={enabled ? BellIcon : BellOffIcon}
                        accent="primary"
                        title={t.settings_notifications_master}
                        description={
                            <span className="inline-flex flex-wrap items-center gap-2">
                                <span>{t.settings_notifications_master_hint}</span>
                                {permission ? <ValuePill tone={permissionLabels[permission].tone}>{permissionLabels[permission].label}</ValuePill> : null}
                            </span>
                        }
                        checked={enabled}
                        onChange={(checked) => void toggleMaster(checked)}
                    />

                    {/* Only while the master switch is on: folded, a list of disabled switches is just noise. */}
                    {enabled ? (
                        <SettingsFoldOut
                            title={t.settings_reminders_fine_tune}
                            summary={fmt(t.settings_reminders_active_count, { count: activeReminders.active, total: activeReminders.total })}
                        >
                            <SwitchRow
                                icon={ClockIcon}
                                title={t.settings_reminder_daily}
                                description={t.settings_reminder_daily_hint}
                                checked={reminders.daily}
                                disabled={!enabled}
                                onChange={(checked) => setReminder("daily", checked)}
                            >
                                <label className="flex items-center gap-3 text-sm text-default-600">
                                    <span>{t.settings_reminder_time}</span>
                                    <TimeInput
                                        label={`${t.settings_reminder_daily} – ${t.settings_reminder_time}`}
                                        value={reminders.dailyTime}
                                        onChange={(value) => setReminder("dailyTime", timeFromInput(value, reminders.dailyTime))}
                                    />
                                </label>
                            </SwitchRow>

                            <SwitchRow
                                icon={FlameIcon}
                                accent="warning"
                                title={t.settings_reminder_streak}
                                description={t.settings_reminder_streak_hint}
                                checked={reminders.streak}
                                disabled={!enabled}
                                onChange={(checked) => setReminder("streak", checked)}
                            >
                                <label className="flex items-center gap-3 text-sm text-default-600">
                                    <span>{t.settings_reminder_time}</span>
                                    <TimeInput
                                        label={`${t.settings_reminder_streak} – ${t.settings_reminder_time}`}
                                        value={reminders.streakTime}
                                        onChange={(value) => setReminder("streakTime", timeFromInput(value, reminders.streakTime))}
                                    />
                                </label>
                            </SwitchRow>

                            <SwitchRow
                                icon={CalendarIcon}
                                title={t.settings_reminder_exam}
                                description={hasExamDate ? t.settings_reminder_exam_hint : t.settings_reminder_exam_no_date}
                                checked={reminders.examCountdown}
                                disabled={!enabled}
                                onChange={(checked) => setReminder("examCountdown", checked)}
                            />
                            <SwitchRow
                                icon={ChartIcon}
                                title={t.settings_reminder_weekly}
                                description={t.settings_reminder_weekly_hint}
                                checked={reminders.weekly}
                                disabled={!enabled}
                                onChange={(checked) => setReminder("weekly", checked)}
                            />
                            <SwitchRow
                                icon={ClipboardCheckIcon}
                                title={t.settings_reminder_mock}
                                description={t.settings_reminder_mock_hint}
                                checked={reminders.mockNudge}
                                disabled={!enabled}
                                onChange={(checked) => setReminder("mockNudge", checked)}
                            />
                            <SwitchRow
                                icon={RouteIcon}
                                title={t.settings_reminder_comeback}
                                description={t.settings_reminder_comeback_hint}
                                checked={reminders.comeback}
                                disabled={!enabled}
                                onChange={(checked) => setReminder("comeback", checked)}
                            />
                        </SettingsFoldOut>
                    ) : null}

                    <div className="px-4 py-3">
                        <Button
                            variant="flat"
                            color="primary"
                            fullWidth
                            className="min-h-[44px]"
                            isDisabled={!enabled || permission !== "granted"}
                            isLoading={sending}
                            onPress={() => void sendTest()}
                            startContent={sending ? null : <BellIcon size={18} />}
                        >
                            {t.settings_test_notification}
                        </Button>
                    </div>
                </>
            )}

            <SwitchRow
                icon={LightbulbIcon}
                accent="secondary"
                title={t.settings_tips}
                description={t.settings_tips_hint}
                checked={prefs.tips}
                onChange={(checked) =>
                    setPref((draft) => {
                        draft.tips = checked;
                    })
                }
            />
        </SettingsSection>
    );
}
