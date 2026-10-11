"use client";

import { Input } from "@heroui/react";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { statesData } from "@/data/data";
import type { State } from "@/types/state";
import { CheckIcon, SearchIcon } from "@/components/ui/icons";

type StateListProps = {
    /** Code of the currently selected state, if any. */
    selectedCode?: string | null;
    onSelect: (state: State) => void;
    searchLabel: string;
    emptyLabel: string;
    /** Focus the search field when mounted (desktop; on touch devices this would open the keyboard). */
    autoFocus?: boolean;
    className?: string;
};

/** Filters states by German name, English name or capital. */
export function filterStates(states: readonly State[], query: string): State[] {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return [...states];
    }
    return states.filter((state) => `${state.name} ${state.eng} ${state.capital}`.toLowerCase().includes(needle));
}

/** Searchable list of the 16 federal states with coat of arms; rows are 56 px tall. */
export function StateList({ selectedCode, onSelect, searchLabel, emptyLabel, autoFocus = false, className }: StateListProps) {
    const [query, setQuery] = useState("");
    const states = useMemo(() => statesData(), []);
    const filtered = filterStates(states, query);

    return (
        <div className={clsx("flex min-h-0 flex-col gap-3", className)}>
            <Input
                value={query}
                onValueChange={setQuery}
                placeholder={searchLabel}
                aria-label={searchLabel}
                autoFocus={autoFocus}
                isClearable
                onClear={() => setQuery("")}
                startContent={<SearchIcon size={18} className="text-default-400" />}
                variant="bordered"
                radius="lg"
                classNames={{ inputWrapper: "min-h-[48px] bg-content1" }}
            />
            <ul className="min-h-0 flex-1 divide-y divide-divider overflow-y-auto rounded-card bg-content1 shadow-card ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]" role="listbox" aria-label={searchLabel}>
                {filtered.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-default-500">{emptyLabel}</li>
                ) : (
                    filtered.map((state) => {
                        const selected = state.code === selectedCode;
                        return (
                            <li key={state.code} role="option" aria-selected={selected}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(state)}
                                    className={clsx(
                                        "flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-default-100 active:bg-default-200",
                                        selected && "bg-primary-50",
                                    )}
                                >
                                    {/* Static SVG from /public; next/image is not used in the static export. */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`/states/coat-of-arms/${state.name}.svg`} alt="" width={32} height={36} className="h-9 w-8 shrink-0 object-contain" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium leading-snug text-foreground">{state.name}</span>
                                        <span className="block text-sm leading-snug text-default-500">{state.eng && state.eng !== state.name ? `${state.eng} · ` : ""}{state.capital}</span>
                                    </span>
                                    {selected ? <CheckIcon size={20} className="shrink-0 text-primary" aria-hidden="true" /> : null}
                                </button>
                            </li>
                        );
                    })
                )}
            </ul>
        </div>
    );
}
