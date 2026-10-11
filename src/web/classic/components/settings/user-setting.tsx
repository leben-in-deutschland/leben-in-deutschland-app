// Adapted from 2.0: a "Design" row switches to the modern interface
// (`setUiMode("modern")`, then Home), "start over" resets through
// `resetProgress` so the 2.1 fields (streak, review schedule, achievements)
// are cleared as well, the language change saves a private copy of the
// record, and the record comes from the shared `useUser()` hook (every save
// notifies it). State, language, import/export, and start over are the 2.0 rows.
import { Button, Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import StateDropdown from "./state-dropdown";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getUserData } from "@/classic/services/user";
import { useUser } from "@/utils/user-store";
import { saveStateChange } from "@/classic/utils/state-utils";
import { State } from "@/types/state";
import { LanguageSwitch } from "../language-switch";
import { saveInlocalStorage } from "@/classic/utils/local-storage";
import { getTranslations } from "@/data/data";
import { ImportIcon } from "@/classic/icons/ImportIcon";
import { ExportIcon } from "@/classic/icons/ExportIcon";
import { exportData, importData } from "@/services/file";
import { TimeBackIcon } from "@/classic/icons/TimeBackIcon";
import { SparklesIcon } from "@/classic/icons/SparklesIcon";
import { StartOverWarning } from "../modals/start-over-warning";
import { navigateTo } from "@/utils/navigation";
import { setUiMode } from "@/utils/ui-mode";
import { resetProgress } from "@/utils/user-defaults";


export default function UserSetting({ handleUserSettingsClose, isOpen }: { handleUserSettingsClose: () => void, isOpen: boolean }) {
    const user = useUser() ?? undefined;
    const router = useRouter();

    const handleSelectState = async (state: State) => {
        saveStateChange(state);
    };

    const handleAppLanguageChange = async (language: string) => {
        if (!user) return;
        saveInlocalStorage({ ...user, appLanguage: language });
    };
    const [isStartOverWarningOpen, setIsStartOverWarningOpen] = useState(false);
    const handleStartOverWarningClose = () => {
        setIsStartOverWarningOpen(false);
    };
    const handleStartOverSubmit = () => {
        setIsStartOverWarningOpen(false);
        const userData = getUserData();
        if (userData) {
            saveInlocalStorage(resetProgress(userData));
        }
    };
    const handleSwitchToModern = () => {
        setUiMode("modern");
        handleUserSettingsClose();
        navigateTo("/dashboard", router.push);
    };
    const allTranslations = getTranslations(user?.appLanguage ?? "de");
    return (
        <>
            {isStartOverWarningOpen && <StartOverWarning isModelOpen={isStartOverWarningOpen} handleClose={handleStartOverWarningClose} handleSubmit={handleStartOverSubmit} translation={allTranslations} />}
            <Modal isOpen={isOpen}
                isDismissable={true}
                onClose={handleUserSettingsClose}
                backdrop="transparent">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 text-foreground">{allTranslations.settings}</ModalHeader>
                    <ModalBody>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <h4 className="col-start-1 text-foreground">{allTranslations.change_state}</h4>
                                <div className="col-start-2 justify-right">
                                    {user && <StateDropdown user={user} handleSelectState={handleSelectState} translation={allTranslations} />}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <h4 className="col-start-1 text-foreground">{allTranslations.app_language}</h4>
                                <div className="col-start-2 justify-right">
                                    {user && <LanguageSwitch user={user} handleAppLanguageChange={handleAppLanguageChange} translation={allTranslations} />}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <h4 className="text-foreground">{allTranslations.ui_mode_section_title}</h4>
                                <p className="text-sm text-default-500">{allTranslations.ui_mode_section_hint}</p>
                                <Button
                                    onPress={handleSwitchToModern}
                                    color="primary"
                                    startContent={<SparklesIcon className="text-primary" />}
                                    className="w-full"
                                    variant="bordered">{allTranslations.ui_mode_switch_modern}</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    onPress={() => importData()}
                                    startContent={<ImportIcon className="text-foreground" />}
                                    className="w-full"
                                    variant="bordered">{allTranslations.import}</Button>
                                <Button
                                    onPress={() => exportData()}
                                    startContent={<ExportIcon className="text-foreground" />}
                                    className="w-full"
                                    variant="bordered">{allTranslations.export}</Button>

                            </div>
                            <div className="grid grid-cols-1">
                                <Button
                                    onPress={() => setIsStartOverWarningOpen(true)}
                                    color="danger"
                                    startContent={<TimeBackIcon className="text-danger" />}
                                    className="w-full"
                                    variant="bordered">{allTranslations.start_over}</Button>

                            </div>
                        </div>
                    </ModalBody>
                </ModalContent>

            </Modal>
        </>
    );
};
