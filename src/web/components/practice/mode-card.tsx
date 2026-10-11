"use client";

import { Button, Chip } from "@heroui/react";
import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { AppLink } from "@/components/ui/app-link";
import { ACCENT_TINT, IconBadge } from "@/components/ui/icon-badge";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Surface } from "@/components/ui/surface";
import type { StudyModeDef } from "@/utils/study-modes";

type ModeCardProps = {
    mode: StudyModeDef;
    title: string;
    description: string;
    /** Second line under the description, e.g. "12 questions" or "nothing here yet". */
    meta: ReactNode;
    recommended?: boolean;
    recommendedLabel: string;
    disabled?: boolean;
    actionLabel: string;
    /** Route the action opens. Ignored when `onPress` is set. */
    href?: string;
    onPress?: () => void;
    style?: CSSProperties;
};

/** One study mode on the practice hub: icon, title, what it does, and a start button. */
export function ModeCard({
    mode,
    title,
    description,
    meta,
    recommended = false,
    recommendedLabel,
    disabled = false,
    actionLabel,
    href,
    onPress,
    style,
}: ModeCardProps) {
    const titleId = `mode-${mode.id}-title`;
    return (
        <Surface
            as="article"
            padding="sm"
            aria-labelledby={titleId}
            aria-disabled={disabled || undefined}
            style={style}
            className={clsx(
                "flex h-full flex-col gap-3 bg-gradient-to-br via-content1 to-content1 animate-rise-in",
                ACCENT_TINT[mode.accent],
                recommended && "ring-2 ring-primary shadow-glow",
                disabled && "opacity-60",
            )}
        >
            <div className="flex items-start gap-3">
                <IconBadge icon={mode.icon} accent={mode.accent} size="lg" solid={recommended} />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 id={titleId} className="font-display text-[1.0625rem] font-bold leading-tight text-foreground">
                            {title}
                        </h3>
                        {recommended ? (
                            <Chip size="sm" color="primary" variant="flat" className="h-5 text-[0.6875rem] font-semibold uppercase tracking-wide">
                                {recommendedLabel}
                            </Chip>
                        ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-snug text-default-500">{description}</p>
                </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-3">
                <span className="text-sm font-medium tabular text-default-600">{meta}</span>
                {disabled ? null : onPress ? (
                    <Button
                        size="sm"
                        color={recommended ? "primary" : "default"}
                        variant={recommended ? "solid" : "flat"}
                        onPress={onPress}
                        radius="full"
                        className="h-11 shrink-0 px-4 font-semibold"
                        endContent={<ArrowRightIcon size={16} aria-hidden="true" />}
                    >
                        {actionLabel}
                    </Button>
                ) : (
                    <Button
                        as={AppLink}
                        href={href ?? "/practice"}
                        size="sm"
                        color={recommended ? "primary" : "default"}
                        variant={recommended ? "solid" : "flat"}
                        radius="full"
                        className="h-11 shrink-0 px-4 font-semibold"
                        endContent={<ArrowRightIcon size={16} aria-hidden="true" />}
                    >
                        {actionLabel}
                    </Button>
                )}
            </div>
        </Surface>
    );
}
