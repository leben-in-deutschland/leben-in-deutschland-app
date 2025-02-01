import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import StateDropdown from "./state-dropdown";
import { useEffect, useState } from "react";
import { getUserData } from "@/services/user";
import { User } from "@/types/user";
import { saveStateChange } from "@/utils/state-utils";
import { State } from "@/types/state";


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
        (async () => {

            let tempUser = getUserData();
            if (tempUser !== null) {
                setUser(tempUser);
            }

        })();

    }, []);


    const handleSelectState = async (state: State) => {
        let userData = saveStateChange(state)
        setUser(userData);
    };


    return (
        <>
            <Modal isOpen={isOpen}
                isDismissable={true}
                onClose={handleUserSettingsClose}
                backdrop="opaque"
                classNames={{
                    backdrop: "bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20"
                }}>
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 dark:text-white">Settings</ModalHeader>
                    <ModalBody>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <h4 className="col-start-1 dark:text-white">Change State</h4>
                                <div className="col-start-2 justify-right">
                                    {user && <StateDropdown user={user} handleSelectState={handleSelectState} />}
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                </ModalContent>

            </Modal>
        </>
    );
};