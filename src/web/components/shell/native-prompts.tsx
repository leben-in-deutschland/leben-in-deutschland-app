"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { AppReview } from "@capawesome/capacitor-app-review";
import { AppUpdate, AppUpdateAvailability } from "@capawesome/capacitor-app-update";
import { User } from "@/types/user";
import { updateUser, useIsNative, useTranslations, useUser } from "@/utils/user-store";

const REVIEW_NO_LIMIT = 2;
const REVIEW_FIRST_WAIT_DAYS = 2;
const REVIEW_RETRY_WAIT_DAYS = 4;
const REVIEW_PROMPT_DELAY_MS = 2500;
const DAY_MS = 86_400_000;

let reviewChecked = false;
let updateChecked = false;

/**
 * Whether the Play Store review prompt may be shown now: at least two days
 * after the first app start, never after a review or two "no" answers, and
 * at most every four days. Legacy records store the dates as ISO strings.
 */
export function shouldAskForReview(user: User, now: Date): boolean {
    if (user.userReviewed || (user.reviewNoCount ?? 0) >= REVIEW_NO_LIMIT) {
        return false;
    }
    const firstOpen = new Date(user.appFirstTimeOpenDateTime).getTime();
    // Epoch 0 is the placeholder for records without a first-open time; the home screen stamps them.
    if (Number.isNaN(firstOpen) || firstOpen <= 0 || (now.getTime() - firstOpen) / DAY_MS < REVIEW_FIRST_WAIT_DAYS) {
        return false;
    }
    if (user.lastReviewPromptDateTime) {
        const lastPrompt = new Date(user.lastReviewPromptDateTime).getTime();
        if (!Number.isNaN(lastPrompt) && (now.getTime() - lastPrompt) / DAY_MS < REVIEW_RETRY_WAIT_DAYS) {
            return false;
        }
    }
    return true;
}

function InAppReviewPrompt() {
    const user = useUser();
    const t = useTranslations();
    const [open, setOpen] = useState(false);
    const timer = useRef<number | null>(null);

    useEffect(() => {
        if (!user || reviewChecked) {
            return;
        }
        reviewChecked = true;
        if (!shouldAskForReview(user, new Date())) {
            return;
        }
        timer.current = window.setTimeout(() => {
            updateUser((draft) => {
                draft.lastReviewPromptDateTime = new Date();
            });
            setOpen(true);
        }, REVIEW_PROMPT_DELAY_MS);
    }, [user]);

    useEffect(() => () => {
        if (timer.current !== null) {
            window.clearTimeout(timer.current);
        }
    }, []);

    const onNo = () => {
        setOpen(false);
        updateUser((draft) => {
            draft.reviewNoCount = (draft.reviewNoCount ?? 0) + 1;
            draft.lastReviewPromptDateTime = new Date();
        });
    };

    const onYes = async () => {
        setOpen(false);
        updateUser((draft) => {
            draft.userReviewed = true;
        });
        try {
            await AppReview.requestReview();
        } catch {
            // Review flow unavailable (for example outside Google Play).
        }
    };

    return (
        <Modal isOpen={open} onClose={onNo} placement="center" hideCloseButton>
            <ModalContent>
                <ModalHeader className="font-display text-lg">{t.in_app_review_header}</ModalHeader>
                <ModalBody>
                    <p className="text-default-600">{t.in_app_review_alert}</p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onNo}>
                        {t.in_app_review_no}
                    </Button>
                    <Button color="primary" onPress={() => void onYes()}>
                        {t.in_app_review_yes}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

function AppUpdatePrompt() {
    const t = useTranslations();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (updateChecked) {
            return;
        }
        updateChecked = true;
        AppUpdate.getAppUpdateInfo()
            .then((info) => {
                if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
                    setOpen(true);
                }
            })
            .catch(() => undefined);
    }, []);

    const confirmUpdate = async () => {
        setOpen(false);
        try {
            const info = await AppUpdate.getAppUpdateInfo();
            if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
                return;
            }
            if (info.immediateUpdateAllowed) {
                await AppUpdate.performImmediateUpdate();
            } else if (info.flexibleUpdateAllowed) {
                await AppUpdate.startFlexibleUpdate();
                await AppUpdate.completeFlexibleUpdate();
            }
        } catch {
            // Update flow unavailable (for example outside Google Play).
        }
    };

    return (
        <Modal isOpen={open} onClose={() => setOpen(false)} placement="center" hideCloseButton>
            <ModalContent>
                <ModalHeader className="font-display text-lg">{t.app_update_title}</ModalHeader>
                <ModalBody>
                    <p className="text-default-600">{t.app_update_subtitle1}</p>
                    <p className="text-sm text-warning">{t.app_update_subtitle2}</p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={() => setOpen(false)}>
                        {t.close}
                    </Button>
                    <Button color="primary" onPress={() => void confirmUpdate()}>
                        {t.app_update_yes}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

/** Google Play prompts (in-app update, in-app review). Renders nothing on the web. */
export function NativePrompts() {
    const isNative = useIsNative();
    if (!isNative) {
        return null;
    }
    return (
        <>
            <AppUpdatePrompt />
            <InAppReviewPrompt />
        </>
    );
}
