"use client";

import { InlineNotice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/surface";
import { fmt } from "@/utils/i18n";
import { useTranslations } from "@/utils/user-store";

/** Translated top of the privacy page; the legal text itself stays in English. */
export function PrivacyIntro({ lastUpdated }: { lastUpdated: string }) {
    const t = useTranslations();
    return (
        <div className="flex flex-col gap-4">
            <PageHeader title={t.privacy_title} description={t.privacy_desc} />
            <p className="text-sm text-default-500">{fmt(t.privacy_last_updated, { date: lastUpdated })}</p>
            <InlineNotice tone="info">{t.privacy_english_only}</InlineNotice>
            <InlineNotice tone="warning">
                {t.alert1} {t.alert2}
            </InlineNotice>
        </div>
    );
}
