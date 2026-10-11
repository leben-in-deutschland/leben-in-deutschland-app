"use client";

import { Button, Chip } from "@heroui/react";
import clsx from "clsx";
import { FlagIcon, XIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { fmt, type Translations } from "@/utils/i18n";

type SessionTopBarProps = {
    title: string;
    /** 1-based position of the current question. */
    current: number;
    total: number;
    flagged: boolean;
    onClose: () => void;
    onToggleFlag: () => void;
    t: Translations;
};

/** Compact bar of the focus layout: leave, where you are, and the flag. */
export function SessionTopBar({ title, current, total, flagged, onClose, onToggleFlag, t }: SessionTopBarProps) {
    return (
        <div className="sticky top-0 z-30 -mx-4 bg-background/75 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
            <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-1">
                <Button
                    isIconOnly
                    variant="light"
                    aria-label={t.practice_close}
                    onPress={onClose}
                    className="-ml-2 h-11 w-11 min-w-11 text-default-600"
                >
                    <XIcon size={22} aria-hidden="true" />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate font-display text-sm font-semibold leading-tight text-foreground">{title}</p>
                    <div className="mt-0.5 flex items-center justify-center gap-1.5 text-xs tabular text-default-500">
                        <span aria-label={fmt(t.practice_progress_aria, { current, total })}>
                            {current} / {total}
                        </span>
                        {flagged ? (
                            <Chip size="sm" color="warning" variant="flat" className="h-4 px-1 text-[0.625rem] font-semibold uppercase tracking-wide">
                                {t.common_flagged}
                            </Chip>
                        ) : null}
                    </div>
                </div>
                <Button
                    isIconOnly
                    variant="light"
                    aria-label={flagged ? t.practice_unflag : t.flag_for_review}
                    aria-pressed={flagged}
                    onPress={onToggleFlag}
                    className={clsx("-mr-2 h-11 w-11 min-w-11", flagged ? "text-warning-600" : "text-default-500")}
                >
                    <FlagIcon size={22} aria-hidden="true" className={flagged ? "fill-current" : undefined} />
                </Button>
            </div>
            <ProgressBar value={total > 0 ? current / total : 0} size="sm" label={fmt(t.practice_progress_aria, { current, total })} />
        </div>
    );
}
