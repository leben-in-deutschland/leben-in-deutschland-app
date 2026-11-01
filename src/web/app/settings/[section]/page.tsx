import { SettingsSectionScreen } from "@/components/preferences/settings-section-screen";
import { SETTINGS_SECTION_IDS, type SettingsSectionId } from "@/components/preferences/settings-ids";

type Params = Promise<{ section: string }>;

/** Static export: one page per section, nothing else under /settings/. */
export const dynamicParams = false;

export function generateStaticParams() {
    return SETTINGS_SECTION_IDS.map((section) => ({ section }));
}

export default async function SettingsSectionPage({ params }: { params: Params }) {
    const { section } = await params;
    return <SettingsSectionScreen section={section as SettingsSectionId} />;
}
