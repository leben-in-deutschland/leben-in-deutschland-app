"use client";

import clsx from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import type { State } from "@/types/state";
import { AppLink } from "@/components/ui/app-link";
import { GermanFlag, StateFlag } from "@/components/ui/state-flag";

type StatePickerProps = {
    /** Accessible name of the list. */
    label: string;
    states: State[];
    /** Upper-case code of the selected state, or "" for the general entry. */
    current: string;
    hrefFor: (code: string) => string;
    /** When set, the entries are buttons that call this instead of links: one page that switches in place. */
    onSelect?: (code: string) => void;
    /** When set, a first entry for "no state" (e.g. the general questions). */
    allLabel?: string;
    className?: string;
};

const chipClass = "inline-flex min-h-[48px] shrink-0 snap-start items-center gap-2.5 whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-semibold transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const idleClass = "bg-content1 text-foreground shadow-card ring-1 ring-foreground/[0.07] hover:ring-default-400 dark:ring-white/[0.09]";
const activeClass = "bg-primary text-primary-foreground shadow-glow";

type EntryProps = {
    code: string;
    active: boolean;
    hrefFor: (code: string) => string;
    onSelect?: (code: string) => void;
    name?: string;
    children: ReactNode;
};

function Entry({ code, active, hrefFor, onSelect, name, children }: EntryProps) {
    const className = clsx(chipClass, active ? activeClass : idleClass);
    if (onSelect) {
        return (
            <button type="button" onClick={() => onSelect(code)} aria-pressed={active} title={name} className={className}>
                {children}
            </button>
        );
    }
    return (
        <AppLink href={hrefFor(code)} aria-current={active ? "page" : undefined} title={name} className={className}>
            {children}
        </AppLink>
    );
}

/**
 * Row of state links (or buttons, with `onSelect`), each with the state's
 * flag and full name; the current state is highlighted. On a phone the row
 * moves sideways, and the current state is brought into view.
 */
export function StatePicker({ label, states, current, hrefFor, onSelect, allLabel, className }: StatePickerProps) {
    const row = useRef<HTMLElement>(null);

    useEffect(() => {
        const nav = row.current;
        const chip = nav?.querySelector<HTMLElement>("[aria-current='page'], [aria-pressed='true']");
        if (!nav || !chip || nav.scrollWidth <= nav.clientWidth) {
            return;
        }
        const box = nav.getBoundingClientRect();
        const entry = chip.getBoundingClientRect();
        if (entry.left >= box.left && entry.right <= box.right) {
            return;
        }
        // Only the row moves; `scrollIntoView` would move the page as well.
        nav.scrollLeft += entry.left - box.left - (box.width - entry.width) / 2;
    }, [current]);

    return (
        <nav ref={row} aria-label={label} className={clsx("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
            <ul className="flex snap-x gap-2 pb-1 sm:flex-wrap">
                {allLabel ? (
                    <li className="shrink-0">
                        <Entry code="" active={current === ""} hrefFor={hrefFor} onSelect={onSelect}>
                            <GermanFlag onColor={current === ""} />
                            {allLabel}
                        </Entry>
                    </li>
                ) : null}
                {states.map((state) => {
                    const code = state.code.toUpperCase();
                    const active = code === current;
                    return (
                        <li key={code} className="shrink-0">
                            <Entry code={code} active={active} hrefFor={hrefFor} onSelect={onSelect} name={state.name}>
                                <StateFlag name={state.name} onColor={active} />
                                {state.name}
                            </Entry>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
