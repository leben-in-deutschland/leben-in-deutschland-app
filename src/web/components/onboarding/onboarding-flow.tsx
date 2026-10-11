"use client";

import { Button, Switch } from "@heroui/react";
import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/shell/brand";
import { useFocusMode } from "@/components/shell/focus-mode";
import { useBackButton } from "@/components/shell/use-back-button";
import { StateList } from "@/components/preferences/state-list";
import { timeFromInput } from "@/components/preferences/preferences-logic";
import { TimeInput } from "@/components/preferences/settings-shared";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { InlineNotice } from "@/components/ui/feedback";
import { ArrowRightIcon, BellIcon, CheckIcon, ChevronLeftIcon, MapPinIcon, TargetIcon } from "@/components/ui/icons";
import { requestNotificationPermission, type NotificationPermission } from "@/services/notifications";
import type { State } from "@/types/state";
import { fmt, plural } from "@/utils/i18n";
import { DEFAULT_PREFERENCES } from "@/utils/user-defaults";
import { setUiMode } from "@/utils/ui-mode";
import { hasLanguageChoice, readUser, setAppLanguage, useAppLanguage, useIsNative, useTranslations, writeUser } from "@/utils/user-store";
import { completeOnboarding, deviceLanguage, goalLevels, onboardingSteps, RECOMMENDED_GOAL, type OnboardingStep } from "./onboarding-logic";

type Draft = {
    state: State | null;
    dailyGoal: number;
    remindersEnabled: boolean;
    reminderTime: string;
};

const INITIAL_DRAFT: Draft = {
    state: null,
    dailyGoal: RECOMMENDED_GOAL,
    remindersEnabled: false,
    reminderTime: DEFAULT_PREFERENCES.reminders.dailyTime,
};

/**
 * First-run setup: federal state (with the language), daily goal, and on
 * Android the daily reminder. The last step writes the learner record.
 */
export function OnboardingFlow() {
    const t = useTranslations();
    const language = useAppLanguage();
    const isNative = useIsNative();
    const steps = onboardingSteps(isNative);
    // Full-screen: the header and tab bar only make sense once a learner exists.
    useFocusMode(true);
    const [stepIndex, setStepIndex] = useState(0);
    const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
    const [permission, setPermission] = useState<NotificationPermission | null>(null);
    const [requesting, setRequesting] = useState(false);

    // A first visit starts in the device language; a record or an earlier choice wins.
    useEffect(() => {
        if (!hasLanguageChoice()) {
            setAppLanguage(deviceLanguage(window.navigator.language));
        }
    }, []);

    const index = Math.min(stepIndex, steps.length - 1);
    const step: OnboardingStep = steps[index];
    const last = index === steps.length - 1;
    const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
    const next = () => setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    const back = () => setStepIndex((current) => Math.max(current - 1, 0));
    useBackButton(back, stepIndex > 0);

    const toggleReminders = async (checked: boolean) => {
        if (!checked) {
            patch({ remindersEnabled: false });
            return;
        }
        setRequesting(true);
        try {
            const result = await requestNotificationPermission();
            setPermission(result);
            patch({ remindersEnabled: result === "granted" });
        } finally {
            setRequesting(false);
        }
    };

    /** Writes the record. "Not now" passes its own draft so the reminder choice is not read from a stale one. */
    const finish = (final: Draft = draft) => {
        if (!final.state) {
            setStepIndex(steps.indexOf("state"));
            return;
        }
        const record = completeOnboarding(readUser(), {
            state: final.state,
            language,
            dailyGoal: final.dailyGoal,
            remindersEnabled: isNative ? final.remindersEnabled : null,
            reminderTime: final.reminderTime,
        });
        // Whoever finishes onboarding uses the new design; stored first so the
        // finished record can never resolve to classic in between.
        setUiMode("modern");
        writeUser(record);
    };

    return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 py-4 sm:py-8">
            <OnboardingHeader
                current={index + 1}
                total={steps.length}
                showBack={index > 0}
                onBack={back}
                backLabel={t.common_back}
                stepLabel={fmt(t.onboarding_step_of, { current: index + 1, total: steps.length })}
            />

            <div key={step} className="animate-rise-in">
                {step === "state" ? (
                    <StepFrame
                        icon={MapPinIcon}
                        title={t.onboarding_state_title}
                        body={t.onboarding_state_body}
                        intro={<WelcomeLine language={language} />}
                        footer={
                            <PrimaryButton onPress={next} isDisabled={!draft.state}>
                                {t.common_continue}
                            </PrimaryButton>
                        }
                    >
                        <StateList
                            selectedCode={draft.state?.code}
                            onSelect={(state) => patch({ state })}
                            searchLabel={t.onboarding_state_search}
                            emptyLabel={t.settings_state_empty}
                            className="max-h-[50dvh]"
                        />
                    </StepFrame>
                ) : null}

                {step === "goal" ? (
                    <StepFrame
                        icon={TargetIcon}
                        title={t.onboarding_goal_title}
                        body={t.onboarding_goal_body}
                        footer={
                            <PrimaryButton onPress={last ? () => finish() : next}>
                                {last ? t.onboarding_done_start : t.common_continue}
                            </PrimaryButton>
                        }
                    >
                        <GoalOptions value={draft.dailyGoal} onChange={(dailyGoal) => patch({ dailyGoal })} />
                    </StepFrame>
                ) : null}

                {step === "reminders" ? (
                    <StepFrame
                        icon={BellIcon}
                        title={t.onboarding_reminders_title}
                        body={t.onboarding_reminders_body}
                        footer={
                            <div className="flex flex-col gap-2">
                                <PrimaryButton onPress={() => finish()} isDisabled={!draft.remindersEnabled || requesting}>
                                    {t.onboarding_done_start}
                                </PrimaryButton>
                                <Button variant="light" className="min-h-[44px]" onPress={() => finish({ ...draft, remindersEnabled: false })}>
                                    {t.onboarding_reminders_skip}
                                </Button>
                            </div>
                        }
                    >
                        <div className="flex flex-col gap-3 rounded-card bg-content1 p-4 shadow-card ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]">
                            <Switch
                                isSelected={draft.remindersEnabled}
                                isDisabled={requesting}
                                onValueChange={(checked) => void toggleReminders(checked)}
                                color="primary"
                                classNames={{
                                    base: "m-0 flex w-full max-w-none flex-row-reverse items-center justify-between gap-3 min-h-[44px] cursor-pointer",
                                    wrapper: "m-0",
                                    label: "ms-0 min-w-0 flex-1 text-foreground font-medium",
                                }}
                            >
                                {t.onboarding_reminders_switch}
                            </Switch>
                            <label className="flex items-center justify-between gap-3 text-sm text-default-600">
                                <span>{t.settings_reminder_time}</span>
                                <TimeInput
                                    label={t.settings_reminder_time}
                                    value={draft.reminderTime}
                                    onChange={(value) => patch({ reminderTime: timeFromInput(value, draft.reminderTime) })}
                                />
                            </label>
                            {permission === "denied" ? <InlineNotice tone="warning">{t.onboarding_reminders_denied}</InlineNotice> : null}
                        </div>
                    </StepFrame>
                ) : null}
            </div>
        </div>
    );
}

