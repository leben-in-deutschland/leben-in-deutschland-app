"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { AppLink } from "@/components/ui/app-link";

type LinkButtonProps = {
    /** In-app route. */
    href: string;
    children: ReactNode;
    variant?: "solid" | "flat" | "bordered" | "light";
    size?: "sm" | "md";
    className?: string;
    "aria-label"?: string;
};

const variantClasses: Record<NonNullable<LinkButtonProps["variant"]>, string> = {
    solid: "bg-primary text-primary-foreground hover:bg-primary-600 active:bg-primary-700",
    flat: "bg-primary-50 text-primary-700 hover:bg-primary-100",
    bordered: "bg-content1 text-foreground shadow-card ring-1 ring-foreground/[0.07] hover:bg-default-50 dark:ring-white/[0.09]",
    light: "text-primary hover:bg-primary-50",
};

const sizeClasses: Record<NonNullable<LinkButtonProps["size"]>, string> = {
    sm: "h-9 gap-1.5 rounded-lg px-3 text-sm",
    md: "h-11 gap-2 rounded-xl px-4 text-[0.9375rem]",
};

/** A link that looks like a button; works on the web and inside the Android app. */
export function LinkButton({ href, children, variant = "flat", size = "md", className, ...props }: LinkButtonProps) {
    return (
        <AppLink
            href={href}
            className={clsx(
                "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-colors",
                variantClasses[variant],
                sizeClasses[size],
                className,
            )}
            aria-label={props["aria-label"]}
        >
            {children}
        </AppLink>
    );
}
