import { saveUserData } from "@/services/user";
import { User } from "@/types/user";
import { saveInlocalStorage } from "@/utils/local-storage";
import { AppReview } from "@capawesome/capacitor-app-review";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useEffect, useState } from "react";

export const InAppReview = ({ user, translation }:
    {
        user: User
        translation: any
    }) => {
    const NO_THRESHOLD = 2; // Stop asking after 2 "No" responses
    const INITIAL_WAIT_DAYS = 2;
    const RETRY_WAIT_DAYS = 4;
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    useEffect(() => {
        if (shouldShowReviewPopup(user)) {
            setIsModalOpen(true);
            user.lastReviewPromptDateTime = new Date(Date.now());
            saveUserData(user);
        }
    }, [user]);

    const onUserSaysNo = () => {
        setIsModalOpen(false);
        user.reviewNoCount = user.reviewNoCount + 1;
        user.lastReviewPromptDateTime = new Date(Date.now());

    };

    const onUserSaysYes = async () => {
        setIsModalOpen(false);
        saveUserData(user);
        await AppReview.requestReview(); // Trigger in-app review
    };

    const shouldShowReviewPopup = (user: User): boolean => {
        const { appFirstTimeOpenDateTime, lastReviewPromptDateTime, reviewNoCount, userReviewed } = user;

        if (userReviewed || reviewNoCount >= NO_THRESHOLD) {
            return false; // Stop asking if reviewed or too many "No" responses
        }

        const now = new Date().getTime();
        const firstOpenTime = new Date(appFirstTimeOpenDateTime).getTime();
        const lastPromptTime = lastReviewPromptDateTime ? new Date(lastReviewPromptDateTime).getTime() : 0;

        const daysSinceFirstOpen = (now - firstOpenTime) / (1000 * 60 * 60 * 24);
        const daysSinceLastPrompt = (now - lastPromptTime) / (1000 * 60 * 60 * 24);

        if (lastReviewPromptDateTime && daysSinceLastPrompt < RETRY_WAIT_DAYS) {
            return false; // Wait before retrying
        }

        return daysSinceFirstOpen >= INITIAL_WAIT_DAYS;
    };

    return (
        <Modal
            isOpen={isModalOpen}
            backdrop="transparent"
            isDismissable={true}
            hideCloseButton={true}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 dark:text-white">{translation.in_app_review_header}</ModalHeader>
                <ModalBody>
                    <p className="dark:text-white">{translation.in_app_review_alert}</p>
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="bordered" onPress={() => onUserSaysNo()}>
                        {translation.in_app_review_no}
                    </Button>
                    <Button color="success" variant="bordered" onPress={() => onUserSaysYes()}>
                        {translation.in_app_review_yes}
                    </Button>
                </ModalFooter>
            </ModalContent>

        </Modal>
    );
};