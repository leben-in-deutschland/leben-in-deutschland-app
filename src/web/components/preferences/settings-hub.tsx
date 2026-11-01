"use client";

import { Spinner } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IconBadge } from "@/components/ui/icon-badge";
import { ListRow } from "@/components/ui/list-row";
import { PageHeader, SectionHeading, Surface } from "@/components/ui/surface";
import { useAppLanguage, useIsNative, useTranslations, useUser } from "@/utils/user-store";
import { isSettingsSectionId, SETTINGS_GROUPS, SETTINGS_SECTIONS, type SettingsSectionId } from "./settings-sections";

export const settingsSectionPath = (id: SettingsSectionId) => `/settings/${id}`;

/**
 * Older links open a section by hash (`/settings#support` from the header
 * heart, `/settings#notifications` from a reminder). The hub forwards them to
 * the section's own page, replacing the history entry so back still works.
 */
function useHashForward(ready: boolean) {
    const router = useRouter();
    useEffect(() => {
        if (!ready) {
            return;
        }
        const id = window.location.hash.replace(/^#/, "");
        if (isSettingsSectionId(id)) {
            router.replace(settingsSectionPath(id));
        }
    }, [ready, router]);
}

/** `/settings`: one row per section with its current value; each opens its own page. */
export function SettingsHub() {
    const t = useTranslations();
    const user = useUser();
    const language = useAppLanguage();
    const isNative = useIsNative();
    useHashForward(Boolean(user));

    if (!user) {
        return (
            <div className="flex justify-center py-16">
                <Spinner color="primary" label={t.loading} />
            </div>
        );
    }

    const groupTitles = {
        learning: t.settings_hub_group_learning,
        motivation: t.settings_hub_group_motivation,
        app: t.settings_hub_group_app,
    } as const;
    const ctx = { t, user, language, isNative };

    return (
        <div className="space-y-6 pb-6 stagger-in">
            <PageHeader title={t.settings} description={t.settings_subtitle} />
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
                {SETTINGS_GROUPS.map((group) => {
                    const sections = group.sections.map((id) => SETTINGS_SECTIONS[id]).filter((entry) => entry.available?.(ctx) ?? true);
                    if (sections.length === 0) {
                        return null;
                    }
                    return (
                        <section key={group.id} aria-labelledby={`settings-group-${group.id}`} className="space-y-3">
                            <SectionHeading id={`settings-group-${group.id}`} title={groupTitles[group.id]} />
                            <Surface padding="none" className="divide-y divide-divider overflow-hidden">
                                {sections.map((entry) => (
                                    <ListRow
                                        key={entry.id}
                                        href={settingsSectionPath(entry.id)}
                                        leading={<IconBadge icon={entry.icon} accent={entry.accent} />}
                                        title={entry.title(t)}
                                        description={entry.summary(ctx)}
                                    />
                                ))}
                            </Surface>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
