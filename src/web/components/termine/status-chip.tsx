import clsx from "clsx";
import type { CentreSummary } from "@/utils/termine-logic";
import type { Translations } from "@/utils/i18n";

/*
 * HeroUI color scales run light-to-dark in the light theme and dark-to-light
 * in the dark theme, so "bg-x-100 text-x-800" reads well in both.
 */
const TONE: Record<CentreSummary, string> = {
    free: "bg-success-100 text-success-800",
    few: "bg-warning-100 text-warning-800",
    waitlist: "bg-warning-50 text-warning-800",
    soon: "bg-primary-50 text-primary-700",
    unknown: "bg-default-100 text-default-700",
    full: "bg-danger-50 text-danger-700",
    closed: "bg-default-100 text-default-500",
    none: "bg-default-100 text-default-500",
};

type StatusChipProps = {
    status: CentreSummary;
    t: Translations;
    size?: "sm" | "md";
    className?: string;
};

/** What is known about places, in words: the colour only supports the text. */
export function StatusChip({ status, t, size = "md", className }: StatusChipProps) {
    return (
        <span
            className={clsx(
                "inline-flex shrink-0 items-center rounded-full font-semibold leading-none",
                size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[0.8125rem]",
                TONE[status],
                className,
            )}
        >
            {t[`termine_status_${status}`]}
        </span>
    );
}
