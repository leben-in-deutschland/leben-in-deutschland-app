"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { AppLink } from "./app-link";
import { ChevronRightIcon } from "./icons";

type ListRowProps = {
    title: ReactNode;
    description?: ReactNode;
    /** Usually an <IconBadge />. */
    leading?: ReactNode;
    /** Content on the right; defaults to a chevron when the row is interactive. */
    trailing?: ReactNode;
    /** In-app route; renders a link. */
    href?: string;
    onPress?: () => void;
    disabled?: boolean;
    className?: string;
};

/** A full-width row for lists and settings. Interactive rows are at least 56 px tall. */
export function ListRow({ title, description, leading, trailing, href, onPress, disabled, className }: ListRowProps) {
    const interactive = Boolean(href || onPress) && !disabled;
    const content = (
        <>
            {leading}
            <span className="min-w-0 flex-1">
                <span className="block font-medium leading-snug text-foreground">{title}</span>
                {description ? <span className="mt-0.5 block text-sm leading-snug text-default-500">{description}</span> : null}
            </span>
            {trailing ?? (interactive ? <ChevronRightIcon size={18} className="shrink-0 text-default-400" /> : null)}
        </>
    );
    const classes = clsx(
        "flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left",
        interactive && "transition-colors hover:bg-default-100 active:bg-default-200",
        disabled && "opacity-45",
        className,
    );

    if (href && !disabled) {
        return (
            <AppLink href={href} className={classes}>
                {content}
            </AppLink>
        );
    }
    if (onPress) {
        return (
            <button type="button" onClick={onPress} disabled={disabled} className={classes}>
                {content}
            </button>
        );
    }
    return <div className={classes}>{content}</div>;
}
