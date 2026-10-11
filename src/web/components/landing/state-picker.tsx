"use client";

import clsx from "clsx";
import type { State } from "@/types/state";
import { AppLink } from "@/components/ui/app-link";

type StatePickerProps = {
    /** Accessible name of the list. */
    label: string;
    states: State[];
    /** Upper-case code of the selected state, or "" for the general entry. */
    current: string;
    hrefFor: (code: string) => string;
    /** When set, a first entry for "no state" (e.g. the general questions). */
    allLabel?: string;
    className?: string;
};

const chipClass = "inline-flex min-h-[44px] shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const idleClass = "bg-content1 text-foreground shadow-card ring-1 ring-foreground/[0.07] hover:ring-default-400 dark:ring-white/[0.09]";
const activeClass = "bg-primary text-primary-foreground shadow-glow";

/** Horizontal row of state links; the current state is highlighted. */
export function StatePicker({ label, states, current, hrefFor, allLabel, className }: StatePickerProps) {
    return (
        <nav aria-label={label} className={clsx("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
            <ul className="flex snap-x gap-2 pb-1 sm:flex-wrap">
                {allLabel ? (
                    <li>
                        <AppLink href={hrefFor("")} aria-current={current === "" ? "page" : undefined} className={clsx(chipClass, current === "" ? activeClass : idleClass)}>
                            {allLabel}
                        </AppLink>
                    </li>
                ) : null}
                {states.map((state) => {
                    const code = state.code.toUpperCase();
                    const active = code === current;
                    return (
                        <li key={code}>
                            <AppLink href={hrefFor(code)} aria-current={active ? "page" : undefined} aria-label={state.name} title={state.name} className={clsx(chipClass, active ? activeClass : idleClass)}>
                                <span className="tabular">{code}</span>
                                <span className={clsx("hidden text-xs font-medium lg:inline", active ? "text-primary-foreground/80" : "text-default-500")}>{state.name}</span>
                            </AppLink>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
