import { Button, Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import StateDropdown from "./state-dropdown";
import { useEffect, useState } from "react";
import { getUserData } from "@/services/user";
import { User } from "@/types/user";
import { saveStateChange } from "@/utils/state-utils";
import { State } from "@/types/state";
import { LanguageSwitch } from "../language-switch";
import { saveInlocalStorage } from "@/utils/local-storage";
import { getTranslations } from "@/data/data";
import { ImportIcon } from "@/icons/ImportIcon";
import { ExportIcon } from "@/icons/ExportIcon";
import { exportData, importData } from "@/services/file";


export default function UserSetting({ handleUserSettingsClose, isOpen }: { handleUserSettingsClose: any, isOpen: boolean }) {
    const [user, setUser] = useState<User>();
    useEffect(() => {
        const handleUserChange = () => {
            let tempUser = getUserData();
            if (tempUser !== null) {
                setUser(tempUser);
            }
        }

        window.addEventListener('user', handleUserChange)
        return () => window.removeEventListener('user', handleUserChange)
    }, []);

    useEffect(() => {
        let tempUser = getUserData();
        if (tempUser !== null) {
            setUser(tempUser);
        }
    }, []);


    const handleSelectState = async (state: State) => {
        let userData = saveStateChange(state)
        setUser(userData);
    };

    const handleAppLanguageChange = async (language: string) => {
        if (!user) return;
        user.appLanguage = language;
        setUser(user);
        saveInlocalStorage(user);
    };
    const allTranslations = getTranslations(user?.appLanguage ?? "de");
    return (
        <>
            <Modal isOpen={isOpen}
                isDismissable={true}
                onClose={handleUserSettingsClose}
                backdrop="transparent">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 dark:text-white">{allTranslations.settings}</ModalHeader>
                    <ModalBody>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <h4 className="col-start-1 dark:text-white">{allTranslations.change_state}</h4>
                                <div className="col-start-2 justify-right">
                                    {user && <StateDropdown user={user} handleSelectState={handleSelectState} />}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <h4 className="col-start-1 dark:text-white">{allTranslations.app_language}</h4>
                                <div className="col-start-2 justify-right">
                                    {user && <LanguageSwitch user={user} handleAppLanguageChange={handleAppLanguageChange} />}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    onPress={() => importData()}
                                    startContent={<ImportIcon className="dark:invert" />}
                                    className="w-full"
                                    variant="bordered">{allTranslations.import}</Button>
                                <Button
                                    onPress={() => exportData()}
                                    startContent={<ExportIcon className="dark:invert" />}
                                    className="w-full"
                                    variant="bordered">{allTranslations.export}</Button>

                            </div>
                        </div>
                    </ModalBody>
                </ModalContent>

            </Modal>
        </>
    );
};