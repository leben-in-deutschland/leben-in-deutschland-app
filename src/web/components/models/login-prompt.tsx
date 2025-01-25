import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { signIn } from "next-auth/react";
import { useState } from "react";

export const LoginPrompt = ({
    isModelOpen }:
    {
        isModelOpen: boolean
    }) => {
    const [modelOpen, setModelOpen] = useState<boolean>(isModelOpen);
    const handleClose = () => {
        setModelOpen(false);
    };
    return (
        <Modal
            isOpen={modelOpen}
            backdrop="opaque"
            isDismissable={true}
            hideCloseButton={true}
            classNames={{
                backdrop: "bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20"
            }}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 dark:text-white">SignIn</ModalHeader>
                <ModalBody>
                    <p className="dark:text-white">The <span className="font-bold">Leben in Deutschland</span> app is functional without requiring a login. However, we recommend signing in to sync your progress with our servers. This allows you to seamlessly continue from where you left off if you change devices. Rest assured, your data is secure with us and can be deleted from the settings section at any time.</p>
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="solid" onPress={handleClose}>
                        Continue Without Login
                    </Button>
                    <Button color="primary" variant="solid" onPress={() => signIn("auth0")}>
                        Login
                    </Button>
                </ModalFooter>
            </ModalContent>

        </Modal>
    );
};