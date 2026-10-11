"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { CheckIcon, XIcon } from "@/components/ui/icons";

/**
 * How one answer looks:
 * - idle: not chosen
 * - selected: chosen, not graded (mock exam, or practice with "check" step)
 * - correct: chosen and right
 * - wrong: chosen and wrong
 * - reveal: the right answer, shown after a wrong choice
 * - dimmed: any other answer after grading
 */
export type AnswerState = "idle" | "selected" | "correct" | "wrong" | "reveal" | "dimmed";

type AnswerOptionProps = {
    /** "a" to "d". Shown as A to D. */
    letter: string;
    children: ReactNode;
    state?: AnswerState;
    onSelect?: () => void;
    disabled?: boolean;
    /** Screen-reader suffix such as "correct answer". */
    srStatus?: string;
};

const containerStyles: Record<AnswerState, string> = {
    idle: "bg-content1 shadow-card ring-1 ring-foreground/[0.07] hover:-translate-y-px hover:shadow-raised hover:ring-default-400 dark:ring-white/[0.09]",
    selected: "bg-gradient-to-br from-primary-50 to-content1 shadow-card ring-2 ring-primary",
    correct: "bg-gradient-to-br from-success-50 to-content1 shadow-card ring-2 ring-success",
    wrong: "bg-gradient-to-br from-danger-50 to-content1 shadow-card ring-2 ring-danger motion-safe:animate-shake",
    reveal: "bg-success-50/60 ring-2 ring-success/60",
    dimmed: "bg-content1 opacity-55 ring-1 ring-foreground/[0.05]",
};

const badgeStyles: Record<AnswerState, string> = {
    idle: "bg-default-100 text-default-600 ring-1 ring-inset ring-foreground/[0.08] group-hover:bg-primary-50 group-hover:text-primary-700",
    selected: "bg-primary text-primary-foreground shadow-glow",
    correct: "bg-success text-success-foreground",
    wrong: "bg-danger text-danger-foreground",
    reveal: "bg-success-100 text-success-700 ring-1 ring-inset ring-success/40",
    dimmed: "bg-default-100 text-default-500",
};

/** One large, tappable answer row (at least 56 px tall). */
export function AnswerOption({ letter, children, state = "idle", onSelect, disabled, srStatus }: AnswerOptionProps) {
    const graded = state === "correct" || state === "wrong" || state === "reveal" || state === "dimmed";
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            aria-pressed={state === "selected" || state === "correct" || state === "wrong"}
            className={clsx(
                "group flex min-h-[60px] w-full items-start gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-[background-color,box-shadow,opacity,transform] duration-200 ease-out",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                containerStyles[state],
                !graded && !disabled && "active:translate-y-0 active:scale-[0.99] active:shadow-card",
                disabled && !graded && "cursor-not-allowed opacity-60",
            )}
        >
            <span
                className={clsx(
                    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] font-display text-[0.9375rem] font-bold uppercase transition-colors duration-200",
                    badgeStyles[state],
                )}
                aria-hidden="true"
            >
                {letter}
            </span>
            <span className="answer-text min-w-0 flex-1 pt-1 text-foreground">{children}</span>
            {state === "correct" || state === "reveal" ? (
                <span
                    className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground motion-safe:animate-pop-in"
                    aria-hidden="true"
                >
                    <CheckIcon size={14} strokeWidth={3} />
                </span>
            ) : null}
            {state === "wrong" ? (
                <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger text-danger-foreground" aria-hidden="true">
                    <XIcon size={14} strokeWidth={3} />
                </span>
            ) : null}
            {srStatus ? <span className="sr-only">{srStatus}</span> : null}
        </button>
    );
}
