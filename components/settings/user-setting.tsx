import { Button, Modal, ModalBody, ModalContent, ModalHeader } from "@nextui-org/react";
import StateDropdown from "./state-dropdown";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getUserData, saveUserData } from "@/services/user";
import { User } from "@/types/user";
import { saveStateChange } from "@/utils/state-utils";
import { State } from "@/types/state";
import { DeleteWarning } from "../models/delete-warning";
import { deleteData } from "@/utils/delete";


export default function UserSetting({ handleUserSettingsClose, isOpen }: { handleUserSettingsClose: any, isOpen: boolean }) {
    const [user, setUser] = useState<User>();
    let session = useSession();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    useEffect(() => {
        const handleUserChange = async () => {
            let tempUser = await getUserData(isAuthenticated);
            if (tempUser !== null) {
                setUser(tempUser);
            }
        }

        window.addEventListener('user', handleUserChange)
        return () => window.removeEventListener('storage', handleUserChange)
    }, [isAuthenticated]);
    useEffect(() => {
        (async () => {
            if (isAuthenticated) {
                let tempUser = await getUserData(isAuthenticated);
                if (tempUser !== null) {
                    setUser(tempUser);
                }
            }
        })();

    }, [session.status, isAuthenticated]);

    useEffect(() => {
        setIsAuthenticated(session.status === "authenticated")
    }, [session.status]);

    const handleSelectState = async (state: State) => {
        let userData = await saveStateChange(state, isAuthenticated)
        setUser(userData);
    };

    const [openDeleteWarning, setOpenDeleteWarning] = useState<boolean>(false);
    const handleDataDelete = () => {
        setOpenDeleteWarning(true);
    };

    const handleDeleteConfirmationClose = () => {
        setOpenDeleteWarning(false);
    };

    const handleDeleteAfterConfirmation = async () => {
        await deleteData(isAuthenticated);
        setOpenDeleteWarning(false);
        handleUserSettingsClose();
        window.location.reload();
    };

    return (
        <>
            <DeleteWarning isModelOpen={openDeleteWarning} handleClose={handleDeleteConfirmationClose} handleSubmit={handleDeleteAfterConfirmation} />
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

                            <div className="grid grid-cols-2 gap-4">
                                <h4 className="col-start-1 text-red-500">Delete Data</h4>
                                <div className="col-start-2 justify-right">
                                    {user && <Button variant="solid" color="danger" onPress={handleDataDelete}>Delete</Button>}
                                </div>
                            </div>
                        </div>
                    </ModalBody>
                </ModalContent>

            </Modal>
        </>
    );
};