type OnboardingHeaderProps = {
    current: number;
    total: number;
    showBack: boolean;
    onBack: () => void;
    backLabel: string;
    stepLabel: string;
};

function OnboardingHeader({ current, total, showBack, onBack, backLabel, stepLabel }: OnboardingHeaderProps) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-24">
                {showBack ? (
                    <Button variant="light" size="sm" className="-ml-2 min-h-[44px] px-2 text-default-600" onPress={onBack} startContent={<ChevronLeftIcon size={18} />}>
                        {backLabel}
                    </Button>
                ) : null}
            </div>
            <div className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex gap-1.5" aria-hidden="true">
                    {Array.from({ length: total }, (_, i) => (
                        <span
                            key={i}
                            className={clsx("h-1.5 rounded-full transition-all", i < current ? "w-6 bg-primary" : "w-3 bg-default-200")}
                        />
                    ))}
                </div>
                <p className="text-xs font-medium text-default-500" aria-live="polite">
                    {stepLabel}
                </p>
            </div>
            <div className="w-24" />
        </div>
    );
}

type StepFrameProps = {
    icon: typeof MapPinIcon;
    title: string;
    body: string;
    /** Shown above the heading, e.g. the welcome line of the first step. */
    intro?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
};

function StepFrame({ icon: StepIcon, title, body, intro, children, footer }: StepFrameProps) {
    return (
        <div className="flex flex-col gap-5">
            {intro}
            <div className="flex flex-col gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700" aria-hidden="true">
                    <StepIcon size={22} />
                </span>
                <div>
                    <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">{title}</h1>
                    <p className="mt-1.5 text-[0.9375rem] text-default-500">{body}</p>
                </div>
            </div>
            {children}
            {footer}
        </div>
    );
}

function PrimaryButton({ children, onPress, isDisabled }: { children: ReactNode; onPress: () => void; isDisabled?: boolean }) {
    return (
        <Button color="primary" size="lg" className="min-h-[48px] font-semibold" onPress={onPress} isDisabled={isDisabled} endContent={<ArrowRightIcon size={18} />}>
            {children}
        </Button>
    );
}

/** Compact greeting with the language switch; the first thing a new learner sees. */
function WelcomeLine({ language }: { language: "de" | "en" }) {
    const t = useTranslations();
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                <BrandMark size={24} className="shrink-0" />
                <span>{t.onboarding_welcome}</span>
            </p>
            <ChoiceChips
                label={t.language_label}
                size="sm"
                value={language}
                onChange={(value) => setAppLanguage(value)}
                className="ml-auto"
                options={[
                    { value: "de", label: "Deutsch" },
                    { value: "en", label: "English" },
                ]}
            />
        </div>
    );
}

function GoalOptions({ value, onChange }: { value: number; onChange: (goal: number) => void }) {
    const t = useTranslations();
    return (
        <div role="radiogroup" aria-label={t.onboarding_goal_title} className="flex flex-col gap-2">
            {goalLevels().map((level) => {
                const selected = level.goal === value;
                return (
                    <button
                        key={level.goal}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(level.goal)}
                        className={clsx(
                            "flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-card transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.99]",
                            selected
                                ? "bg-gradient-to-br from-primary-50 to-content1 ring-2 ring-primary"
                                : "bg-content1 ring-1 ring-foreground/[0.06] hover:ring-default-400 dark:ring-white/[0.08]",
                        )}
                    >
                        <span
                            className={clsx(
                                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold tabular",
                                selected ? "bg-primary text-primary-foreground shadow-glow" : "bg-default-100 text-foreground",
                            )}
                        >
                            {level.goal}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-foreground">{t[level.labelKey]}</span>
                                {level.recommended ? (
                                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">{t.onboarding_goal_recommended}</span>
                                ) : null}
                            </span>
                            <span className="block text-sm text-default-500">
                                {plural(t, "common_questions", level.goal)} · {fmt(t.onboarding_goal_minutes, { count: level.minutes })}
                            </span>
                        </span>
                        {selected ? <CheckIcon size={20} className="shrink-0 text-primary" aria-hidden="true" /> : null}
                    </button>
                );
            })}
        </div>
    );
}
