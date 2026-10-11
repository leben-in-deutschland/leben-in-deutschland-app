import clsx from "clsx";
import type { ReactNode } from "react";

function clamp01(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}

type ProgressRingProps = {
    /** 0 to 1. */
    value: number;
    size?: number;
    strokeWidth?: number;
    /** Text color class for the track, e.g. "text-default-200". */
    trackClassName?: string;
    /** Text color class for the filled arc, e.g. "text-primary". */
    indicatorClassName?: string;
    /** Accessible description, e.g. "Readiness 72 percent". */
    label?: string;
    className?: string;
    children?: ReactNode;
};

/** Circular progress with content in the middle. */
export function ProgressRing({
    value,
    size = 64,
    strokeWidth = 6,
    trackClassName = "text-default-200",
    indicatorClassName = "text-primary",
    label,
    className,
    children,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - clamp01(value));
    return (
        <div
            className={clsx("relative inline-grid shrink-0 place-items-center", className)}
            style={{ width: size, height: size }}
            role={label ? "img" : undefined}
            aria-label={label}
        >
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className={trackClassName}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={indicatorClassName}
                    style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
                />
            </svg>
            {children ? <div className="absolute inset-0 grid place-items-center">{children}</div> : null}
        </div>
    );
}

type ProgressBarProps = {
    /** 0 to 1. */
    value: number;
    label?: string;
    size?: "sm" | "md";
    trackClassName?: string;
    indicatorClassName?: string;
    className?: string;
};

/** Thin horizontal progress bar. */
export function ProgressBar({
    value,
    label,
    size = "md",
    trackClassName = "bg-default-200/70",
    indicatorClassName = "bg-gradient-to-r from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-500",
    className,
}: ProgressBarProps) {
    const percent = Math.round(clamp01(value) * 100);
    return (
        <div
            className={clsx("w-full overflow-hidden rounded-full", size === "sm" ? "h-1.5" : "h-2.5", trackClassName, className)}
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
        >
            <div
                className={clsx("h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]", indicatorClassName)}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}
