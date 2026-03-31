import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { AlertTriangleIcon } from "@/icons/AlertTriangleIcon";

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
            backdrop="blur"
            isDismissable={true}
            hideCloseButton={true}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 text-foreground">
                    <div className="flex items-center gap-2">
                        <div className="bg-warning/10 dark:bg-warning/20 rounded-lg p-1.5 text-warning">
                            <AlertTriangleIcon size={18} />
                        </div>
                        <span>{translation.are_you_sure}</span>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <p className="text-foreground/80 text-sm leading-relaxed">{translation.submit_alert}</p>
                </ModalBody>
                <ModalFooter>
                    <Button color="default" variant="flat" onPress={handleClose}>
                        {translation.close}
                    </Button>
                    <Button color="danger" variant="flat" onPress={handleSubmit}>
                        {translation.submit}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};