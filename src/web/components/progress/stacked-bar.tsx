import clsx from "clsx";
import type { ReactNode } from "react";

export type BarSegment = {
    key: string;
    value: number;
    /** Background class of the segment and of its legend dot, e.g. "bg-success". */
    className: string;
    label: ReactNode;
};

type StackedBarProps = {
    segments: BarSegment[];
    /** Sum the bar represents; segments beyond it are clipped. */
    total: number;
    /** Accessible summary, e.g. "Answers: 120 correct, 30 wrong". */
    label: string;
    size?: "sm" | "md";
    /** Hide legend entries whose value is zero. */
    hideEmpty?: boolean;
    className?: string;
};

/** One horizontal bar split into colored parts, with a legend underneath. */
export function StackedBar({ segments, total, label, size = "md", hideEmpty = false, className }: StackedBarProps) {
    const safeTotal = total > 0 ? total : 1;
    return (
        <div className={className}>
            <div
                role="img"
                aria-label={label}
                className={clsx("flex w-full overflow-hidden rounded-full bg-default-100", size === "sm" ? "h-2" : "h-3")}
            >
                {segments.map((segment) =>
                    segment.value > 0 ? (
                        <div
                            key={segment.key}
                            className={clsx("h-full transition-[width] duration-500 ease-out", segment.className)}
                            style={{ width: `${Math.min(100, (segment.value / safeTotal) * 100)}%` }}
                        />
                    ) : null,
                )}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:flex sm:flex-wrap">
                {segments.map((segment) =>
                    hideEmpty && segment.value === 0 ? null : (
                        <li key={segment.key} className="flex min-w-0 items-center gap-2">
                            <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", segment.className)} aria-hidden="true" />
                            <span className="truncate text-default-600">{segment.label}</span>
                            <span className="ml-auto font-semibold tabular text-foreground sm:ml-0">{segment.value}</span>
                        </li>
                    ),
                )}
            </ul>
        </div>
    );
}
