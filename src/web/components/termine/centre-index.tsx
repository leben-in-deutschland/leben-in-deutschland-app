import type { ReactNode } from "react";
import type { RegistryCentre } from "@/types/termine";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { StateTowns } from "@/utils/termine-logic";

/*
 * What the exam-dates page shows where the dates will be: in the page as it
 * is built - what a visitor sees first and what a search engine reads that
 * runs no script - and when the dates cannot be loaded. Both lists come from
 * the registry of the dates sync and hold no date. The markup is kept small:
 * it is repeated for every centre in every built page.
 */

type IndexProps = {
    title: string;
    hint: string;
    children: ReactNode;
};

function Index({ title, hint, children }: IndexProps) {
    return (
        <section aria-labelledby="termine-index-title" className="flex flex-col gap-3" data-testid="termine-index">
            <SectionHeading id="termine-index-title" title={title} description={hint} />
            {children}
        </section>
    );
}

type CentreIndexProps = Omit<IndexProps, "children"> & {
    centres: RegistryCentre[];
    /** State names by upper-case code; given when the list spans several states, so every row names its own. */
    stateNames?: ReadonlyMap<string, string>;
};

/** The centres of the registry by town, each with the way to its own page. */
export function CentreIndex({ centres, stateNames, ...heading }: CentreIndexProps) {
    return (
        <Index {...heading}>
            <Surface as="ul" padding="sm" className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
                {centres.map((centre) => {
                    const stateName = stateNames?.get(centre.state);
                    return (
                        <li key={centre.id} data-testid={`termine-index-${centre.id}`}>
                            <a href={centre.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] flex-col justify-center rounded-lg py-1 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                                <span className="text-xs font-medium uppercase tracking-wide text-default-500">{stateName ? `${centre.city} · ${stateName}` : centre.city}</span>
                                <span className="font-semibold leading-snug">{centre.name}</span>
                            </a>
                        </li>
                    );
                })}
            </Surface>
        </Index>
    );
}

type TownDirectoryProps = Omit<IndexProps, "children"> & {
    states: StateTowns[];
    /** The link that opens a state's page. */
    stateLink: (state: StateTowns) => ReactNode;
    countLabel: (centres: number) => string;
};

/** Every state the sync reads centres in, with the towns of those centres. */
export function TownDirectory({ states, stateLink, countLabel, ...heading }: TownDirectoryProps) {
    return (
        <Index {...heading}>
            <Surface as="ul" padding="sm" className="flex flex-col gap-3">
                {states.map((state) => (
                    <li key={state.code} data-testid={`termine-directory-${state.code}`}>
                        <p className="text-sm">
                            {stateLink(state)}
                            <span className="text-default-500"> · {countLabel(state.centres)}</span>
                        </p>
                        <p className="text-sm leading-relaxed text-default-600">{state.towns.join(", ")}</p>
                    </li>
                ))}
            </Surface>
        </Index>
    );
}
