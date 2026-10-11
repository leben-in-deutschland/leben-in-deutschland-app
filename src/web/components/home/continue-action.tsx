"use client";

import { Button } from "@heroui/react";
import { AppLink } from "@/components/ui/app-link";
import { ArrowRightIcon, ClipboardCheckIcon, Icon, ZapIcon } from "@/components/ui/icons";
import { fmt, plural, type Translations } from "@/utils/i18n";
import { EXAM_QUESTION_COUNT } from "@/utils/question-bank";
import { getStudyMode, modeHref, type NextAction } from "@/utils/study-modes";

type ContinueActionProps = {
    action: NextAction;
    t: Translations;
};

/** The one big "do this next" button; it lives inside the pass card. */
export function ContinueAction({ action, t }: ContinueActionProps) {
    const mode = action.kind === "mode" ? getStudyMode(action.mode) : null;
    const href = mode ? modeHref(mode.id) : "/mock";
    const title = mode ? t[mode.titleKey] : t.home_continue_mock_title;
    const detail =
        action.kind === "mode"
            ? plural(t, "common_questions", action.count)
            : fmt(t.home_continue_mock_hint, { count: EXAM_QUESTION_COUNT });

    return (
        <Button
            as={AppLink}
            href={href}
            color="secondary"
            size="lg"
            fullWidth
            radius="lg"
            className="h-auto min-h-14 justify-between gap-3 px-4 py-3 shadow-glow-gold"
            endContent={<ArrowRightIcon size={20} className="shrink-0" aria-hidden="true" />}
        >
            <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/15 ring-1 ring-inset ring-white/20" aria-hidden="true">
                    {mode ? <Icon name={mode.icon} size={20} /> : <ClipboardCheckIcon size={20} />}
                </span>
                <span className="min-w-0 text-left">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-75">{t.home_continue_label}</span>
                    <span className="block truncate font-display text-base font-semibold leading-tight">{title}</span>
                    <span className="block text-xs font-medium tabular opacity-80">{detail}</span>
                </span>
            </span>
        </Button>
    );
}

/** Two smaller shortcuts under the pass card. */
export function QuickActions({ t }: { t: Translations }) {
    return (
        <nav aria-label={t.home_actions_aria} className="grid grid-cols-2 gap-3">
            <Button
                as={AppLink}
                href={modeHref("quick")}
                variant="flat"
                color="primary"
                radius="full"
                className="h-12 font-semibold shadow-card"
                startContent={<ZapIcon size={18} aria-hidden="true" />}
            >
                {t.mode_quick_title}
            </Button>
            <Button
                as={AppLink}
                href="/mock"
                variant="flat"
                color="default"
                radius="full"
                className="h-12 bg-content1 font-semibold shadow-card ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]"
                startContent={<ClipboardCheckIcon size={18} aria-hidden="true" />}
            >
                {t.main_mock_title}
            </Button>
        </nav>
    );
}
