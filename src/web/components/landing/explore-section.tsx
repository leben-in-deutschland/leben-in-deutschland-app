import type { State } from "@/types/state";
import { AppLink } from "@/components/ui/app-link";
import { ArrowRightIcon, BookOpenIcon, MapPinIcon } from "@/components/ui/icons";
import { Surface } from "@/components/ui/surface";
import type { Translations } from "@/utils/i18n";
import { LandingSection } from "./landing-primitives";

const linkClass =
    "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-content2 px-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary-50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Every state with links to its question catalogue and exam centres. */
export function ExploreSection({ t, states }: { t: Translations; states: State[] }) {
    return (
        <LandingSection id="explore" eyebrow={t.landing_explore_eyebrow} title={t.landing_explore_title} description={t.landing_explore_subtitle}>
            <Surface tone="sunken" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <BookOpenIcon size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                        <p className="font-semibold text-foreground">{t.landing_explore_general_title}</p>
                        <p className="text-sm text-default-500">{t.landing_explore_general_desc}</p>
                    </div>
                </div>
                <AppLink href="/question-catalogue" className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary hover:underline">
                    {t.map_view_all_questions}
                    <ArrowRightIcon size={16} aria-hidden="true" />
                </AppLink>
            </Surface>

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {states.map((state) => {
                    const code = state.code.toUpperCase();
                    return (
                        <Surface as="li" key={code} padding="sm" className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/states/coat-of-arms/${state.name}.svg`} alt="" width={28} height={34} loading="lazy" className="h-[34px] w-7 shrink-0 object-contain" />
                                <div className="min-w-0">
                                    <h3 className="truncate font-display text-[0.9375rem] font-semibold leading-tight text-foreground">{state.name}</h3>
                                    <p className="truncate text-xs text-default-500">
                                        {code} · {state.capital}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <AppLink href={`/question-catalogue/${code}`} className={linkClass} aria-label={`${t.map_tab_questions}: ${state.name}`}>
                                    <BookOpenIcon size={14} aria-hidden="true" />
                                    {t.landing_explore_link_questions}
                                </AppLink>
                                <AppLink href={`/pruefstellen/${code}`} className={linkClass} aria-label={`${t.map_tab_centers}: ${state.name}`}>
                                    <MapPinIcon size={14} aria-hidden="true" />
                                    {t.landing_explore_link_centers}
                                </AppLink>
                            </div>
                        </Surface>
                    );
                })}
            </ul>
        </LandingSection>
    );
}
