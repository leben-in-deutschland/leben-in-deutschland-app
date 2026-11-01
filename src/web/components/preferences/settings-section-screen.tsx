"use client";

import { Spinner } from "@heroui/react";
import { AppLink } from "@/components/ui/app-link";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { InlineNotice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/surface";
import { useIsNative, useTranslations, useUser } from "@/utils/user-store";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./settings-sections";
import { StandaloneSectionContext } from "./settings-shared";

/** `/settings/<id>`: one section as a page of its own, with a way back to the hub. */
export function SettingsSectionScreen({ section }: { section: SettingsSectionId }) {
    const t = useTranslations();
    const user = useUser();
    const isNative = useIsNative();
    const entry = SETTINGS_SECTIONS[section];

    if (!user) {
        return (
            <div className="flex justify-center py-16">
                <Spinner color="primary" label={t.loading} />
            </div>
        );
    }

    const back = (
        <AppLink href="/settings" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary">
            <ChevronLeftIcon size={18} aria-hidden="true" />
            {t.settings}
        </AppLink>
    );
    const available = entry.available?.({ isNative }) ?? true;

    return (
        <div className="space-y-6 pb-6 stagger-in">
            <PageHeader leading={back} title={entry.title(t)} titleId={`${section}-heading`} description={entry.description?.(t)} />
            <div className="mx-auto w-full max-w-2xl lg:mx-0">
                {available ? (
                    <StandaloneSectionContext.Provider value={true}>{entry.render(user)}</StandaloneSectionContext.Provider>
                ) : (
                    <InlineNotice tone="info">{t.settings_hub_unavailable}</InlineNotice>
                )}
            </div>
        </div>
    );
}
