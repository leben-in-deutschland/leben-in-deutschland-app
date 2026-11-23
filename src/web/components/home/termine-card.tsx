"use client";

import clsx from "clsx";
import { useSyncExternalStore, type CSSProperties } from "react";
import { IconBadge } from "@/components/ui/icon-badge";
import { MapPinIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { Surface } from "@/components/ui/surface";
import { plural, type Translations } from "@/utils/i18n";
import { EMPTY_WATCH, readWatch, subscribeWatch, type TermineWatch } from "@/utils/termine-watch";
import { useIsNative } from "@/utils/user-store";

type TermineCardProps = {
    /** The learner's state code, for the website's page of that state. */
    stateCode: string;
    t: Translations;
    className?: string;
    style?: CSSProperties;
};

function serverWatch(): TermineWatch {
    return EMPTY_WATCH;
}

/** The way from Home to the exam dates (ADR-050), with the number of watched exam centres. */
export function TermineCard({ stateCode, t, className, style }: TermineCardProps) {
    const isNative = useIsNative();
    const watch = useSyncExternalStore(subscribeWatch, readWatch, serverWatch);
    const watching = watch.centres.length;
    // The apps ship one page that starts with the learner's state; the website has a page per state.
    const href = isNative || !stateCode ? "/termine" : `/termine/${stateCode.toUpperCase()}`;
    return (
        <Surface as="section" padding="none" className={clsx("overflow-hidden", className)} style={style} aria-label={t.termine_home_title}>
            <ListRow
                href={href}
                leading={<IconBadge icon={MapPinIcon} accent="success" />}
                title={t.termine_home_title}
                description={watching > 0 ? plural(t, "termine_home_watching", watching) : t.termine_home_body}
            />
        </Surface>
    );
}
