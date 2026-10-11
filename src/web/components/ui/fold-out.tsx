"use client";

import clsx from "clsx";
import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";

type FoldOutProps = {
    /** Short label on the toggle, for example "Fine-tune" or "More modes". */
    title: string;
    /** Optional one-line status next to the title, for example "4 of 8 on". */
    summary?: ReactNode;
    /** Content stays out of the DOM while folded, so hidden controls never catch focus. */
    children: ReactNode;
    defaultOpen?: boolean;
    /** Controlled mode; leave undefined to let the fold-out keep its own state. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** "row" sits inside a card list; "card" stands alone with its own surface. */
    variant?: "row" | "card";
    className?: string;
    contentClassName?: string;
    "data-testid"?: string;
};

/**
 * Progressive disclosure for advanced options.
 * One accessible button toggles a region; the chevron turns and the panel
 * rises in with the shared `animate-rise-in` keyframes (disabled under
 * reduced motion by globals.css).
 */
export function FoldOut({
    title,
    summary,
    children,
    defaultOpen = false,
    open: controlledOpen,
    onOpenChange,
    variant = "row",
    className,
    contentClassName,
    "data-testid": testId,
}: FoldOutProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = controlledOpen ?? uncontrolledOpen;
    const regionId = useId();
    const buttonId = useId();

    const toggle = () => {
        const next = !open;
        if (controlledOpen === undefined) {
            setUncontrolledOpen(next);
        }
        onOpenChange?.(next);
    };

    return (
        <div
            className={clsx(
                variant === "card" && "rounded-card bg-content2/60 ring-1 ring-inset ring-foreground/[0.05] dark:ring-white/[0.06]",
                className,
            )}
            data-testid={testId}
        >
            <button
                id={buttonId}
                type="button"
                aria-expanded={open}
                aria-controls={open ? regionId : undefined}
                onClick={toggle}
                className={clsx(
                    "flex w-full items-center justify-between gap-3 text-left min-h-[44px] rounded-xl px-1 -mx-1 py-2",
                    "text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                    variant === "card" && "px-4 mx-0 py-3",
                )}
            >
                <span className="flex min-w-0 flex-col">
                    <span>{title}</span>
                    {summary ? <span className="text-xs font-normal text-default-500">{summary}</span> : null}
                </span>
                <ChevronDownIcon
                    aria-hidden="true"
                    className={clsx("h-5 w-5 shrink-0 text-default-400 transition-transform duration-200", open && "rotate-180")}
                />
            </button>
            {open ? (
                <div
                    id={regionId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={clsx("animate-rise-in", variant === "card" ? "px-4 pb-4" : "pt-1", contentClassName)}
                >
                    {children}
                </div>
            ) : null}
        </div>
    );
}
