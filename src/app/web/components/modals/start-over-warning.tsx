import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";

export const StartOverWarning = ({
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
                    <p className="dark:text-white">{translation.start_over_alert}</p>
                </ModalBody>
                <ModalFooter>
                    <Button color="success" variant="bordered" onPress={handleClose}>
                        {translation.start_over_no}
                    </Button>
                    <Button color="danger" variant="bordered" onPress={handleSubmit}>
                        {translation.start_over_yes}
                    </Button>
                </ModalFooter>
            </ModalContent>

        </Modal>
    );
};