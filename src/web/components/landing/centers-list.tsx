"use client";

import { Button, Input } from "@heroui/react";
import { useMemo, useState } from "react";
import type { Prüfstellen } from "@/types/prüfstellen";
import type { State } from "@/types/state";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState, InlineNotice } from "@/components/ui/feedback";
import { IconBadge } from "@/components/ui/icon-badge";
import { ArrowRightIcon, ExternalLinkIcon, LandmarkIcon, MailIcon, MapPinIcon, PhoneIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeader, Surface } from "@/components/ui/surface";
import { fmt, plural, type Translations } from "@/utils/i18n";
import { useTranslations } from "@/utils/user-store";
import { StatePicker } from "./state-picker";

type CentersListProps = {
    stateCode: string;
    stateName: string;
    centers: Prüfstellen[];
    states: State[];
};

type Center = {
    key: string;
    district: string;
    name: string;
    street: string;
    city: string;
    phone: string;
    phoneHref: string | null;
    email: string;
    mapsHref: string;
};

const clean = (value: unknown): string => String(value ?? "").trim();

function toCenter(place: Prüfstellen, index: number): Center {
    const street = clean(place.straße);
    const city = `${clean(place.plz)} ${clean(place.ort)}`.trim();
    const phone = clean(place.telefon);
    const digits = phone.replace(/[^\d+]/g, "");
    const name = clean(place.einrichtung);
    return {
        key: `${name}-${street}-${index}`,
        district: clean(place.regierungsbezirk),
        name,
        street,
        city,
        phone,
        phoneHref: digits.length >= 6 ? `tel:${digits}` : null,
        email: clean(place.email),
        mapsHref: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, street, city].filter(Boolean).join(", "))}`,
    };
}

const contactClass =
    "inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-content2 px-3 text-sm font-medium text-foreground transition-colors hover:bg-primary-50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The exam centres of one state, with a quick filter by city, postcode or name. */
export function CentersList({ stateCode, stateName, centers, states }: CentersListProps) {
    const t = useTranslations();
    const [query, setQuery] = useState("");
    const all = useMemo(() => centers.map(toCenter).sort((a, b) => a.city.localeCompare(b.city, "de")), [centers]);
    const needle = query.trim().toLowerCase();
    const visible = needle ? all.filter((center) => `${center.name} ${center.street} ${center.city} ${center.district}`.toLowerCase().includes(needle)) : all;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                leading={
                    <AppLink href="/#explore" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-default-500 hover:text-foreground">
                        ← {t.centers_back_to_states}
                    </AppLink>
                }
                title={fmt(t.centers_title, { state: stateName })}
                description={fmt(t.centers_desc, { state: stateName })}
                actions={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/states/coat-of-arms/${stateName}.svg`} alt="" width={44} height={52} className="h-[52px] w-11 object-contain" />
                }
            />

            <StatePicker label={t.centers_state_picker_label} states={states} current={stateCode} hrefFor={(code) => `/pruefstellen/${code}`} />

            <Surface className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                <div className="flex gap-3">
                    <IconBadge icon={LandmarkIcon} accent="primary" />
                    <div className="rich-text text-sm text-default-600">
                        <p>{t.centers_intro_1}</p>
                        <p>{t.centers_intro_2}</p>
                    </div>
                </div>
                <Button as={AppLink} href={`/question-catalogue/${stateCode}`} variant="flat" color="primary" className="h-11 font-semibold" endContent={<ArrowRightIcon size={16} aria-hidden="true" />}>
                    {fmt(t.centers_state_questions_link, { state: stateName })}
                </Button>
            </Surface>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                    type="search"
                    value={query}
                    onValueChange={setQuery}
                    isClearable
                    onClear={() => setQuery("")}
                    variant="bordered"
                    placeholder={t.centers_search_placeholder}
                    aria-label={t.centers_search_label}
                    startContent={<SearchIcon size={18} className="text-default-400" aria-hidden="true" />}
                    className="sm:max-w-sm"
                    classNames={{ inputWrapper: "bg-content1" }}
                />
                <p className="text-sm text-default-500" role="status" aria-live="polite">
                    {needle ? fmt(t.centers_results_of, { count: visible.length, total: all.length }) : plural(t, "centers_count", all.length)}
                </p>
            </div>

            {visible.length === 0 ? (
                <EmptyState
                    icon={SearchIcon}
                    title={t.centers_empty_title}
                    description={t.centers_empty_desc}
                    action={
                        <Button variant="flat" onPress={() => setQuery("")}>
                            {t.catalogue_clear_filters}
                        </Button>
                    }
                />
            ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                    {visible.map((center) => (
                        <Surface as="li" key={center.key} className="flex flex-col gap-3">
                            <div>
                                {center.district ? <p className="text-xs font-medium uppercase tracking-wide text-default-500">{center.district}</p> : null}
                                <h2 className="font-display text-base font-semibold leading-tight text-foreground">{center.name}</h2>
                                <p className="mt-1 flex items-start gap-1.5 text-sm text-default-600">
                                    <MapPinIcon size={16} className="mt-0.5 shrink-0 text-default-400" aria-hidden="true" />
                                    <span>
                                        {center.street ? (
                                            <>
                                                {center.street}
                                                <br />
                                            </>
                                        ) : null}
                                        {center.city}
                                    </span>
                                </p>
                            </div>
                            <div className="mt-auto flex flex-wrap gap-2">
                                {center.phone ? (
                                    center.phoneHref ? (
                                        <a href={center.phoneHref} className={contactClass}>
                                            <PhoneIcon size={16} aria-hidden="true" />
                                            {center.phone}
                                        </a>
                                    ) : (
                                        <span className={contactClass}>
                                            <PhoneIcon size={16} aria-hidden="true" />
                                            {center.phone}
                                        </span>
                                    )
                                ) : null}
                                {center.email ? (
                                    <a href={`mailto:${center.email}`} className={`${contactClass} min-w-0`}>
                                        <MailIcon size={16} className="shrink-0" aria-hidden="true" />
                                        <span className="truncate">{center.email}</span>
                                    </a>
                                ) : null}
                                <a href={center.mapsHref} target="_blank" rel="noopener noreferrer" className={contactClass}>
                                    <ExternalLinkIcon size={16} aria-hidden="true" />
                                    {t.centers_open_map}
                                </a>
                            </div>
                        </Surface>
                    ))}
                </ul>
            )}

            <InlineNotice tone="info" title={t.centers_note_title}>
                {t.centers_note_body}
            </InlineNotice>
        </div>
    );
}
