/**
 * The settings section ids, in a plain module so the static route list in
 * `app/settings/[section]/page.tsx` (a server component) can read them; the
 * client-side registry in `settings-sections.tsx` builds on them.
 */
export const SETTINGS_SECTION_IDS = ["profile", "practice", "exam", "streak", "notifications", "design", "data", "support", "about"] as const;
export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export function isSettingsSectionId(value: string | null | undefined): value is SettingsSectionId {
    return (SETTINGS_SECTION_IDS as readonly string[]).includes(value ?? "");
}
