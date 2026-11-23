"use client";

import { Button, Input, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { State } from "@/types/state";
import type { TerminCentre } from "@/types/termine";
import { StatePicker } from "@/components/landing/state-picker";
import { AppLink } from "@/components/ui/app-link";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { EmptyState, InlineNotice } from "@/components/ui/feedback";
import { FoldOut } from "@/components/ui/fold-out";
import { AlertTriangleIcon, BellIcon, ChevronLeftIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeader, SectionHeading } from "@/components/ui/surface";
import { dayKey } from "@/utils/date-utils";
import { fmt, formatDate, plural } from "@/utils/i18n";
import { countCentres, listCentres } from "@/utils/termine-logic";
import { isWatched, MAX_WATCHED } from "@/utils/termine-watch";
import { prefsOf } from "@/utils/user-defaults";
import { useAppLanguage, useHydrated, useIsNative, useTranslations, useUser } from "@/utils/user-store";
import { CentreCard } from "./centre-card";
import { useTermine, useTermineWatch } from "./use-termine";

type TermineScreenProps = {
    /** Upper-case code of the state the page was opened for, or "" for all states. */
    initialState: string;
    states: State[];
};

type Show = "all" | "bookable";

const UPDATED: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

const linkClass = "font-semibold text-primary underline-offset-2 hover:underline";

/** Path of the page for one state ("" = every state). */
export function terminePath(code: string): string {
    return code ? `/termine/${code}` : "/termine";
}

/**
 * Exam dates per state (ADR-050): what the exam centres' own pages say about
 * their test dates, a search by town, and a watch list that stays on the
 * device.
 *
 * On the website every state has its own address and the state row links to
 * it. The apps ship one page only, so there the row switches in place and
 * starts with the learner's own state.
 */
export function TermineScreen({ initialState, states }: TermineScreenProps) {
    const t = useTranslations();
    const language = useAppLanguage();
    const isNative = useIsNative();
    const hydrated = useHydrated();
    const user = useUser();
    const { data, loading, failed, reload } = useTermine();
    const { watch, toggle } = useTermineWatch();
    const [query, setQuery] = useState("");
    const [show, setShow] = useState<Show>("all");
    const [chosen, setChosen] = useState<string | null>(null);

    const ownState = user?.state?.stateCode?.toUpperCase() ?? "";
    const stateCode = isNative ? (chosen ?? (initialState || ownState)) : initialState;
    const stateName = states.find((state) => state.code.toUpperCase() === stateCode)?.name ?? "";
    // Render-stable within a mount; the day only matters for which dates count as upcoming.
    const [now] = useState(() => new Date());
    const today = dayKey(now);

    const centres = useMemo(() => listCentres(data, { state: stateCode, query, bookableOnly: show === "bookable" }, today), [data, stateCode, query, show, today]);
    const counts = useMemo(() => countCentres(listCentres(data, { state: stateCode, query: "", bookableOnly: false }, today), today), [data, stateCode, today]);
    const watched = useMemo(() => (data?.centres ?? []).filter((centre) => isWatched(watch, centre.id)), [data, watch]);
    const filtered = query.trim() !== "" || show === "bookable";

    const onToggleWatch = (centre: TerminCentre) => {
        if (!toggle(centre)) {
            toast(fmt(t.termine_watch_full, { count: MAX_WATCHED }), { toastId: "termine-watch-full" });
        }
    };

    const card = (centre: TerminCentre) => (
        <CentreCard key={centre.id} centre={centre} today={today} now={now} language={language} t={t} watched={isWatched(watch, centre.id)} onToggleWatch={onToggleWatch} />
    );

    const centresLink = (
        <AppLink href={stateCode ? `/pruefstellen/${stateCode}` : "/#explore"} className={linkClass}>
            {stateCode ? fmt(t.termine_all_centres_state, { state: stateName }) : t.termine_all_centres}
        </AppLink>
    );

    const notificationsOff = isNative && user ? !prefsOf(user).notificationsEnabled : false;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                leading={
                    <AppLink href={isNative ? "/dashboard" : "/"} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-default-500 hover:text-foreground">
                        <ChevronLeftIcon size={18} aria-hidden="true" />
                        {t.termine_back}
                    </AppLink>
                }
                title={stateName ? fmt(t.termine_title_state, { state: stateName }) : t.termine_title}
                description={t.termine_desc}
            />

            <StatePicker
                label={t.termine_state_picker_label}
                states={states}
                current={stateCode}
                hrefFor={terminePath}
                onSelect={isNative ? setChosen : undefined}
                allLabel={t.termine_state_all}
            />

            {watched.length > 0 ? (
                <section aria-labelledby="termine-watch-title" className="flex flex-col gap-3">
                    <SectionHeading id="termine-watch-title" title={t.termine_watch_title} description={t.termine_watch_hint} />
                    {notificationsOff ? (
                        <InlineNotice
                            tone="warning"
                            action={
                                <AppLink href="/settings/notifications" className={linkClass}>
                                    {t.termine_watch_notifications_link}
                                </AppLink>
                            }
                        >
                            {t.termine_watch_notifications_off}
                        </InlineNotice>
                    ) : (
                        <p className="flex items-start gap-2 text-sm text-default-500">
                            <BellIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            {hydrated && isNative ? t.termine_watch_hint_app : t.termine_watch_hint_web}
                        </p>
                    )}
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{watched.map(card)}</ul>
                </section>
            ) : null}

            <section aria-label={t.termine_title} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Input
                        type="search"
                        value={query}
                        onValueChange={setQuery}
                        isClearable
                        onClear={() => setQuery("")}
                        variant="bordered"
                        placeholder={t.termine_search_placeholder}
                        aria-label={t.termine_search_label}
                        startContent={<SearchIcon size={18} className="text-default-400" aria-hidden="true" />}
                        className="lg:max-w-sm"
                        classNames={{ inputWrapper: "bg-content1" }}
                    />
                    <ChoiceChips<Show>
                        label={t.termine_filter_label}
                        size="sm"
                        value={show}
                        onChange={setShow}
                        options={[
                            { value: "all", label: t.termine_filter_all },
                            { value: "bookable", label: t.termine_filter_bookable },
                        ]}
                    />
                </div>

                {data ? (
                    <p className="text-sm text-default-500" role="status" aria-live="polite">
                        {plural(t, "termine_count", filtered ? centres.length : counts.centres)}
                        {" · "}
                        {fmt(t.termine_count_bookable, { count: counts.bookable })}
                        {" · "}
                        {fmt(t.termine_updated, { time: formatDate(data.generatedAt, language, UPDATED) })}
                    </p>
                ) : null}

                {loading ? (
                    <div className="flex justify-center py-12" role="status" aria-live="polite">
                        <Spinner color="primary" label={t.termine_loading} />
                    </div>
                ) : failed ? (
                    <EmptyState
                        icon={AlertTriangleIcon}
                        accent="warning"
                        title={t.termine_failed_title}
                        description={
                            <>
                                {t.termine_failed_body} {centresLink}
                            </>
                        }
                        action={
                            <Button color="primary" variant="flat" onPress={reload}>
                                {t.termine_retry}
                            </Button>
                        }
                    />
                ) : centres.length === 0 ? (
                    <EmptyState
                        icon={SearchIcon}
                        title={t.termine_empty_title}
                        description={
                            <>
                                {t.termine_empty_body} {centresLink}
                            </>
                        }
                        action={
                            filtered ? (
                                <Button
                                    variant="flat"
                                    onPress={() => {
                                        setQuery("");
                                        setShow("all");
                                    }}
                                >
                                    {t.catalogue_clear_filters}
                                </Button>
                            ) : stateCode ? (
                                // A state without a centre yet: the other states are one step away.
                                isNative ? (
                                    <Button variant="flat" color="primary" onPress={() => setChosen("")}>
                                        {t.termine_show_all_states}
                                    </Button>
                                ) : (
                                    <Button as={AppLink} href={terminePath("")} variant="flat" color="primary">
                                        {t.termine_show_all_states}
                                    </Button>
                                )
                            ) : undefined
                        }
                    />
                ) : (
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{centres.map(card)}</ul>
                )}
            </section>

            <InlineNotice tone="info" title={t.termine_note_title}>
                <p>{t.termine_note_body}</p>
                {data ? (
                    <p className="mt-1">
                        {fmt(t.termine_coverage, { count: data.centres.length })} {centresLink}
                    </p>
                ) : null}
            </InlineNotice>

            <FoldOut title={t.termine_centres_title} variant="card">
                <p className="text-sm leading-relaxed text-default-600">
                    {t.termine_centres_body}{" "}
                    <AppLink href="/impressum" className={linkClass}>
                        {t.termine_impressum_link}
                    </AppLink>
                </p>
            </FoldOut>
        </div>
    );
}
