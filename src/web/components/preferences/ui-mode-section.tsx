"use client";

import { toast } from "react-toastify";
import { useAppNavigate } from "@/components/ui/app-link";
import { CheckIcon, RepeatIcon, SparklesIcon } from "@/components/ui/icons";
import { IconBadge } from "@/components/ui/icon-badge";
import { ListRow } from "@/components/ui/list-row";
import { setUiMode } from "@/utils/ui-mode";
import { useTranslations } from "@/utils/user-store";
import { SettingsSection } from "./settings-shared";

/** The design in use and the way back to the classic (2.0) design. */
export function UiModeSection() {
    const t = useTranslations();
    const navigate = useAppNavigate();

    const switchToClassic = () => {
        setUiMode("classic");
        toast.success(t.ui_mode_switched_classic);
        navigate("/dashboard");
    };

    return (
        <SettingsSection id="design" title={t.ui_mode_section_title} description={t.ui_mode_section_hint}>
            <ListRow
                leading={<IconBadge icon={SparklesIcon} accent="primary" />}
                title={t.ui_mode_current_modern}
                trailing={<CheckIcon size={18} className="shrink-0 text-primary" aria-hidden="true" />}
            />
            <ListRow leading={<IconBadge icon={RepeatIcon} />} title={t.ui_mode_switch_classic} onPress={switchToClassic} />
        </SettingsSection>
    );
}
