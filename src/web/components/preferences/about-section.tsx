"use client";

import type { ReactNode } from "react";
import packageJson from "@/package.json";
import { siteConfig } from "@/config/site";
import { storeName, storeRatingUrl } from "@/utils/app-store";
import { AppLink } from "@/components/ui/app-link";
import type { IconComponent } from "@/components/ui/icons";
import { ChevronRightIcon, ExternalLinkIcon, InfoIcon, MailIcon, ShieldCheckIcon, StarIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { IconBadge } from "@/components/ui/icon-badge";
import { fmt } from "@/utils/i18n";
import { useIsNative, useTranslations } from "@/utils/user-store";
import { SettingsSection, ValuePill } from "./settings-shared";

const FEEDBACK_MAILTO = "mailto:hello@lamplitlabs.com?subject=Leben%20in%20Deutschland%20App";

/** Simple GitHub mark; icons.tsx has no brand icons. */
const GitHubMark: IconComponent = ({ size = 20, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
        <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.1c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
);

type LinkRowProps = {
    icon: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    href: string;
    /** Opens in a new tab / the system browser or mail app. */
    external?: boolean;
};

/** Like ListRow, but lets external links open outside the app. */
function LinkRow({ icon, title, description, href, external = false }: LinkRowProps) {
    return (
        <AppLink
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-default-100 active:bg-default-200"
        >
            {icon}
            <span className="min-w-0 flex-1">
                <span className="block font-medium leading-snug text-foreground">{title}</span>
                {description ? <span className="mt-0.5 block text-sm leading-snug text-default-500">{description}</span> : null}
            </span>
            {external ? (
                <ExternalLinkIcon size={18} className="shrink-0 text-default-400" aria-hidden="true" />
            ) : (
                <ChevronRightIcon size={18} className="shrink-0 text-default-400" aria-hidden="true" />
            )}
        </AppLink>
    );
}

export function AboutSection() {
    const t = useTranslations();
    const isNative = useIsNative();
    const ratingUrl = storeRatingUrl();

    return (
        <SettingsSection
            id="about"
            title={t.settings_section_about}
            footer={<p className="px-1 text-xs leading-relaxed text-default-500">{t.settings_credits}</p>}
        >
            <ListRow leading={<IconBadge icon={InfoIcon} />} title={t.settings_version} trailing={<ValuePill>{packageJson.version}</ValuePill>} />
            {/* In-app page on the web; AppLink opens the public website inside the Android app. */}
            <LinkRow icon={<IconBadge icon={ShieldCheckIcon} accent="success" />} title={t.settings_privacy} href="/privacy-policy" external={isNative} />
            <LinkRow icon={<IconBadge icon={InfoIcon} accent="default" />} title={t.settings_impressum} href="/impressum" external={isNative} />
            {/* Rating happens in the store the app came from; on iOS the row waits for the App Store URL. */}
            {isNative && ratingUrl ? (
                <LinkRow
                    icon={<IconBadge icon={StarIcon} accent="warning" />}
                    title={t.settings_rate}
                    description={fmt(t.settings_rate_hint, { store: storeName() })}
                    href={ratingUrl}
                    external
                />
            ) : null}
            <LinkRow
                icon={<IconBadge icon={GitHubMark} />}
                title={t.settings_source}
                description={t.settings_source_hint}
                href={siteConfig.links.github}
                external
            />
            <LinkRow
                icon={<IconBadge icon={MailIcon} accent="primary" />}
                title={t.settings_feedback}
                description={t.settings_feedback_hint}
                href={FEEDBACK_MAILTO}
            />
        </SettingsSection>
    );
}
