import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";

export const SubmitWarning = ({
    handleSubmit, handleClose, isModelOpen, translation }:
    {
        isModelOpen: boolean
        handleClose: any,
        handleSubmit: any,
        translation: any
    }) => {
    return (
        <Modal
            isOpen={isModelOpen}
            backdrop="transparent"
            isDismissable={true}
            hideCloseButton={true}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 dark:text-white">{translation.are_you_sure}</ModalHeader>
                <ModalBody>
                    <p className="dark:text-white">{translation.submit_alert}</p>
                </ModalBody>
                <ModalFooter>
                    <Button color="default" variant="light" onPress={handleClose}>
                        {translation.close}
                    </Button>
                    <Button color="danger" variant="light" onPress={handleSubmit}>
                        {translation.submit}
                    </Button>
                </ModalFooter>
            </ModalContent>

        </Modal>
    );
};