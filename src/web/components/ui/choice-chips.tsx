"use client";

import clsx from "clsx";
import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type ChoiceOption<T extends string | number> = {
    value: T;
    label: ReactNode;
    /** Optional second line under the label. */
    hint?: ReactNode;
    disabled?: boolean;
};

type ChoiceChipsProps<T extends string | number> = {
    options: ChoiceOption<T>[];
    value: T;
    onChange: (value: T) => void;
    /** Accessible name of the group. */
    label: string;
    size?: "sm" | "md";
    /** Stretch options to fill the row. */
    fill?: boolean;
    className?: string;
};

/** Single choice from a few options (radio group with chip styling). */
export function ChoiceChips<T extends string | number>({
    options,
    value,
    onChange,
    label,
    size = "md",
    fill = false,
    className,
}: ChoiceChipsProps<T>) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

    const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        const step = keys[event.key];
        if (!step) {
            return;
        }
        event.preventDefault();
        let next = index;
        for (let i = 0; i < options.length; i++) {
            next = (next + step + options.length) % options.length;
            if (!options[next].disabled) {
                break;
            }
        }
        onChange(options[next].value);
        refs.current[next]?.focus();
    };

    return (
        <div role="radiogroup" aria-label={label} className={clsx("flex flex-wrap gap-2", className)}>
            {options.map((option, index) => {
                const selected = option.value === value;
                return (
                    <button
                        key={String(option.value)}
                        ref={(element) => {
                            refs.current[index] = element;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={index === selectedIndex ? 0 : -1}
                        disabled={option.disabled}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(event) => move(event, index)}
                        className={clsx(
                            "flex min-h-[44px] flex-col items-center justify-center rounded-[14px] px-3.5 text-center transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.98]",
                            size === "sm" ? "py-1.5 text-sm" : "py-2 text-[0.9375rem]",
                            fill && "flex-1",
                            selected
                                ? "bg-primary text-primary-foreground shadow-glow"
                                : "bg-content1 text-foreground shadow-card ring-1 ring-foreground/[0.07] hover:ring-default-400 dark:ring-white/[0.09]",
                            option.disabled && "cursor-not-allowed opacity-45",
                        )}
                    >
                        <span className="font-semibold leading-tight">{option.label}</span>
                        {option.hint ? (
                            <span className={clsx("mt-0.5 text-xs leading-tight", selected ? "text-primary-foreground/80" : "text-default-500")}>
                                {option.hint}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
