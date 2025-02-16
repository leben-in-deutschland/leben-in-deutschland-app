import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useEffect, useState } from "react";
import { AppUpdateAvailability, AppUpdate as AppUpdatePlugin } from '@capawesome/capacitor-app-update';

export const AppUpdate = ({ translation }: { translation: any }) => {
    const [isModelOpen, setIsModelOpen] = useState(false);
    useEffect(() => {
        (async () => {
            const result = await AppUpdatePlugin.getAppUpdateInfo();
            setIsModelOpen(result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE);
        })();
    }, []);

    const HandleUpdateConfirm = async () => {
        const result = await AppUpdatePlugin.getAppUpdateInfo();
        if (result.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
            return;
        }
        if (result.immediateUpdateAllowed) {
            await AppUpdatePlugin.performImmediateUpdate();
        }
        else if (result.flexibleUpdateAllowed) {
            await AppUpdatePlugin.startFlexibleUpdate();
            await AppUpdatePlugin.completeFlexibleUpdate();
        }
    };
    return (
        <Modal
            isOpen={isModelOpen}
            backdrop="opaque"
            isDismissable={true}
            hideCloseButton={true}
            classNames={{
                backdrop: "bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20"
            }}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 dark:text-white">{translation.app_update_title}</ModalHeader>
                <ModalBody>
                    <p className="dark:text-white">{translation.app_update_subtitle1}</p>
                    <p className="text-danger">{translation.app_update_subtitle2}</p>
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" onPress={() => setIsModelOpen(false)}>
                        {translation.close}
                    </Button>
                    <Button color="success" onPress={HandleUpdateConfirm}>
                        {translation.app_update_yes}
                    </Button>
                </ModalFooter>
            </ModalContent>

        </Modal>
    );
};